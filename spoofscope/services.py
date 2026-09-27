import asyncio
import hashlib
import json
import logging
import shutil
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import delete, select

from .config import settings
from .db import SessionLocal
from .models import Asset, Candidate, Domain, Event, Scan, ScanStatus, Snapshot
from .scanner import candidate_score, ct_subdomains, inspect_host, rdap_snapshot
from .typos import generate_variants
from .visual import capture_page, hash_similarity

logger = logging.getLogger("spoofscope.scan")
PASSIVE_SUBDOMAINS = ("www", "mail", "api", "app", "portal", "status", "cdn")


def _fingerprint(data: dict) -> str:
    stable = deepcopy(data)
    stable.pop("observed_at", None)
    stable.pop("fingerprint", None)
    if "http" in stable:
        stable["http"].pop("html_hash", None)
    visual = stable.get("visual")
    if visual:
        stable["visual"] = {
            "available": visual.get("available", False),
            "dhash": visual.get("dhash"),
            "final_url": visual.get("final_url"),
        }
    return hashlib.sha256(json.dumps(stable, sort_keys=True, default=str).encode()).hexdigest()


def _event(db, domain_id: int, kind: str, state: str, subject: str, detail: str, **metadata):
    severity = "high" if metadata.get("score", 0) >= 60 else "info" if kind == "asset" else "medium"
    db.add(
        Event(
            domain_id=domain_id,
            type=kind,
            severity=severity,
            title=f"{state}: {subject}",
            detail=detail,
            metadata_=metadata,
        )
    )


def _snapshot(db, scan: Scan, subject_type: str, subject_key: str, state: str, data: dict):
    db.add(
        Snapshot(
            scan_id=scan.id,
            domain_id=scan.domain_id,
            subject_type=subject_type,
            subject_key=subject_key,
            state=state,
            fingerprint=data.get("fingerprint", ""),
            data=data,
        )
    )


async def _bounded_inspect(hosts: list[str], brand: str) -> list[tuple[str, dict]]:
    semaphore = asyncio.Semaphore(12)

    async def inspect(hostname: str):
        async with semaphore:
            return hostname, await inspect_host(hostname, brand)

    return await asyncio.gather(*(inspect(hostname) for hostname in hosts))


def _is_present(data: dict) -> bool:
    return any(data.get("dns", {}).values()) or data.get("http", {}).get("reachable", False)


async def _capture(data: dict, domain_id: int, scan_id: int, subject: str) -> dict:
    url = data.get("http", {}).get("url")
    if not url:
        return {"available": False, "reason": "no-public-page"}
    return await capture_page(url, domain_id, scan_id, subject)


def _mark_missing(db, scan: Scan, records, seen: set[str], subject_type: str):
    now = datetime.now(UTC)
    for record in records:
        if record.hostname in seen:
            continue
        record.missing_scans += 1
        previous_state = record.state
        if record.missing_scans >= settings.disappearance_grace_scans:
            record.state = "DISAPPEARED"
            record.disappeared_at = record.disappeared_at or now
            if previous_state != "DISAPPEARED":
                _event(
                    db,
                    scan.domain_id,
                    subject_type,
                    "DISAPPEARED",
                    record.hostname,
                    f"Not observed in {record.missing_scans} consecutive scans.",
                )
        _snapshot(db, scan, subject_type, record.hostname, record.state, record.data)


def cleanup_retention(db):
    cutoff = datetime.now(UTC) - timedelta(days=settings.retention_days)
    db.execute(delete(Snapshot).where(Snapshot.observed_at < cutoff))
    root = Path(settings.screenshot_dir)
    if root.exists():
        for path in root.glob("*/*"):
            try:
                modified = datetime.fromtimestamp(path.stat().st_mtime, UTC)
                if path.is_dir() and modified < cutoff:
                    shutil.rmtree(path)
            except OSError:
                logger.warning("retention_cleanup_failed", extra={"path": str(path)})


