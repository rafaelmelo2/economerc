"""`GET /api/admin/receipts` + `POST /{id}/retry` (bloco 5B) — fila de notas com falha."""

import uuid

import pytest
from asyncpg import Connection
from httpx import AsyncClient

from api.core.nats_client import nats_client

STATE_CODE = "GO"


class _FakeJetStream:
    """Substitui `nats_client.get_jetstream()` — teste não depende de NATS de pé (mesmo padrão
    de `tests/test_receipts_routes.py`)."""

    async def add_stream(self, **kwargs) -> None:
        return None

    async def publish(self, subject: str, payload: bytes) -> None:
        return None


@pytest.fixture(autouse=True)
def _fake_jetstream(monkeypatch):
    monkeypatch.setattr(nats_client, "get_jetstream", lambda: _FakeJetStream())


async def _failed_receipt(conn: Connection, user_id: uuid.UUID, *, reason="timeout SEFAZ"):
    access_key = str(uuid.uuid4().int)[:44].ljust(44, "0")
    return await conn.fetchval(
        """
        INSERT INTO receipts (user_id, client_id, access_key, state_code, qr_url, status,
                               failure_reason, attempts)
        VALUES ($1, $2, $3, $4, 'https://nfce.example/qr', 'failed', $5, 1)
        RETURNING id
        """,
        user_id,
        uuid.uuid4(),
        access_key,
        STATE_CODE,
        reason,
    )


async def test_list_admin_receipts_requires_admin_role(client: AsyncClient, bearer):
    res = await client.get("/api/admin/receipts", headers=await bearer("user"))
    assert res.status_code == 403


async def test_list_admin_receipts_filters_by_failed_status(
    client: AsyncClient, db_conn: Connection, bearer
):
    headers = await bearer("admin")
    user_id = uuid.uuid4()
    await db_conn.execute("INSERT INTO users (id, role) VALUES ($1, 'user')", user_id)
    await _failed_receipt(db_conn, user_id)

    res = await client.get("/api/admin/receipts", params={"status": "failed"}, headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["total"] >= 1
    assert all(item["status"] == "failed" for item in body["items"])


async def test_retry_receipt_resets_to_pending_and_returns_updated_receipt(
    client: AsyncClient, db_conn: Connection, bearer
):
    headers = await bearer("admin")
    user_id = uuid.uuid4()
    await db_conn.execute("INSERT INTO users (id, role) VALUES ($1, 'user')", user_id)
    receipt_id = await _failed_receipt(db_conn, user_id)

    res = await client.post(f"/api/admin/receipts/{receipt_id}/retry", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "pending"
    assert body["failure_reason"] == "Reprocessamento manual pelo admin"


async def test_retry_receipt_not_failed_is_400(client: AsyncClient, db_conn: Connection, bearer):
    headers = await bearer("admin")
    user_id = uuid.uuid4()
    await db_conn.execute("INSERT INTO users (id, role) VALUES ($1, 'user')", user_id)
    access_key = str(uuid.uuid4().int)[:44].ljust(44, "0")
    receipt_id = await db_conn.fetchval(
        """
        INSERT INTO receipts (user_id, client_id, access_key, state_code, qr_url, status)
        VALUES ($1, $2, $3, $4, 'https://nfce.example/qr', 'done')
        RETURNING id
        """,
        user_id,
        uuid.uuid4(),
        access_key,
        STATE_CODE,
    )

    res = await client.post(f"/api/admin/receipts/{receipt_id}/retry", headers=headers)
    assert res.status_code == 400


async def test_retry_unknown_receipt_is_404(client: AsyncClient, bearer):
    res = await client.post(
        f"/api/admin/receipts/{uuid.uuid4()}/retry", headers=await bearer("admin")
    )
    assert res.status_code == 404
