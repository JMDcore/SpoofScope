from redis import Redis
from rq import Queue, Worker

from .config import settings
from .logging_config import configure_logging


def health_job(value: str) -> str:
    """Small importable job used by deployment integration checks."""
    return f"worker-ok:{value}"


def main():
    configure_logging(settings.log_level)
    connection = Redis.from_url(settings.redis_url)
    Worker([Queue("scans", connection=connection)], connection=connection).work()


if __name__ == "__main__":
    main()
