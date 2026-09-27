from apscheduler.schedulers.blocking import BlockingScheduler
from redis import Redis
from rq import Queue, Retry
from sqlalchemy import select

from .config import settings
from .db import SessionLocal
from .logging_config import configure_logging
from .models import Domain, Scan, ScanStatus


def schedule_scans():
    with SessionLocal() as db:
        queue = Queue("scans", connection=Redis.from_url(settings.redis_url))
        for domain in db.scalars(select(Domain).where(Domain.active.is_(True))):
            active = db.scalar(
                select(Scan).where(
                    Scan.domain_id == domain.id,
                    Scan.status.in_([ScanStatus.queued, ScanStatus.running]),
                )
            )
            if active:
                continue
            scan = Scan(domain_id=domain.id)
            db.add(scan)
            db.commit()
            queue.enqueue(
                "spoofscope.services.run_scan",
                scan.id,
                job_timeout="20m",
                retry=Retry(max=3, interval=[60, 300, 900]),
            )


def main():
    configure_logging(settings.log_level)
    scheduler = BlockingScheduler(timezone="UTC")
    scheduler.add_job(
        schedule_scans,
        "interval",
        minutes=settings.scan_interval_minutes,
        id="domain-scans",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()


if __name__ == "__main__":
    main()
