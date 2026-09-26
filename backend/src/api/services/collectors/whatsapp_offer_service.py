"""Processa UMA mensagem já ingerida (`offers.ingest`) -> `offer_candidates` pendentes.

texto -> regex pt-BR primeiro (rápido, sem custo de IA); sem match -> `flyer_extract`.
imagem -> sempre IA (regex não lê imagem). Nunca escreve em `prices` direto — tudo pendente
até um admin revisar (`routes/collectors/offer_candidates_admin.py`).
"""

import datetime as dt
from typing import Any, Final
from uuid import UUID

import structlog
from asyncpg import Connection

from api.repositories.collectors.offer_candidate_repository import (
    NewOfferCandidate,
    offer_candidate_repository,
)
from api.services.collectors.flyer_ai_extractor import FlyerExtractItem, extract_offers_via_ai
from api.services.collectors.whatsapp_price_regex import extract_price_candidates

log = structlog.get_logger(__name__)

PRODUCT_NAME_MAX_LENGTH: Final = 200
UNIT_MAX_LENGTH: Final = 40


def _truncate(value: str | None, max_length: int) -> str | None:
    return value[:max_length] if value else value


def _parse_valid_until(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        parsed = dt.datetime.fromisoformat(value)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.UTC)


async def process_ingested_offer_message(conn: Connection, message: dict[str, Any]) -> list[dict]:
    """`message` é o payload publicado pelo webhook (`services/collectors/offer_ingest_stream.py`).
    Devolve os `offer_candidates` criados (lista vazia = nada reconhecível na mensagem)."""
    market_id = UUID(message["market_id"])
    market_source_id = UUID(message["market_source_id"])
    source = message["source_kind"]
    text = message.get("text")
    image_base64 = message.get("image_base64")

    if image_base64:
        ai_items = await extract_offers_via_ai(text=text, image_base64=image_base64)
        return await _persist_ai_items(
            conn, ai_items, market_id, market_source_id, source, text, message
        )

    if not text:
        return []

    line_matches = [match for match in extract_price_candidates(text) if match.amount is not None]
    if line_matches:
        candidates = []
        for match in line_matches:
            row = await offer_candidate_repository.create(
                conn,
                NewOfferCandidate(
                    market_id=market_id,
                    market_source_id=market_source_id,
                    product_name=_truncate(match.product_name, PRODUCT_NAME_MAX_LENGTH),
                    price_amount=match.amount,
                    unit=_truncate(match.unit, UNIT_MAX_LENGTH),
                    source=source,
                    raw_text=text,
                    raw_payload=message,
                ),
            )
            candidates.append(row)
        return candidates

    ai_items = await extract_offers_via_ai(text=text, image_base64=None)
    return await _persist_ai_items(
        conn, ai_items, market_id, market_source_id, source, text, message
    )


async def _persist_ai_items(
    conn: Connection,
    items: list[FlyerExtractItem],
    market_id: UUID,
    market_source_id: UUID,
    source: str,
    text: str | None,
    raw_payload: dict[str, Any],
) -> list[dict]:
    candidates = []
    for item in items:
        row = await offer_candidate_repository.create(
            conn,
            NewOfferCandidate(
                market_id=market_id,
                market_source_id=market_source_id,
                product_name=_truncate(item.product_name, PRODUCT_NAME_MAX_LENGTH),
                price_amount=item.price_amount,
                unit=_truncate(item.unit, UNIT_MAX_LENGTH),
                valid_until=_parse_valid_until(item.valid_until),
                source=source,
                raw_text=text,
                raw_payload=raw_payload,
            ),
        )
        candidates.append(row)
    if not items:
        log.info("whatsapp_offer_message_had_no_recognizable_offer")
    return candidates
