from fastapi import status
from httpx import AsyncClient


async def test_health_returns_200_with_database_ok(client: AsyncClient):
    res = await client.get("/api/health")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["dependencies"]["database"] == "ok"
    assert "valkey" in data["dependencies"]
    assert "nats" in data["dependencies"]
    assert data["status"] in ("healthy", "degraded")
