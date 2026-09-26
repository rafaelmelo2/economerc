"""Webhook da Evolution API (bloco 4C, docs/fontes-de-dados.md > WhatsApp).

Autenticado por segredo compartilhado (`X-Webhook-Secret`, comparação em tempo constante) —
NUNCA confia em `remoteJid` sozinho pra decidir se aceita. Responde rápido: só valida, resolve
a `market_source` e publica no NATS; todo parsing (regex/IA) acontece no worker separado
(`api.workers.whatsapp_offer_worker`), fora do request/response da Evolution.
"""

import hmac
from typing import Annotated, Final

from asyncpg import Connection
from fastapi import APIRouter, Depends, Header

from api.core.exceptions import UnauthorizedError
from api.core.nats_client import nats_client
from api.repositories.collectors.market_source_repository import market_source_repository
from api.schemas.collectors.whatsapp_webhook import (
    WhatsAppMessageContent,
    WhatsAppWebhookAck,
    WhatsAppWebhookPayload,
)
from api.services.collectors.offer_ingest_stream import publish_offer_ingest_message
from config.database import get_conn
from config.settings import settings

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

WHATSAPP_UPSERT_EVENT: Final = "messages.upsert"


def _verify_webhook_secret(provided: str | None) -> None:
    configured = settings.whatsapp_webhook_secret
    if configured is None or provided is None:
        raise UnauthorizedError(detail="Webhook do WhatsApp não autenticado.")
    if not hmac.compare_digest(provided, configured.get_secret_value()):
        raise UnauthorizedError(detail="Webhook do WhatsApp não autenticado.")


def _extract_message_text(message: WhatsAppMessageContent | None) -> str | None:
    if message is None:
        return None
    if message.conversation:
        return message.conversation
    if message.extended_text_message and message.extended_text_message.text:
        return message.extended_text_message.text
    if message.image_message and message.image_message.caption:
        return message.image_message.caption
    return None


def _extract_image_base64(message: WhatsAppMessageContent | None) -> str | None:
    if message is None or message.image_message is None:
        return None
    return message.base64


@router.post("/whatsapp", response_model=WhatsAppWebhookAck, status_code=202)
async def receive_whatsapp_webhook(
    body: WhatsAppWebhookPayload,
    conn: Connection = Depends(get_conn),
    x_webhook_secret: Annotated[str | None, Header()] = None,
) -> WhatsAppWebhookAck:
    _verify_webhook_secret(x_webhook_secret)

    if body.event != WHATSAPP_UPSERT_EVENT or body.data.key.from_me:
        return WhatsAppWebhookAck(accepted=False)

    market_source = await market_source_repository.get_active_whatsapp_source_by_identifier(
        conn, body.data.key.remote_jid
    )
    if market_source is None:
        return WhatsAppWebhookAck(accepted=False)

    ingest_message = {
        "market_source_id": str(market_source["id"]),
        "market_id": str(market_source["market_id"]),
        "source_kind": market_source["kind"],
        "message_id": body.data.key.id,
        "sender_push_name": body.data.push_name,
        "message_type": body.data.message_type,
        "text": _extract_message_text(body.data.message),
        "image_base64": _extract_image_base64(body.data.message),
        "message_timestamp": body.data.message_timestamp,
    }

    await nats_client.connect()
    await publish_offer_ingest_message(nats_client.get_jetstream(), ingest_message)
    return WhatsAppWebhookAck(accepted=True)
