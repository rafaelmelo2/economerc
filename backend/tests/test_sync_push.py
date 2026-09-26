from uuid import uuid4

from asyncpg import Connection
from fastapi import status
from httpx import AsyncClient

from tests.sync_helpers import auth_headers, create_test_user, iso


async def test_push_creates_cart_applied_and_persisted(client: AsyncClient, db_conn: Connection):
    user_id = await create_test_user(db_conn)
    cart_client_id = str(uuid4())

    res = await client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "entity": "cart",
                    "op": "upsert",
                    "client_id": cart_client_id,
                    "updated_at": iso(0),
                    "fields": {"status": "open", "budget": "300.00"},
                }
            ]
        },
        headers=auth_headers(user_id),
    )

    assert res.status_code == status.HTTP_200_OK
    result = res.json()["results"][0]
    assert result["client_id"] == cart_client_id
    assert result["status"] == "applied"
    assert result["reason"] is None
    assert result["updated_at"] is not None

    row = await db_conn.fetchrow(
        "SELECT budget, status FROM carts WHERE user_id = $1 AND client_id = $2",
        user_id,
        cart_client_id,
    )
    assert str(row["budget"]) == "300.00"
    assert row["status"] == "open"


async def test_push_same_batch_twice_creates_row_only_once(
    client: AsyncClient, db_conn: Connection
):
    user_id = await create_test_user(db_conn)
    cart_client_id = str(uuid4())
    batch = {
        "mutations": [
            {
                "entity": "cart",
                "op": "upsert",
                "client_id": cart_client_id,
                "updated_at": iso(0),
                "fields": {"status": "open", "budget": "300.00"},
            }
        ]
    }

    first = await client.post("/api/sync/push", json=batch, headers=auth_headers(user_id))
    second = await client.post("/api/sync/push", json=batch, headers=auth_headers(user_id))

    assert first.json()["results"][0]["status"] == "applied"
    assert second.json()["results"][0]["status"] == "ignored_stale"

    count = await db_conn.fetchval(
        "SELECT COUNT(*) FROM carts WHERE user_id = $1 AND client_id = $2", user_id, cart_client_id
    )
    assert count == 1


async def test_push_cart_item_resolves_cart_by_client_id_in_same_batch(
    client: AsyncClient, db_conn: Connection
):
    user_id = await create_test_user(db_conn)
    cart_client_id = str(uuid4())
    item_client_id = str(uuid4())

    res = await client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "entity": "cart",
                    "op": "upsert",
                    "client_id": cart_client_id,
                    "updated_at": iso(0),
                    "fields": {"status": "open"},
                },
                {
                    "entity": "cart_item",
                    "op": "upsert",
                    "client_id": item_client_id,
                    "updated_at": iso(1),
                    "fields": {
                        "cart_client_id": cart_client_id,
                        "product_name": "Arroz 5kg",
                        "unit_price": "24.90",
                        "quantity": "1",
                        "unit": "un",
                    },
                },
            ]
        },
        headers=auth_headers(user_id),
    )

    assert res.status_code == status.HTTP_200_OK
    statuses = [r["status"] for r in res.json()["results"]]
    assert statuses == ["applied", "applied"]

    row = await db_conn.fetchrow(
        "SELECT cart_id, product_name, unit_price FROM cart_items "
        "WHERE user_id = $1 AND client_id = $2",
        user_id,
        item_client_id,
    )
    cart_id = await db_conn.fetchval(
        "SELECT id FROM carts WHERE user_id = $1 AND client_id = $2", user_id, cart_client_id
    )
    assert row["cart_id"] == cart_id
    assert row["product_name"] == "Arroz 5kg"
    assert str(row["unit_price"]) == "24.90"


async def test_push_cart_item_without_cart_is_rejected(client: AsyncClient, db_conn: Connection):
    user_id = await create_test_user(db_conn)
    res = await client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "entity": "cart_item",
                    "op": "upsert",
                    "client_id": str(uuid4()),
                    "updated_at": iso(0),
                    "fields": {
                        "cart_client_id": str(uuid4()),
                        "product_name": "Arroz 5kg",
                        "unit_price": "24.90",
                    },
                }
            ]
        },
        headers=auth_headers(user_id),
    )
    assert res.status_code == status.HTTP_200_OK
    result = res.json()["results"][0]
    assert result["status"] == "rejected"
    assert "carrinho" in result["reason"]


async def test_push_cart_item_missing_required_field_is_rejected(
    client: AsyncClient, db_conn: Connection
):
    user_id = await create_test_user(db_conn)
    cart_client_id = str(uuid4())
    await client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "entity": "cart",
                    "op": "upsert",
                    "client_id": cart_client_id,
                    "updated_at": iso(0),
                    "fields": {},
                }
            ]
        },
        headers=auth_headers(user_id),
    )

    res = await client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "entity": "cart_item",
                    "op": "upsert",
                    "client_id": str(uuid4()),
                    "updated_at": iso(1),
                    "fields": {"cart_client_id": cart_client_id, "product_name": "Sem preço"},
                }
            ]
        },
        headers=auth_headers(user_id),
    )
    result = res.json()["results"][0]
    assert result["status"] == "rejected"
    assert "unit_price" in result["reason"]


