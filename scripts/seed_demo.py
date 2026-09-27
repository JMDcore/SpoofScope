from datetime import UTC, datetime, timedelta

from spoofscope.db import Base, SessionLocal, engine
from spoofscope.models import Asset, Candidate, Domain, Event, Scan, ScanStatus, Snapshot

Base.metadata.create_all(engine)
db = SessionLocal()
if db.query(Domain).count():
    print("Database already contains domains; seed skipped")
    raise SystemExit

now = datetime.now(UTC)
domain = Domain(
    name="northstar.example",
    label="Northstar Labs",
    authorized=True,
    last_scan_at=now,
)
db.add(domain)
db.flush()

root_data = {
    "http": {
        "reachable": True,
        "status": 200,
        "title": "Northstar Labs — Secure operations",
        "technologies": ["Next.js"],
        "security_headers": {"strict-transport-security": "max-age=31536000"},
        "structure_hash": "demo-structure-1",
    },
    "tls": {"version": "TLSv1.3", "not_after": "Dec 18 00:00:00 2026 GMT"},
    "dns": {"A": ["203.0.113.10"], "MX": ["10 mail.northstar.example"]},
}
status_data = {
    "http": {"reachable": True, "status": 200, "title": "Northstar Status", "technologies": []},
    "tls": {"version": "TLSv1.3"},
    "dns": {"A": ["203.0.113.11"]},
}
candidate_data = {
    "http": {"reachable": True, "status": 200, "title": "Northstar account", "forms": 1},
    "dns": {"A": ["203.0.113.90"]},
    "rdap": {"available": True, "registered_at": "2026-09-18T09:21:00Z"},
    "structural_similarity": 0.72,
}

db.add_all(
    [
        Asset(
            domain_id=domain.id,
            hostname=domain.name,
            state="UNCHANGED",
            fingerprint="demo-root",
            data=root_data,
            first_seen=now - timedelta(days=30),
        ),
        Asset(
            domain_id=domain.id,
            hostname=f"status.{domain.name}",
            state="NEW",
            fingerprint="demo-status",
            data=status_data,
            first_seen=now,
        ),
        Candidate(
            domain_id=domain.id,
            hostname="northstarlabs.example",
            technique="brand-extension",
            score=68,
            state="NEW",
            signals=[
                "Resolves in DNS",
                "Serves a public website",
                "Contains brand-related text",
                "Contains interactive forms",
                "High structural similarity (72%)",
            ],
            data=candidate_data,
        ),
    ]
)

for index in range(3):
    observed = now - timedelta(days=14 - index * 7)
    scan = Scan(
        domain_id=domain.id,
        status=ScanStatus.completed,
        started_at=observed - timedelta(minutes=3),
        finished_at=observed,
        stats={
            "assets": 1 + int(index == 2),
            "candidates": int(index == 2),
            "ct_names": 4,
            "variants_checked": 96,
            "screenshots": 0,
        },
    )
    db.add(scan)
    db.flush()
    db.add(
        Snapshot(
            scan_id=scan.id,
            domain_id=domain.id,
            subject_type="asset",
            subject_key=domain.name,
            state="NEW" if index == 0 else "UNCHANGED",
            fingerprint="demo-root",
            data=root_data,
            observed_at=observed,
        )
    )
    if index == 2:
        db.add_all(
            [
                Snapshot(
                    scan_id=scan.id,
                    domain_id=domain.id,
                    subject_type="asset",
                    subject_key=f"status.{domain.name}",
                    state="NEW",
                    fingerprint="demo-status",
                    data=status_data,
                    observed_at=observed,
                ),
                Snapshot(
                    scan_id=scan.id,
                    domain_id=domain.id,
                    subject_type="candidate",
                    subject_key="northstarlabs.example",
                    state="NEW",
                    fingerprint="demo-candidate",
                    data=candidate_data,
                    observed_at=observed,
                ),
            ]
        )

events = (
    ("info", "NEW: status.northstar.example", "A new public status host was observed."),
    (
        "high",
        "NEW: similar domain northstarlabs.example",
        "Review signals; no maliciousness verdict was made.",
    ),
    (
        "info",
        "Baseline completed for northstar.example",
        "DNS, HTTP and TLS observations were stored.",
    ),
)
for index, (severity, title, detail) in enumerate(events):
    db.add(
        Event(
            domain_id=domain.id,
            type="demo",
            severity=severity,
            title=title,
            detail=detail,
            created_at=now - timedelta(hours=index * 4),
        )
    )

db.commit()
print("Demo workspace created")
