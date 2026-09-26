from uuid import uuid4

from asyncpg import Connection
from fastapi import status
from httpx import AsyncClient

from tests.sync_helpers import auth_headers, create_test_user, iso


async def _push_cart(client: AsyncClient, user_id, client_id: str, offset: int, fields: dict):
    return await client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "entity": "cart",
                    "op": "upsert",
                    "client_id": client_id,
                    "updated_at": iso(offset),
                    "fields": fields,
                }
            ]
        },
        headers=auth_headers(user_id),
    )


async def test_pull_returns_change_after_push(client: AsyncClient, db_conn: Connection):
    user_id = await create_test_user(db_conn)
    cart_client_id = str(uuid4())
    await _push_cart(client, user_id, cart_client_id, 0, {"status": "open", "budget": "150.00"})

    res = await client.get("/api/sync/pull", headers=auth_headers(user_id))
    assert res.status_code == status.HTTP_200_OK
    body = res.json()
    assert body["has_more"] is False
    assert len(body["changes"]) == 1
    change = body["changes"][0]
    assert change["entity"] == "cart"
    assert change["op"] == "upsert"
    assert change["client_id"] == cart_client_id
    assert change["fields"]["status"] == "open"
    assert change["fields"]["budget"] == "150.00"
    assert body["next_cursor"]


async def test_pull_paginates_with_cursor_and_resumes_exactly(
    client: AsyncClient, db_conn: Connection
):
    user_id = await create_test_user(db_conn)
    client_ids = [str(uuid4()) for _ in range(5)]
    for index, cid in enumerate(client_ids):
        res = await _push_cart(client, user_id, cid, index, {"status": "open"})
        assert res.json()["results"][0]["status"] == "applied"

    collected: list[str] = []
    cursor = None
    for _ in range(10):  # guarda contra loop infinito em caso de bug
        params = {"limit": 2}
        if cursor:
            params["cursor"] = cursor
        page = await client.get("/api/sync/pull", params=params, headers=auth_headers(user_id))
        body = page.json()
        collected.extend(c["client_id"] for c in body["changes"])
        cursor = body["next_cursor"]
        if not body["has_more"]:
            break

    assert collected == client_ids

    # Cursor da última página, salvo pelo app, retoma exatamente vazio dali.
    resumed = await client.get(
        "/api/sync/pull", params={"cursor": cursor}, headers=auth_headers(user_id)
    )
    assert resumed.json()["changes"] == []
    assert resumed.json()["has_more"] is False


async def test_pull_is_isolated_between_users(client: AsyncClient, db_conn: Connection):
    user_a = await create_test_user(db_conn)
    user_b = await create_test_user(db_conn)
    await _push_cart(client, user_a, str(uuid4()), 0, {"status": "open"})

    res = await client.get("/api/sync/pull", headers=auth_headers(user_b))
    body = res.json()
    assert body["changes"] == []
    assert body["has_more"] is False


async def test_pull_includes_tombstone_for_delete(client: AsyncClient, db_conn: Connection):
    user_id = await create_test_user(db_conn)
    cart_client_id = str(uuid4())
    await _push_cart(client, user_id, cart_client_id, 0, {"status": "open"})
    await client.post(
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

    res = await client.get("/api/sync/pull", headers=auth_headers(user_id))
    changes = res.json()["changes"]
    assert len(changes) == 2
    assert changes[0]["op"] == "upsert"
    assert changes[1]["op"] == "delete"
    assert changes[1]["client_id"] == cart_client_id
    assert changes[1]["fields"] == {}


async def test_pull_without_token_is_401(client: AsyncClient):
    res = await client.get("/api/sync/pull")
    assert res.status_code == status.HTTP_401_UNAUTHORIZED


async def test_pull_invalid_cursor_is_400(client: AsyncClient, db_conn: Connection):
    user_id = await create_test_user(db_conn)
    res = await client.get(
        "/api/sync/pull", params={"cursor": "@@not-base64@@"}, headers=auth_headers(user_id)
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST
