import datetime as dt
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel

OfferCandidateSource = Literal["whatsapp_group", "whatsapp_broadcast", "flyer_pdf", "instagram"]
OfferCandidateStatus = Literal["pending", "approved", "rejected"]


class OfferCandidateResponse(BaseModel):
    id: UUID
    market_id: UUID
    market_source_id: UUID
    product_name: str
    ean: str | None
    price_amount: Decimal
    unit: str | None
    valid_until: dt.datetime | None
    raw_text: str | None
    raw_payload: dict[str, Any]
    source: OfferCandidateSource
    status: OfferCandidateStatus
    reviewed_by: UUID | None
    reviewed_at: dt.datetime | None
    created_at: dt.datetime


class OfferCandidateApproveRequest(BaseModel):
    """`product_id` explícito vence; sem ele, tenta casar pelo `ean` do candidato."""

    product_id: UUID | None = None
