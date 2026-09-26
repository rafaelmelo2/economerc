import datetime as dt
import uuid
from decimal import Decimal

from asyncpg import Connection

from api.repositories.catalog.product_repository import NewProduct, product_repository
from api.repositories.geo.city_repository import city_repository
from api.repositories.markets.market_repository import NewMarket, market_repository
from api.repositories.prices.price_repository import NewPriceObservation, price_repository

CATALAO_IBGE_CODE = 5205109


async def _setup(conn: Connection):
    city = await city_repository.get_by_ibge_code(conn, CATALAO_IBGE_CODE)
    product = await product_repository.create(conn, NewProduct(name="Produto de teste de preço"))
    market_a = await market_repository.create(
        conn, NewMarket(city_id=city["id"], trade_name="Mercado A de preço")
    )
    market_b = await market_repository.create(
        conn, NewMarket(city_id=city["id"], trade_name="Mercado B de preço")
    )
    return city["id"], product["id"], market_a["id"], market_b["id"]


async def test_get_latest_by_market_returns_most_recent_per_market(db_conn: Connection):
    city_id, product_id, market_a, market_b = await _setup(db_conn)
    now = dt.datetime.now(dt.UTC)

    await price_repository.create(
        db_conn,
        NewPriceObservation(
            product_id=product_id,
            market_id=market_a,
            city_id=city_id,
            amount=Decimal("9.50"),
            source="manual",
            confidence=Decimal("0.40"),
            observed_at=now - dt.timedelta(days=5),
        ),
    )
    latest_a = await price_repository.create(
        db_conn,
        NewPriceObservation(
            product_id=product_id,
            market_id=market_a,
            city_id=city_id,
            amount=Decimal("10.00"),
            source="manual",
            confidence=Decimal("0.40"),
            observed_at=now,
        ),
    )
    latest_b = await price_repository.create(
        db_conn,
        NewPriceObservation(
            product_id=product_id,
            market_id=market_b,
            city_id=city_id,
            amount=Decimal("11.00"),
            source="community",
            confidence=Decimal("0.60"),
            observed_at=now,
        ),
    )

    rows = await price_repository.get_latest_by_market(db_conn, product_id, city_id)
    by_market = {row["market_id"]: row for row in rows}
    assert len(rows) == 2
    assert by_market[market_a]["id"] == latest_a["id"]
    assert by_market[market_a]["amount"] == Decimal("10.00")
    assert by_market[market_b]["id"] == latest_b["id"]
    assert by_market[market_b]["market_name"] == "Mercado B de preço"


async def test_get_latest_by_market_empty_when_no_observations(db_conn: Connection):
    city_id, product_id, _, _ = await _setup(db_conn)
    rows = await price_repository.get_latest_by_market(db_conn, product_id, city_id)
    assert rows == []


async def test_create_is_idempotent_by_reported_by_and_client_id(db_conn: Connection):
    city_id, product_id, market_a, _ = await _setup(db_conn)
    reported_by = uuid.uuid4()
    await db_conn.execute("INSERT INTO users (id, role) VALUES ($1, 'user')", reported_by)
    client_id = uuid.uuid4()
    observed_at = dt.datetime.now(dt.UTC)

    first = await price_repository.create(
        db_conn,
        NewPriceObservation(
            product_id=product_id,
            market_id=market_a,
            city_id=city_id,
            amount=Decimal("7.00"),
            source="community",
            confidence=Decimal("0.60"),
            observed_at=observed_at,
            reported_by=reported_by,
            client_id=client_id,
        ),
    )
    second = await price_repository.create(
        db_conn,
        NewPriceObservation(
            product_id=product_id,
            market_id=market_a,
            city_id=city_id,
            amount=Decimal("999.00"),
            source="community",
            confidence=Decimal("0.60"),
            observed_at=observed_at,
            reported_by=reported_by,
            client_id=client_id,
        ),
    )
    assert first["id"] == second["id"]
    assert second["amount"] == Decimal("7.00")

    rows = await db_conn.fetch(
        "SELECT id FROM prices WHERE reported_by = $1 AND client_id = $2", reported_by, client_id
    )
    assert len(rows) == 1
