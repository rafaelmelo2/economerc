import datetime as dt
from decimal import Decimal
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from api.services.nfce.failure_messages import resolve_failure_message

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
    failure_message: str | None = None
    attempts: int
    market_id: UUID | None
    issued_at: dt.datetime | None
    total_amount: Decimal | None
    discount_amount: Decimal | None
    created_at: dt.datetime
    updated_at: dt.datetime

    @model_validator(mode="after")
    def _fill_failure_message(self) -> Self:
        """Deriva de `status`/`failure_reason` quando não veio pronto — permite `ReceiptResponse(
        **row)` direto no repositório (nenhuma coluna nova, `docs/brand/voz.md` no texto)."""
        if self.failure_message is None:
            self.failure_message = resolve_failure_message(self.status, self.failure_reason)
        return self


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
