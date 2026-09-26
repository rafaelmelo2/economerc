"""`GET/POST /api/admin/offer-candidates` (bloco 4C) — revisão da fila de ofertas."""

from decimal import Decimal
from uuid import uuid4

from asyncpg import Connection
from httpx import AsyncClient

from api.repositories.catalog.product_repository import NewProduct, product_repository
from api.repositories.collectors.market_source_repository import (
    NewMarketSource,
    market_source_repository,
)
from api.repositories.collectors.offer_candidate_repository import (
    NewOfferCandidate,
    offer_candidate_repository,
)
from api.repositories.geo.city_repository import city_repository
from api.repositories.markets.market_repository import NewMarket, market_repository

CATALAO_IBGE_CODE = 5205109


async def _seed_market_and_source(conn: Connection) -> tuple[dict, dict]:
    city = await city_repository.get_by_ibge_code(conn, CATALAO_IBGE_CODE)
    market = await market_repository.create(
        conn, NewMarket(city_id=city["id"], trade_name=f"Mercado teste {uuid4().hex[:8]}")
    )
    source = await market_source_repository.create(
        conn,
        NewMarketSource(
            market_id=market["id"],
            kind="whatsapp_group",
            identifier=f"{uuid4().hex}@g.us",
        ),
    )
    return market, source


async def _seed_candidate(conn: Connection, market: dict, source: dict, **overrides) -> dict:
    fields = {
        "market_id": market["id"],
        "market_source_id": source["id"],
        "product_name": "Arroz Tio João 5kg",
        "price_amount": Decimal("24.99"),
        "source": "whatsapp_group",
        "unit": None,
        "ean": None,
        "raw_text": "Arroz Tio João 5kg R$ 24,99",
        "raw_payload": {"message_id": "MSG1"},
    }
    fields.update(overrides)
    return await offer_candidate_repository.create(conn, NewOfferCandidate(**fields))


async def test_list_offer_candidates_requires_auth(client: AsyncClient):
    res = await client.get("/api/admin/offer-candidates")
    assert res.status_code == 401


async def test_list_offer_candidates_requires_admin_role(client: AsyncClient, bearer):
    res = await client.get("/api/admin/offer-candidates", headers=await bearer("user"))
    assert res.status_code == 403


async def test_list_offer_candidates_returns_pending_by_default(
    client: AsyncClient, db_conn: Connection, bearer
):
    market, source = await _seed_market_and_source(db_conn)
    await _seed_candidate(db_conn, market, source)

    res = await client.get(
        "/api/admin/offer-candidates", params={"status": "pending"}, headers=await bearer("admin")
    )

    assert res.status_code == 200
    body = res.json()
    assert body["total"] >= 1
    assert any(item["product_name"] == "Arroz Tio João 5kg" for item in body["items"])


async def test_list_offer_candidates_filters_by_market_id(
    client: AsyncClient, db_conn: Connection, bearer
):
    market_a, source_a = await _seed_market_and_source(db_conn)
    market_b, source_b = await _seed_market_and_source(db_conn)
    await _seed_candidate(db_conn, market_a, source_a, product_name="Produto A")
    await _seed_candidate(db_conn, market_b, source_b, product_name="Produto B")

    res = await client.get(
        "/api/admin/offer-candidates",
        params={"market_id": str(market_a["id"])},
        headers=await bearer("admin"),
    )

    assert res.status_code == 200
    body = res.json()
    assert all(item["market_id"] == str(market_a["id"]) for item in body["items"])
    assert any(item["product_name"] == "Produto A" for item in body["items"])


async def test_list_offer_candidates_empty_result(client: AsyncClient, bearer):
    res = await client.get(
        "/api/admin/offer-candidates",
        params={"market_id": str(uuid4())},
        headers=await bearer("admin"),
    )
    assert res.status_code == 200
    assert res.json()["items"] == []


