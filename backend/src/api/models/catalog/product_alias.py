import datetime as dt
from uuid import UUID

from pydantic import BaseModel


class ProductAlias(BaseModel):
    """1:1 com `product_aliases` (`db/migrations/*_create_product_aliases.sql`)."""

    id: UUID
    product_id: UUID | None
    market_id: UUID
    market_code: str | None
    raw_name: str
    created_at: dt.datetime
