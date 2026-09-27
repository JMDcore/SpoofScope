import asyncio

from spoofscope import scanner


def test_rate_limiter_supports_multiple_worker_event_loops(monkeypatch):
    monkeypatch.setattr(scanner.settings, "request_rate_per_second", 10_000)

    async def run_twice():
        await asyncio.gather(scanner.rate_limit(), scanner.rate_limit())

    asyncio.run(run_twice())
    asyncio.run(run_twice())
