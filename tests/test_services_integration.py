import os

import pytest
from redis import Redis
from rq import Queue, SimpleWorker
from sqlalchemy import create_engine, text

from spoofscope import models  # noqa: F401
from spoofscope.db import Base
from spoofscope.worker import health_job


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="requires PostgreSQL service")
def test_postgres_schema_roundtrip():
    engine = create_engine(os.environ["TEST_DATABASE_URL"])
    Base.metadata.create_all(engine)
    with engine.connect() as connection:
        assert connection.scalar(text("select 1")) == 1
        assert connection.scalar(text("select count(*) from snapshots")) == 0
    Base.metadata.drop_all(engine)


@pytest.mark.skipif(not os.getenv("TEST_REDIS_URL"), reason="requires Redis service")
def test_real_redis_worker_executes_job():
    connection = Redis.from_url(os.environ["TEST_REDIS_URL"])
    connection.flushdb()
    queue = Queue("integration", connection=connection)
    job = queue.enqueue(health_job, "probe")
    worker = SimpleWorker([queue], connection=connection)
    worker.work(burst=True)
    job.refresh()
    assert job.return_value() == "worker-ok:probe"
