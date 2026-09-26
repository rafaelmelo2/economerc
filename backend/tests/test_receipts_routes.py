"""Testes de `POST/GET /receipts` — banco real, NATS mockado (`_fake_nats` abaixo).

Chaves de acesso válidas calculadas com o mesmo algoritmo mod11 do parser
(ver `tests/test_nfce_qr.py` para os detalhes de como foram geradas).
"""

import orjson
import pytest
from asyncpg import Connection
from httpx import AsyncClient

from api.core.nats_client import nats_client
from tests.sync_helpers import auth_headers, create_test_user

VALID_GO_KEY = "52250911222333000181650010001234561123456786"
VALID_GO_KEY_2 = "52250998765432000199650010000000421876543210"
NFE_MODEL_KEY = "52250911222333000181550010001234561123456783"

VALID_QR_TEXT = f"https://nfeweb.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe?p={VALID_GO_KEY}|3|1"
VALID_QR_TEXT_2 = (
    f"https://nfeweb.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe?p={VALID_GO_KEY_2}|3|1"
)


class _FakeJetStream:
    """Substitui `nats_client.get_jetstream()` — testes não dependem de um NATS de pé."""

    def __init__(self):
        self.published: list[tuple[str, bytes]] = []

    async def add_stream(self, **kwargs) -> None:
        return None

    async def publish(self, subject: str, payload: bytes) -> None:
        self.published.append((subject, payload))


@pytest.fixture
def fake_jetstream(monkeypatch):
    fake = _FakeJetStream()
    monkeypatch.setattr(nats_client, "get_jetstream", lambda: fake)
    return fake


