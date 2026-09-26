from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class ReceiptItem(BaseModel):
    """1:1 com `receipt_items` (`db/migrations/*_create_receipt_items.sql`)."""

    id: UUID
    receipt_id: UUID
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
