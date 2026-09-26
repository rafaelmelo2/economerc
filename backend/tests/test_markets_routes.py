import uuid

from asyncpg import Connection
from httpx import AsyncClient

from api.core.security import issue_access_token
from api.repositories.geo.city_repository import city_repository

CATALAO_IBGE_CODE = 5205109


def _bearer(role: str = "user") -> dict[str, str]:
    token = issue_access_token(uuid.uuid4(), role)
    return {"Authorization": f"Bearer {token}"}


async def test_list_markets_requires_auth(client: AsyncClient):
    res = await client.get("/api/markets")
    assert res.status_code == 401


async def test_list_markets_by_city_returns_seeded_three(client: AsyncClient, db_conn: Connection):
    city = await city_repository.get_by_ibge_code(db_conn, CATALAO_IBGE_CODE)
    res = await client.get("/api/markets", params={"city_id": str(city["id"])}, headers=_bearer())
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 3
    names = {m["trade_name"] for m in body["items"]}
    assert names == {"Supermercado Catalão", "Pontal Atacado e Varejo", "Rio Vermelho Atacadista"}


async def test_list_markets_empty_for_unknown_city(client: AsyncClient):
    res = await client.get("/api/markets", params={"city_id": str(uuid.uuid4())}, headers=_bearer())
    assert res.status_code == 200
    body = res.json()
    assert body["items"] == []
    assert body["total"] == 0


async def test_create_market_requires_admin(client: AsyncClient, db_conn: Connection):
    city = await city_repository.get_by_ibge_code(db_conn, CATALAO_IBGE_CODE)
    res = await client.post(
        "/api/markets",
        json={"city_id": str(city["id"]), "trade_name": "Mercado Não Autorizado"},
        headers=_bearer("user"),
    )
    assert res.status_code == 403


async def test_admin_market_crud_lifecycle(client: AsyncClient, db_conn: Connection):
    city = await city_repository.get_by_ibge_code(db_conn, CATALAO_IBGE_CODE)
    admin_headers = _bearer("admin")

    created = await client.post(
        "/api/markets",
        json={"city_id": str(city["id"]), "trade_name": "Mercado Novo"},
        headers=admin_headers,
    )
    assert created.status_code == 201
    market_id = created.json()["id"]

    updated = await client.patch(
        f"/api/markets/{market_id}", json={"is_partner": True}, headers=admin_headers
    )
    assert updated.status_code == 200
    assert updated.json()["is_partner"] is True

    deleted = await client.delete(f"/api/markets/{market_id}", headers=admin_headers)
    assert deleted.status_code == 204

    after_delete = await client.get(f"/api/markets/{market_id}", headers=admin_headers)
    assert after_delete.status_code == 404
