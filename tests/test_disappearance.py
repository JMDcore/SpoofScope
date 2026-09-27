from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from spoofscope import services
from spoofscope.db import Base
from spoofscope.models import Asset, Domain, Event, Scan, Snapshot


def test_disappeared_after_grace_period(monkeypatch):
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    domain = Domain(name="example.test", authorized=True)
    session.add(domain)
    session.flush()
    asset = Asset(
        domain_id=domain.id, hostname="www.example.test", data={"fingerprint": "x"}, fingerprint="x"
    )
    session.add(asset)
    session.flush()
    monkeypatch.setattr(services.settings, "disappearance_grace_scans", 2)
    for _ in range(2):
        scan = Scan(domain_id=domain.id)
        session.add(scan)
        session.flush()
        services._mark_missing(session, scan, [asset], set(), "asset")
    session.commit()
    assert asset.state == "DISAPPEARED"
    assert asset.disappeared_at is not None
    assert session.scalar(select(Event).where(Event.title.like("DISAPPEARED:%")))
    assert len(session.scalars(select(Snapshot)).all()) == 2
