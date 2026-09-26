"""Worker de ingestão de NFC-e — consumidor JetStream durável do subject `receipts.ingest`.

`process_receipt` é a lógica de negócio pura (recebe uma conexão e um `receipt_id`, devolve
um `ReceiptProcessingOutcome`) — testável direto, sem depender do NATS (rules/tests.md).
`run_worker`/`main` são só o laço de consumo: fetch em lote, ack/nak explícito por mensagem,
backoff exponencial em retry, "dead-letter" (`status='failed'` + log de erro, sem fila
separada) depois de `MAX_ATTEMPTS`.

Rodar com `python -m api.workers.receipts_worker` — processo separado do `api.main` (Granian),
serviço `receipts-worker` no `compose.yaml` (ver instruções da tarefa: só editar, não subir).
"""

import datetime as dt
from enum import StrEnum
from typing import Final
from uuid import UUID

import anyio
import orjson
import structlog
from asyncpg import Connection

from api.core.nats_client import nats_client
from api.core.valkey_client import close_valkey, init_valkey
from api.repositories.catalog.product_alias_repository import (
    NewProductAlias,
    product_alias_repository,
)
from api.repositories.catalog.product_repository import NewProduct, product_repository
from api.repositories.markets.market_repository import NewMarket, market_repository
from api.repositories.prices.price_repository import NewPriceObservation, price_repository
from api.repositories.receipts.receipt_event_repository import receipt_event_repository
from api.repositories.receipts.receipt_item_repository import (
    NewReceiptItem,
    receipt_item_repository,
)
from api.repositories.receipts.receipt_repository import receipt_repository
from api.repositories.users.user_preferences_repository import user_preferences_repository
from api.services.catalog.gtin import InvalidGtinError, normalize_gtin
from api.services.nfce.adapters.base import MarketDraft, ReceiptItemDraft
from api.services.nfce.adapters.go import NfceFetchError, NfceRateLimitedError
from api.services.nfce.raw_storage import compress_raw_html
from api.services.nfce.registry import get_adapter
from api.services.nfce.streams import (
    RECEIPTS_CONSUMER_DURABLE_NAME,
    RECEIPTS_INGEST_SUBJECT,
    RECEIPTS_STREAM_NAME,
    ensure_receipts_stream,
)
from api.services.prices.price_service import resolve_confidence
from config.database import close_asyncpg_pool, get_pool, init_asyncpg_pool

log = structlog.get_logger(__name__)

MAX_ATTEMPTS: Final = 5
BACKOFF_BASE_SECONDS: Final = 10
FETCH_BATCH_SIZE: Final = 10
FETCH_TIMEOUT_SECONDS: Final = 5.0
ALLOWED_PRODUCT_UNITS: Final = frozenset({"un", "kg", "g", "l", "ml"})


class ReceiptProcessingOutcome(StrEnum):
    DONE = "done"
    SKIPPED = "skipped"
    FAILED = "failed"
    RETRY = "retry"


class NfceCityUnresolvedError(Exception):
    """Mercado novo (CNPJ desconhecido) mas o usuário não tem cidade configurada."""


def _normalize_product_unit(unit: str | None) -> str:
    candidate = (unit or "un").strip().lower()
    return candidate if candidate in ALLOWED_PRODUCT_UNITS else "un"


async def _resolve_or_create_market(
    conn: Connection, market_draft: MarketDraft, user_id: UUID
) -> dict:
    """Mercado pelo CNPJ do emitente — cria na primeira nota, só completa lacunas depois."""
    existing = await market_repository.get_by_cnpj(conn, market_draft.cnpj)
    if existing is not None:
        updated = await market_repository.update(
            conn,
            existing["id"],
            {
                "legal_name": existing["legal_name"] or market_draft.legal_name,
                "address": existing["address"] or market_draft.address,
            },
        )
        return updated or existing

    preferences = await user_preferences_repository.get_by_user_id(conn, user_id)
    city_id = preferences["city_id"] if preferences else None
    if city_id is None:
        raise NfceCityUnresolvedError(
            "usuário sem cidade configurada — não é possível cadastrar o mercado "
            f"do CNPJ {market_draft.cnpj} automaticamente"
        )
    return await market_repository.create(
        conn,
        NewMarket(
            city_id=city_id,
            trade_name=market_draft.trade_name,
            cnpj=market_draft.cnpj,
            legal_name=market_draft.legal_name,
            address=market_draft.address,
        ),
    )


