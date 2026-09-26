"""Fechar carrinho vira preço da comunidade (bloco 6 — "o preço de cada mercado disponível pra
todas as pessoas", `docs/produto.md`). Banco real; `POST /sync/push` ponta a ponta.
"""

from decimal import Decimal
from uuid import uuid4

from asyncpg import Connection
from fastapi import status
from httpx import AsyncClient

from api.repositories.catalog.product_repository import NewProduct, product_repository
from api.repositories.geo.city_repository import city_repository
from api.repositories.markets.market_repository import NewMarket, market_repository
from tests.sync_helpers import auth_headers, create_test_user, iso

CATALAO_IBGE_CODE = 5205109


async def _seed_market(conn: Connection):
    city = await city_repository.get_by_ibge_code(conn, CATALAO_IBGE_CODE)
    market = await market_repository.create(
        conn, NewMarket(city_id=city["id"], trade_name="Mercado do Bloco 6")
    )
    return city["id"], market


async def _seed_product(conn: Connection, ean: str = "7891234500014"):
    return await product_repository.create(
        conn, NewProduct(ean=ean, name="Produto do bloco 6", unit="un")
    )


async def _push_open_cart_with_market(
    client: AsyncClient, headers: dict, cart_client_id: str, market_id
) -> None:
    res = await client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "entity": "cart",
                    "op": "upsert",
                    "client_id": cart_client_id,
                    "updated_at": iso(0),
                    "fields": {"status": "open", "market_id": str(market_id)},
                }
            ]
        },
        headers=headers,
    )
    assert res.status_code == status.HTTP_200_OK


async def _push_item(
    client: AsyncClient,
    headers: dict,
    cart_client_id: str,
    item_client_id: str,
    *,
    product_id,
    unit_price: str,
    offset_seconds: int,
) -> None:
    res = await client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "entity": "cart_item",
                    "op": "upsert",
                    "client_id": item_client_id,
                    "updated_at": iso(offset_seconds),
                    "fields": {
                        "cart_client_id": cart_client_id,
                        "product_id": str(product_id),
                        "product_name": "Produto do bloco 6",
                        "unit_price": unit_price,
                        "quantity": "1",
                        "unit": "un",
                    },
                }
            ]
        },
        headers=headers,
    )
    assert res.status_code == status.HTTP_200_OK


async def _close_cart(client: AsyncClient, headers: dict, cart_client_id: str, offset_seconds: int):
    return await client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "entity": "cart",
                    "op": "upsert",
                    "client_id": cart_client_id,
                    "updated_at": iso(offset_seconds),
                    "fields": {"status": "closed", "closed_at": iso(offset_seconds)},
                }
            ]
        },
        headers=headers,
    )


async def test_closing_cart_generates_one_community_price_per_item(
    client: AsyncClient, db_conn: Connection
):
    user_id = await create_test_user(db_conn)
    headers = auth_headers(user_id)
    city_id, market = await _seed_market(db_conn)
    product_a = await _seed_product(db_conn, "7891234500021")
    product_b = await _seed_product(db_conn, "7891234500038")
    cart_client_id = str(uuid4())

    await _push_open_cart_with_market(client, headers, cart_client_id, market["id"])
    await _push_item(
        client,
        headers,
        cart_client_id,
        str(uuid4()),
        product_id=product_a["id"],
        unit_price="12.49",
        offset_seconds=1,
    )
    await _push_item(
        client,
        headers,
        cart_client_id,
        str(uuid4()),
        product_id=product_b["id"],
        unit_price="8.00",
        offset_seconds=2,
    )

    close_res = await _close_cart(client, headers, cart_client_id, offset_seconds=10)
    assert close_res.json()["results"][0]["status"] == "applied"

    prices = await db_conn.fetch(
        "SELECT product_id, amount, source, confidence, city_id, reported_by, observed_at "
        "FROM prices WHERE market_id = $1 ORDER BY amount",
        market["id"],
    )
    assert len(prices) == 2
    assert {str(p["product_id"]) for p in prices} == {str(product_a["id"]), str(product_b["id"])}
    for price in prices:
        assert price["source"] == "community"
        assert price["confidence"] == Decimal("0.60")
        assert price["city_id"] == city_id
        assert price["reported_by"] == user_id


