"""Stream JetStream `offers.ingest` (bloco 4C, skill `infra`).

O webhook (processo API) publica; o worker (`api.workers.whatsapp_offer_worker`, processo
separado) consome com um consumer durável. Os dois lados chamam `ensure_offers_ingest_stream`
antes de publicar/consumir — idempotente, então não importa quem sobe primeiro.
"""

from typing import Final

import nats.js.errors
import orjson
from nats.js import JetStreamContext

OFFERS_INGEST_STREAM: Final = "OFFERS"
OFFERS_INGEST_SUBJECT: Final = "offers.ingest"
OFFERS_INGEST_CONSUMER: Final = "whatsapp-offer-worker"


async def ensure_offers_ingest_stream(js: JetStreamContext) -> None:
    try:
        await js.stream_info(OFFERS_INGEST_STREAM)
    except nats.js.errors.NotFoundError:
        try:
            await js.add_stream(name=OFFERS_INGEST_STREAM, subjects=[OFFERS_INGEST_SUBJECT])
        except nats.js.errors.APIError:
            # Corrida: outro publisher/worker criou o stream entre o `stream_info` e aqui —
            # só é um problema de verdade se o stream continuar ausente.
            await js.stream_info(OFFERS_INGEST_STREAM)


async def publish_offer_ingest_message(js: JetStreamContext, message: dict) -> None:
    await ensure_offers_ingest_stream(js)
    await js.publish(OFFERS_INGEST_SUBJECT, orjson.dumps(message))
