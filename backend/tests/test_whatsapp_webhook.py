"""Webhook `POST /api/webhooks/whatsapp` (bloco 4C). NATS é real (stack local, `nats.url` do
`app.test.yaml` aponta pro NATS publicado em :4232) — só a rede EXTERNA e a IA são mockadas
em outros testes deste bloco; aqui não há chamada de IA, só autenticação + roteamento."""

import os

from asyncpg import Connection
from httpx import AsyncClient

from api.repositories.collectors.market_source_repository import (
    NewMarketSource,
    market_source_repository,
)
from api.repositories.geo.city_repository import city_repository
from api.repositories.markets.market_repository import NewMarket, market_repository

WEBHOOK_SECRET = os.environ["WHATSAPP_WEBHOOK_SECRET"]
GROUP_JID = "120363000000000000@g.us"
UNKNOWN_JID = "5511999998888@s.whatsapp.net"


async def _seed_active_whatsapp_group_source(conn: Connection) -> dict:
    city = await city_repository.get_by_ibge_code(conn, 5205109)
    market = await market_repository.create(
        conn, NewMarket(city_id=city["id"], trade_name="Mercado do Zé (teste webhook)")
    )
    return await market_source_repository.create(
        conn,
        NewMarketSource(market_id=market["id"], kind="whatsapp_group", identifier=GROUP_JID),
    )


def _upsert_payload(
    *, remote_jid: str, from_me: bool = False, text: str = "Arroz R$ 24,99"
) -> dict:
    return {
        "event": "messages.upsert",
        "instance": "economerc-ofertas",
        "data": {
            "key": {"remoteJid": remote_jid, "fromMe": from_me, "id": "MSG123"},
            "pushName": "Mercado do Zé",
            "message": {"conversation": text},
            "messageType": "conversation",
            "messageTimestamp": 1735689600,
        },
    }


async def test_webhook_rejects_missing_secret(client: AsyncClient):
    res = await client.post("/api/webhooks/whatsapp", json=_upsert_payload(remote_jid=GROUP_JID))
    assert res.status_code == 401


async def test_webhook_rejects_wrong_secret(client: AsyncClient):
    res = await client.post(
        "/api/webhooks/whatsapp",
        json=_upsert_payload(remote_jid=GROUP_JID),
        headers={"X-Webhook-Secret": "segredo-errado"},
    )
    assert res.status_code == 401


async def test_webhook_accepts_message_from_active_market_source(
    client: AsyncClient, db_conn: Connection
):
    await _seed_active_whatsapp_group_source(db_conn)

    res = await client.post(
        "/api/webhooks/whatsapp",
        json=_upsert_payload(remote_jid=GROUP_JID),
        headers={"X-Webhook-Secret": WEBHOOK_SECRET},
    )

    assert res.status_code == 202
    assert res.json()["accepted"] is True


async def test_webhook_ignores_message_from_unknown_source(client: AsyncClient):
    res = await client.post(
        "/api/webhooks/whatsapp",
        json=_upsert_payload(remote_jid=UNKNOWN_JID),
        headers={"X-Webhook-Secret": WEBHOOK_SECRET},
    )

    assert res.status_code == 202
    assert res.json()["accepted"] is False


async def test_webhook_ignores_own_outbound_message(client: AsyncClient, db_conn: Connection):
    await _seed_active_whatsapp_group_source(db_conn)

    res = await client.post(
        "/api/webhooks/whatsapp",
        json=_upsert_payload(remote_jid=GROUP_JID, from_me=True),
        headers={"X-Webhook-Secret": WEBHOOK_SECRET},
    )

    assert res.status_code == 202
    assert res.json()["accepted"] is False


async def test_webhook_ignores_non_upsert_events(client: AsyncClient, db_conn: Connection):
    await _seed_active_whatsapp_group_source(db_conn)
    payload = _upsert_payload(remote_jid=GROUP_JID)
    payload["event"] = "connection.update"

    res = await client.post(
        "/api/webhooks/whatsapp",
        json=payload,
        headers={"X-Webhook-Secret": WEBHOOK_SECRET},
    )

    assert res.status_code == 202
    assert res.json()["accepted"] is False


async def test_webhook_ignores_inactive_market_source(client: AsyncClient, db_conn: Connection):
    source = await _seed_active_whatsapp_group_source(db_conn)
    await db_conn.execute("UPDATE market_sources SET is_active = false WHERE id = $1", source["id"])

    res = await client.post(
        "/api/webhooks/whatsapp",
        json=_upsert_payload(remote_jid=GROUP_JID),
        headers={"X-Webhook-Secret": WEBHOOK_SECRET},
    )

    assert res.status_code == 202
    assert res.json()["accepted"] is False
