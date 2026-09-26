import datetime as dt
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class Product(BaseModel):
    """1:1 com `products` (`db/migrations/*_create_products.sql`)."""

    id: UUID
    ean: str | None
    name: str
    brand: str | None
    category_id: UUID | None
    unit: str
    net_quantity: Decimal | None
    image_upload_id: UUID | None
    source: str
    created_at: dt.datetime
    updated_at: dt.datetime
    deleted_at: dt.datetime | None
