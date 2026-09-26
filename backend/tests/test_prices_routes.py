import datetime as dt
import uuid
from decimal import Decimal

from asyncpg import Connection
from httpx import AsyncClient

from api.core.security import issue_access_token
from api.repositories.catalog.product_repository import NewProduct, product_repository
from api.repositories.geo.city_repository import city_repository
from api.repositories.markets.market_repository import NewMarket, market_repository

CATALAO_IBGE_CODE = 5205109
STALE_AFTER_DAYS = 15


async def _authenticated_headers(conn: Connection, role: str = "user") -> dict[str, str]:
    """`prices.reported_by` tem FK pra `users` — POST /prices precisa de um usuário real."""
    user_id = uuid.uuid4()
    await conn.execute("INSERT INTO users (id, role) VALUES ($1, $2)", user_id, role)
    token = issue_access_token(user_id, role)
    return {"Authorization": f"Bearer {token}"}


async def _seed_product_and_market(conn: Connection):
    city = await city_repository.get_by_ibge_code(conn, CATALAO_IBGE_CODE)
    product = await product_repository.create(
        conn,
        NewProduct(
            ean="4006381333931", name="Produto de preço", unit="kg", net_quantity=Decimal("1")
        ),
    )
    market = await market_repository.create(
        conn, NewMarket(city_id=city["id"], trade_name="Mercado de preço HTTP")
    )
    return city["id"], product, market


async def test_get_prices_requires_auth(client: AsyncClient):
    res = await client.get(
        "/api/prices", params={"ean": "4006381333931", "city_id": str(uuid.uuid4())}
    )
    assert res.status_code == 401


async def test_get_prices_invalid_ean_returns_400(client: AsyncClient, bearer):
    res = await client.get(
        "/api/prices", params={"ean": "12345", "city_id": str(uuid.uuid4())}, headers=await bearer()
    )
    assert res.status_code == 400


async def test_get_prices_unknown_product_returns_404(client: AsyncClient, bearer):
    res = await client.get(
        "/api/prices",
        params={"ean": "4006381333931", "city_id": str(uuid.uuid4())},
        headers=await bearer(),
    )
    assert res.status_code == 404


async def test_get_prices_empty_when_no_observations(
    client: AsyncClient, db_conn: Connection, bearer
):
    city_id, product, _ = await _seed_product_and_market(db_conn)
    res = await client.get(
        "/api/prices",
        params={"ean": product["ean"], "city_id": str(city_id)},
        headers=await bearer(),
    )
    assert res.status_code == 200
    assert res.json() == []


async def test_post_price_requires_auth(client: AsyncClient, db_conn: Connection):
    _, product, market = await _seed_product_and_market(db_conn)
    res = await client.post(
        "/api/prices",
        json={
            "product_id": str(product["id"]),
            "market_id": str(market["id"]),
            "amount": "9.99",
            "source": "manual",
        },
    )
    assert res.status_code == 401


async def test_post_price_unknown_market_returns_404(client: AsyncClient, db_conn: Connection):
    _, product, _ = await _seed_product_and_market(db_conn)
    headers = await _authenticated_headers(db_conn)
    res = await client.post(
        "/api/prices",
        json={
            "product_id": str(product["id"]),
            "market_id": str(uuid.uuid4()),
            "amount": "9.99",
            "source": "manual",
        },
        headers=headers,
    )
    assert res.status_code == 404


async def test_post_price_then_get_latest_returns_unit_price_and_not_stale(
    client: AsyncClient, db_conn: Connection
):
    city_id, product, market = await _seed_product_and_market(db_conn)
    headers = await _authenticated_headers(db_conn)

    created = await client.post(
        "/api/prices",
        json={
            "product_id": str(product["id"]),
            "market_id": str(market["id"]),
            "amount": "12.50",
            "source": "community",
        },
        headers=headers,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["confidence"] == "0.60"  # default de confiança da fonte 'community'
    assert body["reported_by"] is not None

    listed = await client.get(
        "/api/prices", params={"ean": product["ean"], "city_id": str(city_id)}, headers=headers
    )
    assert listed.status_code == 200
    [observation] = listed.json()
    assert observation["market_name"] == "Mercado de preço HTTP"
    assert observation["unit_label"] == "kg"
    assert observation["unit_amount"] == "12.5000"
    assert observation["is_stale"] is False


async def test_price_older_than_fifteen_days_is_stale(client: AsyncClient, db_conn: Connection):
    city_id, product, market = await _seed_product_and_market(db_conn)
    headers = await _authenticated_headers(db_conn)
    old_observed_at = dt.datetime.now(dt.UTC) - dt.timedelta(days=STALE_AFTER_DAYS + 1)

    await client.post(
        "/api/prices",
        json={
            "product_id": str(product["id"]),
            "market_id": str(market["id"]),
            "amount": "8.00",
            "source": "manual",
            "observed_at": old_observed_at.isoformat(),
        },
        headers=headers,
    )

    listed = await client.get(
        "/api/prices", params={"ean": product["ean"], "city_id": str(city_id)}, headers=headers
    )
    [observation] = listed.json()
    assert observation["is_stale"] is True


async def test_post_price_is_idempotent_by_client_id(client: AsyncClient, db_conn: Connection):
    _, product, market = await _seed_product_and_market(db_conn)
    headers = await _authenticated_headers(db_conn)
    client_id = str(uuid.uuid4())
    payload = {
        "product_id": str(product["id"]),
        "market_id": str(market["id"]),
        "amount": "5.00",
        "source": "community",
        "client_id": client_id,
    }

    first = await client.post("/api/prices", json=payload, headers=headers)
    second = await client.post("/api/prices", json=payload, headers=headers)

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