async def _resolve_product_id(
    conn: Connection, item: ReceiptItemDraft, market_id: UUID
) -> UUID | None:
    """Casamento item -> produto: EAN primeiro, alias (mercado + código) como ponte/fallback.

    Alias sem EAN nesta nota mas já ligado a um produto por uma nota/scan anterior reusa a
    ligação (conciliação carrinho x nota, docs/nfce-sefaz-go.md > Risco central).
    """
    product_id: UUID | None = None
    if item.ean:
        try:
            normalized_ean = normalize_gtin(item.ean)
        except InvalidGtinError:
            normalized_ean = None
        if normalized_ean is not None:
            product = await product_repository.get_by_ean(conn, normalized_ean)
            if product is None:
                product = await product_repository.create(
                    conn,
                    NewProduct(
                        name=item.raw_name,
                        ean=normalized_ean,
                        unit=_normalize_product_unit(item.unit),
                        source="nfce",
                    ),
                )
            product_id = product["id"]

    if item.market_code:
        alias = await product_alias_repository.get_by_market_code(conn, market_id, item.market_code)
        if alias is None:
            await product_alias_repository.create(
                conn,
                NewProductAlias(
                    market_id=market_id,
                    market_code=item.market_code,
                    raw_name=item.raw_name,
                    product_id=product_id,
                ),
            )
        elif product_id is not None and alias["product_id"] is None:
            await product_alias_repository.link_product(conn, alias["id"], product_id)
        elif product_id is None and alias["product_id"] is not None:
            product_id = alias["product_id"]

    return product_id


async def _persist_item(
    conn: Connection,
    receipt_id: UUID,
    item: ReceiptItemDraft,
    market: dict,
    issued_at: dt.datetime,
    user_id: UUID,
) -> None:
    product_id = await _resolve_product_id(conn, item, market["id"])
    await receipt_item_repository.create(
        conn,
        NewReceiptItem(
            receipt_id=receipt_id,
            line_number=item.line_number,
            market_code=item.market_code,
            ean=item.ean,
            raw_name=item.raw_name,
            ncm=item.ncm,
            quantity=item.quantity,
            unit=item.unit,
            unit_price=item.unit_price,
            total_price=item.total_price,
            product_id=product_id,
        ),
    )
    if product_id is not None and item.unit_price > 0:
        await price_repository.create(
            conn,
            NewPriceObservation(
                product_id=product_id,
                market_id=market["id"],
                city_id=market["city_id"],
                amount=item.unit_price,
                source="nfce",
                confidence=resolve_confidence("nfce"),
                observed_at=issued_at,
                reported_by=user_id,
            ),
        )


async def _handle_retryable_failure(
    conn: Connection, receipt_id: UUID, attempts: int, reason: str
) -> ReceiptProcessingOutcome:
    log.warning(
        "receipt_processing_attempt_failed",
        receipt_id=str(receipt_id),
        attempts=attempts,
        reason=reason,
    )
    if attempts >= MAX_ATTEMPTS:
        await receipt_repository.mark_failed(conn, receipt_id, reason)
        await receipt_event_repository.append(
            conn,
            receipt_id,
            from_status="processing",
            to_status="failed",
            detail=f"desistiu após {attempts} tentativas: {reason}",
        )
        log.error(
            "receipt_processing_dead_lettered",
            receipt_id=str(receipt_id),
            attempts=attempts,
            reason=reason,
        )
        return ReceiptProcessingOutcome.FAILED
    await receipt_repository.reset_to_pending(conn, receipt_id, reason)
    await receipt_event_repository.append(
        conn,
        receipt_id,
        from_status="processing",
        to_status="pending",
        detail=f"tentativa {attempts} falhou: {reason}",
    )
    return ReceiptProcessingOutcome.RETRY


