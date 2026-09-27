import asyncio
import hashlib
import ipaddress
import json
import socket
import ssl
import time
import weakref
from collections import Counter
from datetime import UTC, datetime
from urllib.parse import quote, urljoin, urlparse

import dns.asyncresolver
import httpx
from bs4 import BeautifulSoup

from .config import settings

SECURITY_HEADERS = (
    "strict-transport-security",
    "content-security-policy",
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "permissions-policy",
)
_rate_states: weakref.WeakKeyDictionary = weakref.WeakKeyDictionary()


async def rate_limit():
    loop = asyncio.get_running_loop()
    state = _rate_states.setdefault(loop, {"lock": asyncio.Lock(), "next_request": 0.0})
    async with state["lock"]:
        interval = 1 / max(settings.request_rate_per_second, 0.1)
        wait = state["next_request"] - time.monotonic()
        if wait > 0:
            await asyncio.sleep(wait)
        state["next_request"] = time.monotonic() + interval


async def retry_request(client: httpx.AsyncClient, method: str, url: str, **kwargs):
    last_error = None
    for attempt in range(3):
        await rate_limit()
        try:
            response = await client.request(method, url, **kwargs)
            if response.status_code == 429 or response.status_code >= 500:
                raise httpx.HTTPStatusError(
                    "retryable response", request=response.request, response=response
                )
            return response
        except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as exc:
            last_error = exc
            if attempt < 2:
                await asyncio.sleep(0.5 * (2**attempt))
    raise last_error or RuntimeError("request failed")


async def dns_snapshot(hostname: str) -> dict:
    result: dict[str, list[str]] = {}
    resolver = dns.asyncresolver.Resolver()
    resolver.lifetime = settings.scan_timeout_seconds
    for record in ("A", "AAAA", "CNAME", "MX", "NS", "TXT", "CAA"):
        try:
            answers = await resolver.resolve(hostname, record)
            result[record] = sorted(str(item).rstrip(".") for item in answers)
        except Exception:
            result[record] = []
    return result


def dns_is_public(dns_data: dict) -> bool:
    addresses = dns_data.get("A", []) + dns_data.get("AAAA", [])
    if not addresses:
        return True
    try:
        return all(ipaddress.ip_address(value).is_global for value in addresses)
    except ValueError:
        return False


async def hostname_is_public(hostname: str) -> bool:
    if hostname in {"localhost", "localhost.localdomain"}:
        return False
    snapshot = await dns_snapshot(hostname)
    return bool(snapshot.get("A") or snapshot.get("AAAA")) and dns_is_public(snapshot)


def _tls_sync(hostname: str) -> dict:
    context = ssl.create_default_context()
    with socket.create_connection((hostname, 443), timeout=settings.scan_timeout_seconds) as sock:
        with context.wrap_socket(sock, server_hostname=hostname) as tls:
            cert = tls.getpeercert()
            return {
                "issuer": dict(x[0] for x in cert.get("issuer", [])),
                "subject": dict(x[0] for x in cert.get("subject", [])),
                "san": [v for kind, v in cert.get("subjectAltName", []) if kind == "DNS"][:100],
                "not_before": cert.get("notBefore"),
                "not_after": cert.get("notAfter"),
                "version": tls.version(),
            }


async def tls_snapshot(hostname: str) -> dict:
    try:
        return await asyncio.to_thread(_tls_sync, hostname)
    except Exception as exc:
        return {"error": type(exc).__name__}


def structural_features(soup: BeautifulSoup) -> tuple[list[str], str]:
    counts = Counter(tag.name for tag in soup.find_all(True))
    tokens = [f"tag:{name}:{min(count, 99)}" for name, count in sorted(counts.items())]
    for form in soup.find_all("form")[:10]:
        inputs = sorted(str(item.get("type", "text")).lower() for item in form.find_all("input"))
        tokens.append("form:" + ",".join(inputs))
    landmarks = [tag.name for tag in soup.find_all(["header", "nav", "main", "aside", "footer"])]
    tokens.append("landmarks:" + ",".join(landmarks))
    tokens = tokens[:250]
    return tokens, hashlib.sha256("\n".join(tokens).encode()).hexdigest()