async def test_create_receipt_requires_auth(client: AsyncClient, fake_jetstream):
    res = await client.post(
        "/api/receipts",
        json={"qr_text": VALID_QR_TEXT, "client_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert res.status_code == 401


async def test_create_receipt_invalid_qr_text_returns_400(
    client: AsyncClient, bearer, fake_jetstream
):
    res = await client.post(
        "/api/receipts",
        json={
            "qr_text": "isso não é um QR de NFC-e",
            "client_id": "11111111-1111-1111-1111-111111111111",
        },
        headers=await bearer(),
    )
    assert res.status_code == 400
    assert fake_jetstream.published == []


async def test_create_receipt_rejects_nfe_model_55(client: AsyncClient, bearer, fake_jetstream):
    res = await client.post(
        "/api/receipts",
        json={
            "qr_text": f"{NFE_MODEL_KEY}|3|1",
            "client_id": "22222222-2222-2222-2222-222222222222",
        },
        headers=await bearer(),
    )
    assert res.status_code == 400
    assert fake_jetstream.published == []


async def test_create_receipt_returns_202_and_publishes_to_nats(
    client: AsyncClient, bearer, fake_jetstream
):
    res = await client.post(
        "/api/receipts",
        json={"qr_text": VALID_QR_TEXT, "client_id": "33333333-3333-3333-3333-333333333333"},
        headers=await bearer(),
    )
    assert res.status_code == 202
    body = res.json()
    assert body["status"] == "pending"
    assert body["access_key"] == VALID_GO_KEY
    assert body["state_code"] == "GO"

    assert len(fake_jetstream.published) == 1
    subject, payload = fake_jetstream.published[0]
    assert subject == "receipts.ingest"
    assert orjson.loads(payload) == {"receipt_id": body["id"]}


async def test_create_receipt_is_idempotent_by_client_id(
    client: AsyncClient, bearer, fake_jetstream
):
    headers = await bearer()
    client_id = "44444444-4444-4444-4444-444444444444"
    first = await client.post(
        "/api/receipts", json={"qr_text": VALID_QR_TEXT, "client_id": client_id}, headers=headers
    )
    second = await client.post(
        "/api/receipts", json={"qr_text": VALID_QR_TEXT, "client_id": client_id}, headers=headers
    )
    assert first.status_code == 202
    assert second.status_code == 202
    assert first.json()["id"] == second.json()["id"]
    # Replay não republica no NATS — só a primeira chamada enfileira.
    assert len(fake_jetstream.published) == 1


async def test_create_receipt_duplicate_access_key_from_another_user_does_not_republish(
    client: AsyncClient, bearer, fake_jetstream
):
    first_user_headers = await bearer()
    second_user_headers = await bearer()

    first = await client.post(
        "/api/receipts",
        json={"qr_text": VALID_QR_TEXT, "client_id": "55555555-5555-5555-5555-555555555555"},
        headers=first_user_headers,
    )
    assert first.status_code == 202
    assert first.json()["status"] == "pending"

    second = await client.post(
        "/api/receipts",
        json={"qr_text": VALID_QR_TEXT, "client_id": "66666666-6666-6666-6666-666666666666"},
        headers=second_user_headers,
    )
    assert second.status_code == 202
    assert second.json()["status"] == "duplicate"
    assert second.json()["id"] != first.json()["id"]

    # Só a nota canônica (primeiro envio) foi publicada no NATS — a segunda não reprocessa.
    assert len(fake_jetstream.published) == 1


async def test_list_receipts_is_scoped_to_current_user(client: AsyncClient, bearer, fake_jetstream):
    mine_headers = await bearer()
    other_headers = await bearer()

    await client.post(
        "/api/receipts",
        json={"qr_text": VALID_QR_TEXT, "client_id": "77777777-7777-7777-7777-777777777777"},
        headers=mine_headers,
    )
    await client.post(
        "/api/receipts",
        json={"qr_text": VALID_QR_TEXT_2, "client_id": "88888888-8888-8888-8888-888888888888"},
        headers=other_headers,
    )

    res = await client.get("/api/receipts", headers=mine_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["access_key"] == VALID_GO_KEY


async def test_get_receipt_returns_items_and_404_for_other_users_receipt(
    client: AsyncClient, bearer, fake_jetstream
):
    owner_headers = await bearer()
    stranger_headers = await bearer()

    created = await client.post(
        "/api/receipts",
        json={"qr_text": VALID_QR_TEXT, "client_id": "99999999-9999-9999-9999-999999999999"},
        headers=owner_headers,
    )
    receipt_id = created.json()["id"]

    owner_res = await client.get(f"/api/receipts/{receipt_id}", headers=owner_headers)
    assert owner_res.status_code == 200
    assert owner_res.json()["items"] == []

    stranger_res = await client.get(f"/api/receipts/{receipt_id}", headers=stranger_headers)
    assert stranger_res.status_code == 404


async def test_get_receipt_exposes_friendly_failure_message_for_note_not_found(
    client: AsyncClient, db_conn: Connection
):
    """`failure_reason` (técnico, gravado pelo worker) NUNCA aparece pro usuário — a API
    também devolve `failure_message` amigável (`docs/brand/voz.md`), derivado na resposta."""
    user_id = await create_test_user(db_conn)
    receipt_id = await db_conn.fetchval(
        """
        INSERT INTO receipts (user_id, client_id, access_key, state_code, qr_url, status,
                               failure_reason, attempts)
        VALUES ($1, gen_random_uuid(), $2, 'GO', 'https://nfce.example/qr', 'failed', $3, 1)
        RETURNING id
        """,
        user_id,
        VALID_GO_KEY,
        "SEFAZ-GO: Não foi possível encontrar o XML da nota",
    )

    res = await client.get(f"/api/receipts/{receipt_id}", headers=auth_headers(user_id))

    assert res.status_code == 200
    body = res.json()
    assert body["failure_reason"] == "SEFAZ-GO: Não foi possível encontrar o XML da nota"
    assert body["failure_message"] == (
        "Não encontramos essa nota na SEFAZ. Confira se o QR é de um cupom fiscal de Goiás."
    )


async def test_get_receipt_failure_message_is_null_while_still_pending(
    client: AsyncClient, bearer, fake_jetstream
):
    owner_headers = await bearer()
    created = await client.post(
        "/api/receipts",
        json={"qr_text": VALID_QR_TEXT_2, "client_id": "88888888-8888-8888-8888-888888888888"},
        headers=owner_headers,
    )
    receipt_id = created.json()["id"]

    res = await client.get(f"/api/receipts/{receipt_id}", headers=owner_headers)
    assert res.status_code == 200
    assert res.json()["failure_message"] is None
