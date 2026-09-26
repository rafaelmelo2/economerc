import datetime as dt
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class Price(BaseModel):
    """1:1 com `prices` (`db/migrations/*_create_prices.sql`)."""

    id: UUID
    product_id: UUID
    market_id: UUID
    city_id: UUID
    amount: Decimal
    source: str
    confidence: Decimal
    reported_by: UUID | None
    client_id: UUID | None
    observed_at: dt.datetime
    promo_until: dt.datetime | None
    created_at: dt.datetime