async def http_snapshot(
    hostname: str, brand: str | None = None, resolved_dns: dict | None = None
) -> dict:
    headers = {"User-Agent": settings.user_agent, "Accept": "text/html,application/xhtml+xml"}
    dns_data = resolved_dns if resolved_dns is not None else await dns_snapshot(hostname)
    if not dns_is_public(dns_data):
        return {"reachable": False, "blocked": "non-public-address"}
    async with httpx.AsyncClient(
        timeout=settings.scan_timeout_seconds, headers=headers, verify=True
    ) as client:
        response = None
        redirects: list[str] = []
        for scheme in ("https", "http"):
            current = f"{scheme}://{hostname}/"
            try:
                for _ in range(6):
                    target_host = urlparse(current).hostname
                    if not target_host or not await hostname_is_public(target_host):
                        raise ValueError("redirect target is not a public host")
                    response = await retry_request(client, "GET", current)
                    if response.status_code not in (301, 302, 303, 307, 308):
                        break
                    location = response.headers.get("location")
                    if not location:
                        break
                    redirects.append(current)
                    current = urljoin(current, location)
                if response is not None:
                    break
            except (httpx.HTTPError, ValueError):
                response = None
        if response is None:
            return {"reachable": False}
        content_type = response.headers.get("content-type", "")
        if "html" not in content_type.lower():
            return {
                "reachable": True,
                "url": str(response.url),
                "status": response.status_code,
                "content_type": content_type[:120],
                "redirects": redirects,
            }
        body = response.text[:1_000_000]
        soup = BeautifulSoup(body, "html.parser")
        title = soup.title.get_text(" ", strip=True)[:300] if soup.title else None
        icon = soup.find("link", rel=lambda value: value and "icon" in str(value).lower())
        forms = soup.find_all("form")
        external = set()
        for tag in soup.find_all(["script", "img"], src=True) + soup.find_all("link", href=True):
            raw = tag.get("src") or tag.get("href")
            parsed = urlparse(urljoin(str(response.url), raw))
            if parsed.hostname and parsed.hostname != hostname:
                external.add(parsed.hostname)
        technologies = []
        if response.headers.get("server"):
            technologies.append(response.headers["server"][:80])
        if response.headers.get("x-powered-by"):
            technologies.append(response.headers["x-powered-by"][:80])
        lower = body.lower()
        for marker, tech in (
            ("wp-content", "WordPress"),
            ("__next_data__", "Next.js"),
            ("data-reactroot", "React"),
            ("cdn.shopify.com", "Shopify"),
        ):
            if marker in lower:
                technologies.append(tech)
        structure_tokens, structure_hash = structural_features(soup)
        return {
            "reachable": True,
            "url": str(response.url),
            "status": response.status_code,
            "content_type": content_type[:120],
            "redirects": redirects,
            "title": title,
            "favicon": urljoin(str(response.url), icon.get("href"))
            if icon and icon.get("href")
            else None,
            "forms": len(forms),
            "password_forms": sum(bool(f.find("input", attrs={"type": "password"})) for f in forms),
            "external_resources": sorted(external)[:50],
            "technologies": sorted(set(technologies)),
            "security_headers": {h: response.headers.get(h) for h in SECURITY_HEADERS},
            "brand_mentions": lower.count(brand.lower()) if brand else 0,
            "html_hash": hashlib.sha256(body.encode(errors="ignore")).hexdigest(),
            "structure_tokens": structure_tokens,
            "structure_hash": structure_hash,
        }


