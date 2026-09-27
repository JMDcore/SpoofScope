import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from spoofscope.config import settings
from spoofscope.db import Base, get_db
from spoofscope.main import app
from spoofscope.models import Asset, Domain, Scan, Snapshot


@pytest.mark.asyncio
async def test_api_key_history_and_cascade_delete(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)
    with TestingSession() as db:
        domain = Domain(name="example.test", authorized=True)
        db.add(domain)
        db.flush()
        scan = Scan(domain_id=domain.id)
        db.add(scan)
        db.flush()
        db.add(Asset(domain_id=domain.id, hostname="example.test", fingerprint="x", data={}))
        db.add(
            Snapshot(
                scan_id=scan.id,
                domain_id=domain.id,
                subject_type="asset",
                subject_key="example.test",
                state="NEW",
                fingerprint="x",
                data={},
            )
        )
        db.commit()
        domain_id = domain.id

    def override_db():
        with TestingSession() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    monkeypatch.setattr(settings, "api_key", "test-secret-value")
    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    try:
        assert (await client.get("/api/domains")).status_code == 401
        headers = {"X-SpoofScope-Key": "test-secret-value"}
        response = await client.get(f"/api/domains/{domain_id}/history", headers=headers)
        assert response.status_code == 200
        assert response.json()[0]["subject_key"] == "example.test"
        assert (
            await client.delete(f"/api/domains/{domain_id}", headers=headers)
        ).status_code == 204
        with TestingSession() as db:
            assert db.get(Domain, domain_id) is None
            assert db.scalar(select(Snapshot)) is None
        schema = (await client.get("/api/openapi.json", headers=headers)).json()
        assert schema["components"]["securitySchemes"]["ApiKey"]["name"] == "X-SpoofScope-Key"
    finally:
        await client.aclose()
        app.dependency_overrides.clear()
