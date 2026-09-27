import asyncio
import hashlib
import ipaddress
import re
import socket
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image

from .config import settings


def difference_hash(content: bytes) -> str:
    image = Image.open(BytesIO(content)).convert("L").resize((9, 8))
    pixels = list(image.get_flattened_data())
    bits = []
    for row in range(8):
        offset = row * 9
        bits.extend(pixels[offset + col] > pixels[offset + col + 1] for col in range(8))
    value = sum(1 << index for index, bit in enumerate(bits) if bit)
    return f"{value:016x}"


def hash_similarity(left: str | None, right: str | None) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    distance = (int(left, 16) ^ int(right, 16)).bit_count()
    return 1 - distance / (len(left) * 4)


def _safe_slug(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9.-]+", "_", value)[:180]


def _literal_target_is_safe(url: str) -> bool:
    hostname = urlparse(url).hostname
    if not hostname or hostname in {"localhost", "localhost.localdomain"}:
        return False
    try:
        return ipaddress.ip_address(hostname).is_global
    except ValueError:
        return True


async def _target_is_safe(url: str) -> bool:
    if not _literal_target_is_safe(url):
        return False
    hostname = urlparse(url).hostname
    try:
        answers = await asyncio.to_thread(socket.getaddrinfo, hostname, None)
        addresses = {item[4][0] for item in answers}
        return bool(addresses) and all(ipaddress.ip_address(value).is_global for value in addresses)
    except (OSError, ValueError):
        return False


async def capture_page(url: str, domain_id: int, scan_id: int, subject: str) -> dict:
    if not settings.screenshots_enabled or not await _target_is_safe(url):
        return {"available": False, "reason": "disabled-or-unsafe"}
    try:
        from playwright.async_api import async_playwright

        output_dir = Path(settings.screenshot_dir) / str(domain_id) / str(scan_id)
        output_dir.mkdir(parents=True, exist_ok=True)
        filename = _safe_slug(subject) + ".webp"
        output = output_dir / filename
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(
                headless=True,
                args=["--disable-dev-shm-usage", "--no-sandbox"],
            )
            page = await browser.new_page(
                viewport={"width": 1440, "height": 1000}, device_scale_factor=1
            )

            async def route_handler(route):
                if await _target_is_safe(route.request.url):
                    await route.continue_()
                else:
                    await route.abort()

            await page.route("**/*", route_handler)
            await page.goto(url, wait_until="domcontentloaded", timeout=15_000)
            await page.wait_for_timeout(750)
            content = await page.screenshot(type="webp", quality=76, full_page=False)
            title = await page.title()
            final_url = page.url
            await browser.close()
        await asyncio.to_thread(output.write_bytes, content)
        return {
            "available": True,
            "path": str(output.relative_to(Path(settings.screenshot_dir))),
            "sha256": hashlib.sha256(content).hexdigest(),
            "dhash": difference_hash(content),
            "title": title[:300],
            "final_url": final_url,
            "width": 1440,
            "height": 1000,
        }
    except Exception as exc:
        return {"available": False, "error": type(exc).__name__}
