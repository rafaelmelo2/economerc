import datetime as dt
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

PriceSource = Literal["nfce", "community", "flyer", "manual", "partner", "scraper"]
UnitPriceLabel = Literal["kg", "l", "un"]


class PriceCreateRequest(BaseModel):
    """`confidence` NUNCA vem do cliente — o service deriva do `source` (default por fonte)."""

    product_id: UUID
    market_id: UUID
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    source: PriceSource
    observed_at: dt.datetime | None = None
    client_id: UUID | None = None
    promo_until: dt.datetime | None = None


class PriceResponse(BaseModel):
    id: UUID
    product_id: UUID
    market_id: UUID
    city_id: UUID
    amount: Decimal
    source: PriceSource
    confidence: Decimal
    reported_by: UUID | None
    client_id: UUID | None
    observed_at: dt.datetime
    promo_until: dt.datetime | None
    created_at: dt.datetime


class PriceObservationResponse(BaseModel):
    """Item de `GET /prices` — o último preço de UM mercado, já com preço por unidade."""

    id: UUID
    product_id: UUID
    market_id: UUID
    market_name: str
    city_id: UUID
    amount: Decimal
    unit_amount: Decimal | None
    unit_label: UnitPriceLabel | None
    source: PriceSource
    confidence: Decimal
    observed_at: dt.datetime
    promo_until: dt.datetime | None
    is_stale: bool