async def rdap_snapshot(hostname: str) -> dict:
    async with httpx.AsyncClient(
        timeout=settings.scan_timeout_seconds,
        headers={"User-Agent": settings.user_agent},
        follow_redirects=True,
    ) as client:
        try:
            response = await retry_request(
                client, "GET", f"https://rdap.org/domain/{quote(hostname)}"
            )
            if response.status_code != 200:
                return {"available": False, "status": response.status_code}
            payload = response.json()
            dates = {
                item.get("eventAction"): item.get("eventDate") for item in payload.get("events", [])
            }
            nameservers = [
                x.get("ldhName") for x in payload.get("nameservers", []) if x.get("ldhName")
            ]
            return {
                "available": True,
                "handle": payload.get("handle"),
                "status": payload.get("status", []),
                "registered_at": dates.get("registration"),
                "changed_at": dates.get("last changed"),
                "expires_at": dates.get("expiration"),
                "nameservers": nameservers[:20],
                "port43": payload.get("port43"),
            }
        except Exception as exc:
            return {"available": False, "error": type(exc).__name__}


async def ct_subdomains(domain: str) -> list[str]:
    if not settings.ct_enabled:
        return []
    url = f"https://crt.sh/?q=%25.{quote(domain)}&output=json"
    async with httpx.AsyncClient(
        timeout=max(settings.scan_timeout_seconds * 2, 15),
        headers={"User-Agent": settings.user_agent},
    ) as client:
        try:
            response = await retry_request(client, "GET", url)
            response.raise_for_status()
            names: set[str] = set()
            for item in response.json():
                for raw in str(item.get("name_value", "")).splitlines():
                    name = raw.lower().strip().removeprefix("*.").rstrip(".")
                    if name == domain or name.endswith("." + domain):
                        try:
                            names.add(name.encode("idna").decode("ascii"))
                        except UnicodeError:
                            continue
            return sorted(names)[: settings.max_ct_hosts]
        except Exception:
            return []


async def inspect_host(hostname: str, brand: str | None = None, include_rdap: bool = False) -> dict:
    dns_data = await dns_snapshot(hostname)
    has_address = bool(dns_data.get("A") or dns_data.get("AAAA")) and dns_is_public(dns_data)
    tasks = [
        http_snapshot(hostname, brand, dns_data),
        tls_snapshot(hostname) if has_address else asyncio.sleep(0, result={"error": "NoAddress"}),
    ]
    if include_rdap:
        tasks.append(rdap_snapshot(hostname))
    results = await asyncio.gather(*tasks)
    stable = {"dns": dns_data, "http": results[0], "tls": results[1]}
    if include_rdap:
        stable["rdap"] = results[2]
    canonical = json.dumps(stable, sort_keys=True, default=str)
    data = {**stable, "observed_at": datetime.now(UTC).isoformat()}
    data["fingerprint"] = hashlib.sha256(canonical.encode()).hexdigest()
    return data


def structural_similarity(left: list[str], right: list[str]) -> float:
    a, b = set(left or []), set(right or [])
    return len(a & b) / len(a | b) if a and b else 0.0


def candidate_score(data: dict, brand: str, baseline: dict | None = None) -> tuple[int, list[str]]:
    score, signals = 0, []
    dns_data, web = data.get("dns", {}), data.get("http", {})
    if any(dns_data.values()):
        score += 20
        signals.append("Resolves in DNS")
    if web.get("reachable"):
        score += 15
        signals.append("Serves a public website")
    if web.get("brand_mentions", 0):
        score += min(20, web["brand_mentions"] * 5)
        signals.append("Contains brand-related text")
    if web.get("password_forms", 0):
        score += 25
        signals.append("Contains a password input")
    if web.get("forms", 0):
        score += 8
        signals.append("Contains interactive forms")
    if web.get("redirects"):
        score += 5
        signals.append("Redirect behavior observed")
    if baseline:
        similarity = structural_similarity(
            baseline.get("structure_tokens", []), web.get("structure_tokens", [])
        )
        data["structural_similarity"] = round(similarity, 3)
        if similarity >= 0.7:
            score += 12
            signals.append(f"High structural similarity ({similarity:.0%})")
        elif similarity >= 0.45:
            score += 6
            signals.append(f"Moderate structural similarity ({similarity:.0%})")
    return min(score, 100), signals