async def run_scan_async(scan_id: int):
    db = SessionLocal()
    scan = db.get(Scan, scan_id)
    if not scan:
        db.close()
        return
    domain = db.get(Domain, scan.domain_id)
    scan.status, scan.started_at = ScanStatus.running, datetime.now(UTC)
    db.commit()
    logger.info("scan_started", extra={"scan_id": scan.id, "domain": domain.name})
    try:
        brand = domain.name.split(".")[0]
        ct_hosts = await ct_subdomains(domain.name)
        hosts = sorted(
            {domain.name, *(f"{p}.{domain.name}" for p in PASSIVE_SUBDOMAINS), *ct_hosts}
        )
        observations = await _bounded_inspect(hosts, brand)
        asset_seen: set[str] = set()
        baseline_web: dict = {}
        baseline_visual: dict = {}
        assets_seen = 0
        for host, data in observations:
            if not _is_present(data):
                continue
            if host == domain.name:
                data["visual"] = await _capture(data, domain.id, scan.id, host)
                data["fingerprint"] = _fingerprint(data)
                baseline_web = data.get("http", {})
                baseline_visual = data.get("visual", {})
            existing = db.scalar(
                select(Asset).where(Asset.domain_id == domain.id, Asset.hostname == host)
            )
            state = (
                "NEW"
                if not existing
                else ("CHANGED" if existing.fingerprint != data["fingerprint"] else "UNCHANGED")
            )
            if existing:
                existing.data, existing.fingerprint, existing.last_seen, existing.state = (
                    data,
                    data["fingerprint"],
                    datetime.now(UTC),
                    state,
                )
                existing.missing_scans, existing.disappeared_at = 0, None
            else:
                existing = Asset(
                    domain_id=domain.id,
                    hostname=host,
                    data=data,
                    fingerprint=data["fingerprint"],
                    state=state,
                )
                db.add(existing)
            _snapshot(db, scan, "asset", host, state, data)
            if state != "UNCHANGED":
                _event(db, domain.id, "asset", state, host, "Public exposure snapshot changed.")
            asset_seen.add(host)
            assets_seen += 1
        all_assets = db.scalars(select(Asset).where(Asset.domain_id == domain.id)).all()
        _mark_missing(db, scan, all_assets, asset_seen, "asset")

        variants = generate_variants(domain.name, settings.max_candidates)
        variant_map = {item.hostname: item for item in variants}
        candidate_observations = await _bounded_inspect(list(variant_map), brand)
        candidate_seen: set[str] = set()
        candidates_seen = 0
        screenshots = 0
        for hostname, data in candidate_observations:
            if not _is_present(data):
                continue
            data["rdap"] = await rdap_snapshot(hostname)
            score, signals = candidate_score(data, brand, baseline_web)
            if (
                score >= settings.screenshot_threshold
                and screenshots < settings.max_screenshots_per_scan
            ):
                data["visual"] = await _capture(data, domain.id, scan.id, hostname)
                screenshots += int(data["visual"].get("available", False))
                similarity = hash_similarity(
                    baseline_visual.get("dhash"), data["visual"].get("dhash")
                )
                data["visual_similarity"] = round(similarity, 3)
                if similarity >= 0.82:
                    score = min(100, score + 12)
                    signals.append(f"High visual similarity ({similarity:.0%})")
            data["fingerprint"] = _fingerprint(data)
            existing = db.scalar(
                select(Candidate).where(
                    Candidate.domain_id == domain.id, Candidate.hostname == hostname
                )
            )
            state = (
                "NEW"
                if not existing
                else (
                    "CHANGED"
                    if existing.data.get("fingerprint") != data["fingerprint"]
                    else "UNCHANGED"
                )
            )
            if existing:
                existing.data, existing.score, existing.signals = data, score, signals
                existing.state, existing.last_seen = state, datetime.now(UTC)
                existing.missing_scans, existing.disappeared_at = 0, None
            else:
                existing = Candidate(
                    domain_id=domain.id,
                    hostname=hostname,
                    technique=variant_map[hostname].technique,
                    score=score,
                    signals=signals,
                    data=data,
                    state=state,
                )
                db.add(existing)
            _snapshot(db, scan, "candidate", hostname, state, data)
            if state != "UNCHANGED":
                _event(
                    db,
                    domain.id,
                    "candidate",
                    state,
                    f"similar domain {hostname}",
                    "Review the observed signals; this is not a maliciousness verdict.",
                    score=score,
                    signals=signals,
                )
            candidate_seen.add(hostname)
            candidates_seen += 1
        all_candidates = db.scalars(select(Candidate).where(Candidate.domain_id == domain.id)).all()
        _mark_missing(db, scan, all_candidates, candidate_seen, "candidate")

        domain.last_scan_at = datetime.now(UTC)
        scan.status, scan.finished_at = ScanStatus.completed, datetime.now(UTC)
        scan.stats = {
            "assets": assets_seen,
            "ct_names": len(ct_hosts),
            "candidates": candidates_seen,
            "variants_checked": len(variants),
            "screenshots": screenshots,
        }
        cleanup_retention(db)
        db.commit()
        logger.info("scan_completed", extra={"scan_id": scan.id, **scan.stats})
    except Exception as exc:
        db.rollback()
        scan = db.get(Scan, scan_id)
        if not scan:
            logger.exception("scan_failed_after_deletion", extra={"scan_id": scan_id})
            return
        scan.status, scan.finished_at = ScanStatus.failed, datetime.now(UTC)
        scan.error = f"{type(exc).__name__}: {exc}"
        db.commit()
        logger.exception("scan_failed", extra={"scan_id": scan.id})
        raise
    finally:
        db.close()


def run_scan(scan_id: int):
    asyncio.run(run_scan_async(scan_id))
