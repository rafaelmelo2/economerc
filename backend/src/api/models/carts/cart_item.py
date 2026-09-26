import datetime as dt
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

CartItemUnit = Literal["un", "kg", "g", "l", "ml"]


class CartItem(BaseModel):
    """1:1 com `cart_items` (`db/migrations/20260926050002_create_cart_items.sql`)."""

    id: UUID
    cart_id: UUID
    cart_client_id: UUID
    user_id: UUID
    client_id: UUID
    product_id: UUID | None
    ean: str | None
    product_name: str
    unit_price: Decimal
    quantity: Decimal
    unit: CartItemUnit
    is_offer: bool
    field_versions: dict[str, str]
    created_at: dt.datetime
    updated_at: dt.datetime
    deleted_at: dt.datetime | None
