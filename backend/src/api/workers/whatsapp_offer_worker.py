"""Worker do coletor de WhatsApp (bloco 4C): consome `offers.ingest` (JetStream, consumer
durável) publicado por `routes/collectors/whatsapp_webhook.py` e gera `offer_candidates`
pendentes via `services/collectors/whatsapp_offer_service.py`.

Uso: `cd backend && uv run python -m api.workers.whatsapp_offer_worker`

Processo de vida longa (loop de pull) — roda como serviço systemd/docker, não como cron
(diferente do crawler do Supermercado Catalão, que é um comando único por execução).
"""

import anyio
import orjson

from api.core.logging import get_logger, setup_logging
from api.core.nats_client import nats_client
from api.services.collectors.offer_ingest_stream import (
    OFFERS_INGEST_CONSUMER,
    OFFERS_INGEST_SUBJECT,
    ensure_offers_ingest_stream,
)
from api.services.collectors.whatsapp_offer_service import process_ingested_offer_message
from config.database import close_asyncpg_pool, get_pool, init_asyncpg_pool

setup_logging()
log = get_logger(__name__)

PULL_BATCH_SIZE = 10
PULL_TIMEOUT_SECONDS = 5


async def _handle_message(pool, msg) -> None:
    payload = orjson.loads(msg.data)
    async with pool.acquire() as conn:
        candidates = await process_ingested_offer_message(conn, payload)
    log.info("whatsapp_offer_message_processed", candidates_created=len(candidates))
    await msg.ack()


async def main() -> None:
    await init_asyncpg_pool()
    pool = await get_pool()
    await nats_client.connect()
    js = nats_client.get_jetstream()
    await ensure_offers_ingest_stream(js)
    consumer = await js.pull_subscribe(OFFERS_INGEST_SUBJECT, durable=OFFERS_INGEST_CONSUMER)

    log.info("whatsapp_offer_worker_started")
    try:
        while True:
            try:
                messages = await consumer.fetch(PULL_BATCH_SIZE, timeout=PULL_TIMEOUT_SECONDS)
            except TimeoutError:
                continue
            for msg in messages:
                try:
                    await _handle_message(pool, msg)
                except Exception:
                    log.exception("whatsapp_offer_message_failed")
                    await msg.nak()
    finally:
        await nats_client.close()
        await close_asyncpg_pool()


if __name__ == "__main__":
    anyio.run(main)
