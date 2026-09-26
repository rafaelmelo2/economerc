import datetime as dt
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class Receipt(BaseModel):
    """1:1 com `receipts` (`db/migrations/*_create_receipts.sql`).

    `raw_html`/`raw_purged_at` ficam de fora de propósito — nunca trafegam pela API
    (bruto pode ter chegado com dados sensíveis antes da redação de CPF, e é grande).
    """

    id: UUID
    user_id: UUID
    client_id: UUID
    cart_id: UUID | None
    access_key: str
    state_code: str
    qr_url: str
    status: str
    failure_reason: str | None
    attempts: int
    market_id: UUID | None
    issued_at: dt.datetime | None
    total_amount: Decimal | None
    discount_amount: Decimal | None
    created_at: dt.datetime
    updated_at: dt.datetime
