import datetime as dt
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from api.schemas.prices.price import PriceSource


class AdminPriceResponse(BaseModel):
    """Último preço vivo de um (produto, mercado) — o que `GET /admin/prices` modera."""

    id: UUID
    product_id: UUID
    product_name: str
    product_ean: str | None
    market_id: UUID
    market_name: str
    city_id: UUID
    amount: Decimal
    source: PriceSource
    confidence: Decimal
    observed_at: dt.datetime
    is_stale: bool
