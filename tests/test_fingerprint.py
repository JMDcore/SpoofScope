import pytest

from spoofscope import scanner


@pytest.mark.asyncio
async def test_observation_time_does_not_change_fingerprint(monkeypatch):
    async def dns(_hostname):
        return {"A": ["192.0.2.1"]}

    async def web(_hostname, _brand, _dns=None):
        return {"reachable": True, "status": 200}

    async def tls(_hostname):
        return {"version": "TLSv1.3"}

    monkeypatch.setattr(scanner, "dns_snapshot", dns)
    monkeypatch.setattr(scanner, "http_snapshot", web)
    monkeypatch.setattr(scanner, "tls_snapshot", tls)
    first = await scanner.inspect_host("example.test")
    second = await scanner.inspect_host("example.test")
    assert first["fingerprint"] == second["fingerprint"]
