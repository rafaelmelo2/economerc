import datetime as dt
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

CartStatus = Literal["open", "closed", "cancelled"]


class Cart(BaseModel):
    """1:1 com `carts` (`db/migrations/20260926050001_create_carts.sql`)."""

    id: UUID
    user_id: UUID
    client_id: UUID
    market_id: UUID | None
    status: CartStatus
    budget: Decimal | None
    started_at: dt.datetime
    closed_at: dt.datetime | None
    field_versions: dict[str, str]
    created_at: dt.datetime
    updated_at: dt.datetime
    deleted_at: dt.datetime | None
