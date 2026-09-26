"""`GET /api/admin/prices` (bloco 5B) — último preço por (produto, mercado), com `is_stale`."""

import datetime as dt
from decimal import Decimal

from asyncpg import Connection
from httpx import AsyncClient

from api.repositories.catalog.product_repository import NewProduct, product_repository
from api.repositories.geo.city_repository import city_repository
from api.repositories.markets.market_repository import NewMarket, market_repository
from api.repositories.prices.price_repository import NewPriceObservation, price_repository

CATALAO_IBGE_CODE = 5205109
STALE_AFTER_DAYS = 15


async def _seed_product_and_market(conn: Connection, suffix: str):
    city = await city_repository.get_by_ibge_code(conn, CATALAO_IBGE_CODE)
    product = await product_repository.create(
        conn, NewProduct(ean=f"789000000{suffix}", name=f"Produto admin {suffix}")
    )
    market = await market_repository.create(
        conn, NewMarket(city_id=city["id"], trade_name=f"Mercado admin {suffix}")
    )
    return city["id"], product, market


async def _price(conn, city_id, product, market, *, amount, observed_at, source="manual"):
    return await price_repository.create(
        conn,
        NewPriceObservation(
            product_id=product["id"],
            market_id=market["id"],
            city_id=city_id,
            amount=amount,
            source=source,
            confidence=Decimal("1.0"),
            observed_at=observed_at,
        ),
    )


async def test_list_admin_prices_requires_admin_role(client: AsyncClient, bearer):
    res = await client.get("/api/admin/prices", headers=await bearer("user"))
    assert res.status_code == 403


async def test_list_admin_prices_returns_latest_observation_per_market(
    client: AsyncClient, db_conn: Connection, bearer
):
    city_id, product, market = await _seed_product_and_market(db_conn, "1")
    now = dt.datetime.now(dt.UTC)
    await _price(
        db_conn,
        city_id,
        product,
        market,
        amount=Decimal("9.00"),
        observed_at=now - dt.timedelta(days=5),
    )
    await _price(db_conn, city_id, product, market, amount=Decimal("10.00"), observed_at=now)

    res = await client.get(
        "/api/admin/prices",
        params={"product_id": str(product["id"])},
        headers=await bearer("admin"),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["amount"] == "10.00"
    assert body["items"][0]["is_stale"] is False


async def test_list_admin_prices_flags_stale_after_15_days(
    client: AsyncClient, db_conn: Connection, bearer
):
    city_id, product, market = await _seed_product_and_market(db_conn, "2")
    stale_at = dt.datetime.now(dt.UTC) - dt.timedelta(days=STALE_AFTER_DAYS + 1)
    await _price(db_conn, city_id, product, market, amount=Decimal("5.00"), observed_at=stale_at)

    res = await client.get(
        "/api/admin/prices",
        params={"product_id": str(product["id"]), "stale_only": True},
        headers=await bearer("admin"),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["is_stale"] is True


async def test_list_admin_prices_filters_by_source(
    client: AsyncClient, db_conn: Connection, bearer
):
    city_id, product, market = await _seed_product_and_market(db_conn, "3")
    now = dt.datetime.now(dt.UTC)
    await _price(
        db_conn, city_id, product, market, amount=Decimal("3.00"), observed_at=now, source="nfce"
    )

    res = await client.get(
        "/api/admin/prices",
        params={"product_id": str(product["id"]), "source": "manual"},
        headers=await bearer("admin"),
    )
    assert res.status_code == 200
    assert res.json()["total"] == 0
