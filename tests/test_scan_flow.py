import asyncio

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from spoofscope import services
from spoofscope.db import Base
from spoofscope.models import Asset, Domain, Event, Scan, ScanStatus, Snapshot


def test_scan_persists_history_and_detects_disappearance(monkeypatch):
    engine = create_engine("sqlite:///:memory:")
    TestingSession = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)
    monkeypatch.setattr(services, "SessionLocal", TestingSession)
    monkeypatch.setattr(services.settings, "disappearance_grace_scans", 1)
    monkeypatch.setattr(services.settings, "max_candidates", 2)

    state = {"visible": True}

    async def fake_ct(_domain):
        return ["new.example.test"]

    async def fake_inspect(hostname, _brand):
        present = hostname == "example.test" or (
            hostname == "new.example.test" and state["visible"]
        )
        return {
            "dns": {"A": ["8.8.8.8"] if present else []},
            "http": {
                "reachable": present,
                "url": f"https://{hostname}/" if present else None,
                "structure_tokens": ["tag:html:1"],
            },
            "tls": {},
            "fingerprint": "present-" + hostname if present else "absent-" + hostname,
        }

    async def no_capture(*_args):
        return {"available": False}

    async def no_rdap(_hostname):
        return {"available": False}

    monkeypatch.setattr(services, "ct_subdomains", fake_ct)
    monkeypatch.setattr(services, "inspect_host", fake_inspect)
    monkeypatch.setattr(services, "capture_page", no_capture)
    monkeypatch.setattr(services, "rdap_snapshot", no_rdap)

    with TestingSession() as db:
        domain = Domain(name="example.test", authorized=True)
        db.add(domain)
        db.commit()
        first = Scan(domain_id=domain.id)
        db.add(first)
        db.commit()
        first_id = first.id
        domain_id = domain.id
    asyncio.run(services.run_scan_async(first_id))

    state["visible"] = False
    with TestingSession() as db:
        second = Scan(domain_id=domain_id)
        db.add(second)
        db.commit()
        second_id = second.id
    asyncio.run(services.run_scan_async(second_id))

    with TestingSession() as db:
        disappeared = db.scalar(select(Asset).where(Asset.hostname == "new.example.test"))
        assert disappeared.state == "DISAPPEARED"
        assert db.get(Scan, first_id).status == ScanStatus.completed
        assert db.get(Scan, second_id).status == ScanStatus.completed
        assert len(db.scalars(select(Snapshot)).all()) >= 3
        assert db.scalar(select(Event).where(Event.title.like("DISAPPEARED:%")))


def test_storage_path_and_raw_image_hash_do_not_create_changes():
    first = {
        "http": {"status": 200, "html_hash": "dynamic-a"},
        "visual": {"available": True, "path": "1/a.webp", "sha256": "a", "dhash": "00"},
    }
    second = {
        "http": {"status": 200, "html_hash": "dynamic-b"},
        "visual": {"available": True, "path": "2/a.webp", "sha256": "b", "dhash": "00"},
    }
    assert services._fingerprint(first) == services._fingerprint(second)


def test_failed_collection_marks_scan_failed(monkeypatch):
    engine = create_engine("sqlite:///:memory:")
    TestingSession = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)
    monkeypatch.setattr(services, "SessionLocal", TestingSession)

    async def fail_ct(_domain):
        raise RuntimeError("collector unavailable")

    monkeypatch.setattr(services, "ct_subdomains", fail_ct)
    with TestingSession() as db:
        domain = Domain(name="failure.test", authorized=True)
        db.add(domain)
        db.flush()
        scan = Scan(domain_id=domain.id)
        db.add(scan)
        db.commit()
        scan_id = scan.id

    with pytest.raises(RuntimeError, match="collector unavailable"):
        asyncio.run(services.run_scan_async(scan_id))
    with TestingSession() as db:
        failed = db.get(Scan, scan_id)
        assert failed.status == ScanStatus.failed
        assert "collector unavailable" in failed.error