async def test_push_field_level_lww_keeps_newer_field_regardless_of_arrival_order(
    client: AsyncClient, db_conn: Connection
):
    """quantity mudou em t=2 (mais novo), price mudou em t=1 (mais antigo) —
    mesmo chegando quantity ANTES na segunda remessa, o valor de price antigo
    que chega DEPOIS (t=1) não pode sobrescrever o que já está mais avançado
    no tempo simulado (não se aplica aqui pq cada campo tem seu próprio
    relógio); o teste comprova que cada campo é comparado independentemente.
    """
    user_id = await create_test_user(db_conn)
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
                    "fields": {},
                },
                {
                    "entity": "cart_item",
                    "op": "upsert",
                    "client_id": item_client_id,
                    "updated_at": iso(1),
                    "fields": {
                        "cart_client_id": cart_client_id,
                        "product_name": "Feijão 1kg",
                        "unit_price": "8.00",
                        "quantity": "2",
                    },
                },
            ]
        },
        headers=auth_headers(user_id),
    )

    # t=5: só quantity muda (mais novo que t=1).
    await client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "entity": "cart_item",
                    "op": "upsert",
                    "client_id": item_client_id,
                    "updated_at": iso(5),
                    "fields": {"quantity": "3"},
                }
            ]
        },
        headers=auth_headers(user_id),
    )

    # t=3: unit_price tenta mudar, mas t=3 < t=5 já gravado em quantity — só
    # afeta o CAMPO unit_price, cuja última versão é t=1 (t=3 > t=1, vence).
    res = await client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "entity": "cart_item",
                    "op": "upsert",
                    "client_id": item_client_id,
                    "updated_at": iso(3),
                    "fields": {"unit_price": "9.50"},
                }
            ]
        },
        headers=auth_headers(user_id),
    )
    assert res.json()["results"][0]["status"] == "applied"

    # t=2: mais antigo que a versão gravada de quantity (t=5) — ignorado.
    stale = await client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "entity": "cart_item",
                    "op": "upsert",
                    "client_id": item_client_id,
                    "updated_at": iso(2),
                    "fields": {"quantity": "99"},
                }
            ]
        },
        headers=auth_headers(user_id),
    )
    assert stale.json()["results"][0]["status"] == "ignored_stale"

    row = await db_conn.fetchrow(
        "SELECT quantity, unit_price FROM cart_items WHERE user_id = $1 AND client_id = $2",
        user_id,
        item_client_id,
    )
    assert str(row["quantity"]) == "3.000"
    assert str(row["unit_price"]) == "9.50"


async def test_push_delete_then_late_upsert_does_not_resurrect(
    client: AsyncClient, db_conn: Connection
):
    user_id = await create_test_user(db_conn)
    cart_client_id = str(uuid4())

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
        headers=auth_headers(user_id),
    )

    delete_res = await client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "entity": "cart",
                    "op": "delete",
                    "client_id": cart_client_id,
                    "updated_at": iso(10),
                    "fields": {},
                }
            ]
        },
        headers=auth_headers(user_id),
    )
    assert delete_res.json()["results"][0]["status"] == "applied"

    # Upsert atrasado, timestamp ANTERIOR ao delete (t=5 < t=10) — chega
    # depois na rede (outbox reordenou), mas não pode ressuscitar o tombstone.
    late_upsert = await client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "entity": "cart",
                    "op": "upsert",
                    "client_id": cart_client_id,
                    "updated_at": iso(5),
                    "fields": {"status": "closed"},
                }
            ]
        },
        headers=auth_headers(user_id),
    )
    assert late_upsert.json()["results"][0]["status"] == "ignored_stale"

    row = await db_conn.fetchrow(
        "SELECT status, deleted_at FROM carts WHERE user_id = $1 AND client_id = $2",
        user_id,
        cart_client_id,
    )
    assert row["deleted_at"] is not None
    assert row["status"] == "open"


async def test_push_without_token_is_401(client: AsyncClient):
    res = await client.post("/api/sync/push", json={"mutations": []})
    assert res.status_code == status.HTTP_401_UNAUTHORIZED


async def test_push_empty_batch_is_422(client: AsyncClient, db_conn: Connection):
    user_id = await create_test_user(db_conn)
    res = await client.post("/api/sync/push", json={"mutations": []}, headers=auth_headers(user_id))
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


async def test_push_money_as_json_float_is_422(client: AsyncClient, db_conn: Connection):
    user_id = await create_test_user(db_conn)
    res = await client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "entity": "cart",
                    "op": "upsert",
                    "client_id": str(uuid4()),
                    "updated_at": iso(0),
                    "fields": {"budget": 300.0},
                }
            ]
        },
        headers=auth_headers(user_id),
    )
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


async def test_push_naive_updated_at_is_422(client: AsyncClient, db_conn: Connection):
    user_id = await create_test_user(db_conn)
    res = await client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "entity": "cart",
                    "op": "upsert",
                    "client_id": str(uuid4()),
                    "updated_at": "2026-09-20T12:00:00",
                    "fields": {},
                }
            ]
        },
        headers=auth_headers(user_id),
    )
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