async def test_approve_offer_candidate_creates_price_and_updates_status(
    client: AsyncClient, db_conn: Connection, bearer
):
    market, source = await _seed_market_and_source(db_conn)
    product = await product_repository.create(db_conn, NewProduct(name="Arroz Tio João 5kg"))
    candidate = await _seed_candidate(db_conn, market, source)

    res = await client.post(
        f"/api/admin/offer-candidates/{candidate['id']}/approve",
        json={"product_id": str(product["id"])},
        headers=await bearer("admin"),
    )

    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "approved"

    price_row = await db_conn.fetchrow(
        "SELECT * FROM prices WHERE product_id = $1 AND market_id = $2", product["id"], market["id"]
    )
    assert price_row is not None
    assert price_row["amount"] == Decimal("24.99")
    assert price_row["source"] == "flyer"


async def test_approve_offer_candidate_resolves_product_by_ean(
    client: AsyncClient, db_conn: Connection, bearer
):
    market, source = await _seed_market_and_source(db_conn)
    product = await product_repository.create(
        db_conn, NewProduct(name="Feijão Carioca 1kg", ean="7891234567895")
    )
    candidate = await _seed_candidate(db_conn, market, source, ean="7891234567895")

    res = await client.post(
        f"/api/admin/offer-candidates/{candidate['id']}/approve",
        json={},
        headers=await bearer("admin"),
    )

    assert res.status_code == 200
    price_row = await db_conn.fetchrow("SELECT * FROM prices WHERE product_id = $1", product["id"])
    assert price_row is not None


async def test_approve_offer_candidate_without_product_or_ean_returns_400(
    client: AsyncClient, db_conn: Connection, bearer
):
    market, source = await _seed_market_and_source(db_conn)
    candidate = await _seed_candidate(db_conn, market, source)

    res = await client.post(
        f"/api/admin/offer-candidates/{candidate['id']}/approve",
        json={},
        headers=await bearer("admin"),
    )

    assert res.status_code == 400


async def test_approve_offer_candidate_twice_returns_400(
    client: AsyncClient, db_conn: Connection, bearer
):
    market, source = await _seed_market_and_source(db_conn)
    product = await product_repository.create(db_conn, NewProduct(name="Produto Repetido"))
    candidate = await _seed_candidate(db_conn, market, source)
    headers = await bearer("admin")

    first = await client.post(
        f"/api/admin/offer-candidates/{candidate['id']}/approve",
        json={"product_id": str(product["id"])},
        headers=headers,
    )
    assert first.status_code == 200

    second = await client.post(
        f"/api/admin/offer-candidates/{candidate['id']}/approve",
        json={"product_id": str(product["id"])},
        headers=headers,
    )
    assert second.status_code == 400


async def test_approve_offer_candidate_not_found_returns_404(client: AsyncClient, bearer):
    res = await client.post(
        f"/api/admin/offer-candidates/{uuid4()}/approve",
        json={"product_id": str(uuid4())},
        headers=await bearer("admin"),
    )
    assert res.status_code == 404


async def test_reject_offer_candidate_updates_status_without_creating_price(
    client: AsyncClient, db_conn: Connection, bearer
):
    market, source = await _seed_market_and_source(db_conn)
    candidate = await _seed_candidate(db_conn, market, source)

    res = await client.post(
        f"/api/admin/offer-candidates/{candidate['id']}/reject", headers=await bearer("admin")
    )

    assert res.status_code == 200
    assert res.json()["status"] == "rejected"
    prices_count = await db_conn.fetchval(
        "SELECT COUNT(*) FROM prices WHERE market_id = $1", market["id"]
    )
    assert prices_count == 0


async def test_reject_offer_candidate_not_found_returns_404(client: AsyncClient, bearer):
    res = await client.post(
        f"/api/admin/offer-candidates/{uuid4()}/reject", headers=await bearer("admin")
    )
    assert res.status_code == 404
