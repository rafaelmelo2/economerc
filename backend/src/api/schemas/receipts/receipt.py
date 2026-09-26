import datetime as dt
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

ReceiptStatus = Literal["pending", "processing", "done", "failed", "duplicate"]


class ReceiptCreateRequest(BaseModel):
    """`client_id` é gerado no app (offline-first, `rules/backend.md`) — idempotência do POST."""

    qr_text: str = Field(min_length=1, max_length=2000)
    client_id: UUID
    cart_id: UUID | None = None


class ReceiptResponse(BaseModel):
    id: UUID
    user_id: UUID
    client_id: UUID
    cart_id: UUID | None
    access_key: str
    state_code: str
    status: ReceiptStatus
    failure_reason: str | None
    attempts: int
    market_id: UUID | None
    issued_at: dt.datetime | None
    total_amount: Decimal | None
    discount_amount: Decimal | None
    created_at: dt.datetime
    updated_at: dt.datetime


class ReceiptItemResponse(BaseModel):
    id: UUID
    line_number: int
    market_code: str | None
    ean: str | None
    raw_name: str
    ncm: str | None
    quantity: Decimal
    unit: str | None
    unit_price: Decimal
    total_price: Decimal
    product_id: UUID | None


class ReceiptDetailResponse(ReceiptResponse):
    items: list[ReceiptItemResponse]
