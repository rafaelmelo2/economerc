import datetime as dt
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class Market(BaseModel):
    """1:1 com `markets` (`db/migrations/*_create_markets.sql`)."""

    id: UUID
    city_id: UUID
    cnpj: str | None
    legal_name: str | None
    trade_name: str
    address: str | None
    latitude: Decimal | None
    longitude: Decimal | None
    is_partner: bool
    created_at: dt.datetime
    updated_at: dt.datetime
    deleted_at: dt.datetime | None