async def test_resending_the_same_closing_batch_does_not_duplicate_prices(
    client: AsyncClient, db_conn: Connection
):
    user_id = await create_test_user(db_conn)
    headers = auth_headers(user_id)
    _, market = await _seed_market(db_conn)
    product = await _seed_product(db_conn)
    cart_client_id = str(uuid4())
    item_client_id = str(uuid4())

    await _push_open_cart_with_market(client, headers, cart_client_id, market["id"])
    await _push_item(
        client,
        headers,
        cart_client_id,
        item_client_id,
        product_id=product["id"],
        unit_price="19.90",
        offset_seconds=1,
    )

    close_payload = {
        "mutations": [
            {
                "entity": "cart",
                "op": "upsert",
                "client_id": cart_client_id,
                "updated_at": iso(10),
                "fields": {"status": "closed", "closed_at": iso(10)},
            }
        ]
    }
    first = await client.post("/api/sync/push", json=close_payload, headers=headers)
    second = await client.post("/api/sync/push", json=close_payload, headers=headers)
    assert first.json()["results"][0]["status"] == "applied"
    assert second.json()["results"][0]["status"] == "ignored_stale"

    # Reenviar o upsert do ITEM depois do carrinho já fechado (retry de rede do app) também
    # não duplica — client_id do preço é o mesmo client_id do item.
    resend_item = await client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "entity": "cart_item",
                    "op": "upsert",
                    "client_id": item_client_id,
                    "updated_at": iso(1),
                    "fields": {"unit_price": "19.90"},
                }
            ]
        },
        headers=headers,
    )
    assert resend_item.status_code == status.HTTP_200_OK

    count = await db_conn.fetchval(
        "SELECT COUNT(*) FROM prices WHERE market_id = $1 AND product_id = $2",
        market["id"],
        product["id"],
    )
    assert count == 1


async def test_cart_without_market_does_not_generate_price(
    client: AsyncClient, db_conn: Connection
):
    user_id = await create_test_user(db_conn)
    headers = auth_headers(user_id)
    product = await _seed_product(db_conn)
    cart_client_id = str(uuid4())
    item_client_id = str(uuid4())

    await client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "entity": "cart",
                    "op": "upsert",
                    "client_id": cart_client_id,
                    "updated_at": iso(0),
                    "fields": {"status": "open"},
                }
            ]
        },
        headers=headers,
    )
    await _push_item(
        client,
        headers,
        cart_client_id,
        item_client_id,
        product_id=product["id"],
        unit_price="5.00",
        offset_seconds=1,
    )

    close_res = await _close_cart(client, headers, cart_client_id, offset_seconds=10)
    assert close_res.json()["results"][0]["status"] == "applied"

    count = await db_conn.fetchval("SELECT COUNT(*) FROM prices WHERE reported_by = $1", user_id)
    assert count == 0


async def test_item_without_product_id_does_not_generate_price(
    client: AsyncClient, db_conn: Connection
):
    user_id = await create_test_user(db_conn)
    headers = auth_headers(user_id)
    _, market = await _seed_market(db_conn)
    cart_client_id = str(uuid4())
    item_client_id = str(uuid4())

    await _push_open_cart_with_market(client, headers, cart_client_id, market["id"])
    res = await client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "entity": "cart_item",
                    "op": "upsert",
                    "client_id": item_client_id,
                    "updated_at": iso(1),
                    "fields": {
                        "cart_client_id": cart_client_id,
                        "product_name": "Tomate a granel",
                        "unit_price": "7.90",
                        "quantity": "1.5",
                        "unit": "kg",
                    },
                }
            ]
        },
        headers=headers,
    )
    assert res.json()["results"][0]["status"] == "applied"

    close_res = await _close_cart(client, headers, cart_client_id, offset_seconds=10)
    assert close_res.json()["results"][0]["status"] == "applied"

    count = await db_conn.fetchval("SELECT COUNT(*) FROM prices WHERE market_id = $1", market["id"])
    assert count == 0


async def test_another_user_in_the_same_city_sees_the_community_price_via_get_prices(
    client: AsyncClient, db_conn: Connection
):
    shopper_id = await create_test_user(db_conn)
    shopper_headers = auth_headers(shopper_id)
    city_id, market = await _seed_market(db_conn)
    product = await _seed_product(db_conn)
    cart_client_id = str(uuid4())

    await _push_open_cart_with_market(client, shopper_headers, cart_client_id, market["id"])
    await _push_item(
        client,
        shopper_headers,
        cart_client_id,
        str(uuid4()),
        product_id=product["id"],
        unit_price="12.49",
        offset_seconds=1,
    )
    await _close_cart(client, shopper_headers, cart_client_id, offset_seconds=10)

    other_user_id = await create_test_user(db_conn)
    other_headers = auth_headers(other_user_id)
    listed = await client.get(
        "/api/prices",
        params={"ean": product["ean"], "city_id": str(city_id)},
        headers=other_headers,
    )
    assert listed.status_code == 200
    [observation] = listed.json()
    assert observation["market_id"] == str(market["id"])
    assert observation["amount"] == "12.49"
    assert observation["source"] == "community"
