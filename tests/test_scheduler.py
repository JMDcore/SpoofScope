from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from spoofscope import scheduler
from spoofscope.db import Base
from spoofscope.models import Domain, Scan, ScanStatus


def test_scheduler_enqueues_active_domain_once(monkeypatch):
    engine = create_engine("sqlite:///:memory:")
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)
    with Session() as db:
        db.add(Domain(name="example.test", authorized=True, active=True))
        db.commit()

    jobs = []

    class FakeQueue:
        def __init__(self, *_args, **_kwargs):
            pass

        def enqueue(self, *args, **kwargs):
            jobs.append((args, kwargs))

    monkeypatch.setattr(scheduler, "SessionLocal", Session)
    monkeypatch.setattr(scheduler, "Queue", FakeQueue)
    monkeypatch.setattr(scheduler.Redis, "from_url", lambda *_args, **_kwargs: object())
    scheduler.schedule_scans()
    scheduler.schedule_scans()

    with Session() as db:
        scans = db.scalars(select(Scan)).all()
        assert len(scans) == 1
        assert scans[0].status == ScanStatus.queued
    assert len(jobs) == 1
