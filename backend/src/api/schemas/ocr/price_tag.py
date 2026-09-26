from typing import Literal
from uuid import UUID

from pydantic import BaseModel

PriceTagUnit = Literal["un", "kg", "g", "l", "ml"]


class PriceTagOcrResponse(BaseModel):
    """Só a leitura — o app confirma antes de virar preço (nunca grava em `prices`)."""

    upload_id: UUID
    product_name: str
    price: str
    unit: PriceTagUnit
    price_per_unit: str | None
    is_promo: bool
    promo_price: str | None
    confidence: float
    cached: bool