async def process_receipt(conn: Connection, receipt_id: UUID) -> ReceiptProcessingOutcome:
    """Ponta a ponta: busca a nota, faz o parse, grava itens/mercado/preços. Idempotente —
    reprocessar uma nota `done` é um no-op (SKIPPED), nunca duplica preço."""
    receipt = await receipt_repository.get_by_id(conn, receipt_id)
    if receipt is None:
        log.warning("receipt_not_found_for_processing", receipt_id=str(receipt_id))
        return ReceiptProcessingOutcome.DONE
    if receipt["status"] in ("done", "duplicate"):
        return ReceiptProcessingOutcome.SKIPPED

    adapter = get_adapter(receipt["state_code"])
    if adapter is None:
        await receipt_repository.mark_failed(conn, receipt_id, "UF ainda não suportada")
        await receipt_event_repository.append(
            conn,
            receipt_id,
            from_status=receipt["status"],
            to_status="failed",
            detail="UF ainda não suportada",
        )
        return ReceiptProcessingOutcome.FAILED

    processing = await receipt_repository.mark_processing(conn, receipt_id)
    await receipt_event_repository.append(
        conn, receipt_id, from_status=receipt["status"], to_status="processing"
    )

    try:
        raw_html = await adapter.fetch(receipt["qr_url"])
        draft = adapter.parse(raw_html)
        async with conn.transaction():
            market = await _resolve_or_create_market(conn, draft.market, receipt["user_id"])
            for item in draft.items:
                await _persist_item(
                    conn, receipt_id, item, market, draft.issued_at, receipt["user_id"]
                )
            await receipt_repository.mark_done(
                conn,
                receipt_id,
                market_id=market["id"],
                issued_at=draft.issued_at,
                total_amount=draft.total_amount,
                discount_amount=draft.discount_amount,
                raw_html=compress_raw_html(raw_html),
            )
            await receipt_event_repository.append(
                conn, receipt_id, from_status="processing", to_status="done"
            )
        return ReceiptProcessingOutcome.DONE
    except (NfceRateLimitedError, NfceFetchError) as exc:
        return await _handle_retryable_failure(conn, receipt_id, processing["attempts"], str(exc))
    except Exception as exc:  # parse malformado, mercado sem cidade, etc — retryable até o limite
        log.exception("receipt_processing_unexpected_error", receipt_id=str(receipt_id))
        return await _handle_retryable_failure(conn, receipt_id, processing["attempts"], str(exc))


async def run_worker() -> None:
    """Laço de consumo: pull consumer durável, ack/nak explícito, backoff exponencial."""
    js = nats_client.get_jetstream()
    await ensure_receipts_stream(js)
    subscription = await js.pull_subscribe(
        RECEIPTS_INGEST_SUBJECT, durable=RECEIPTS_CONSUMER_DURABLE_NAME, stream=RECEIPTS_STREAM_NAME
    )
    pool = await get_pool()
    log.info("receipts_worker_started")
    while True:
        try:
            messages = await subscription.fetch(
                batch=FETCH_BATCH_SIZE, timeout=FETCH_TIMEOUT_SECONDS
            )
        except TimeoutError:
            continue
        for msg in messages:
            payload = orjson.loads(msg.data)
            receipt_id = UUID(payload["receipt_id"])
            async with pool.acquire() as conn:
                outcome = await process_receipt(conn, receipt_id)
            if outcome == ReceiptProcessingOutcome.RETRY:
                delivery_count = msg.metadata.num_delivered
                delay = BACKOFF_BASE_SECONDS * (2 ** min(delivery_count - 1, 4))
                await msg.nak(delay=delay)
            else:
                await msg.ack()


async def main() -> None:
    await init_asyncpg_pool()
    await init_valkey()
    await nats_client.connect()
    try:
        await run_worker()
    finally:
        await nats_client.close()
        await close_valkey()
        await close_asyncpg_pool()


if __name__ == "__main__":
    anyio.run(main)
