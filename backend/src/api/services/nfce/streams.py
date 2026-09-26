"""Stream JetStream de ingestão de NFC-e (skill `infra` > nats-messaging.md).

`add_stream` é idempotente — chamado tanto pelo publisher (`routes/receipts/receipt.py`)
quanto pelo worker (`workers/receipts_worker.py`), sem coordenação especial entre os dois.
"""

from typing import Final

from nats.js import JetStreamContext

RECEIPTS_STREAM_NAME: Final = "RECEIPTS"
RECEIPTS_INGEST_SUBJECT: Final = "receipts.ingest"
RECEIPTS_CONSUMER_DURABLE_NAME: Final = "receipts-ingest-worker"


async def ensure_receipts_stream(js: JetStreamContext) -> None:
    await js.add_stream(name=RECEIPTS_STREAM_NAME, subjects=["receipts.>"])
