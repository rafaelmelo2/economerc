from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

ProductUnit = Literal["un", "kg", "g", "l", "ml"]


class ProductResponse(BaseModel):
    id: UUID
    ean: str | None
    name: str
    brand: str | None
    category_id: UUID | None
    unit: ProductUnit
    net_quantity: Decimal | None
    image_upload_id: UUID | None
    source: str


class ProductCreateRequest(BaseModel):
    """Cadastro manual pelo admin — `source` é sempre `manual` (a rota decide, não o cliente)."""

    ean: str | None = Field(default=None, max_length=14)
    name: str = Field(min_length=1, max_length=200)
    brand: str | None = Field(default=None, max_length=120)
    category_id: UUID | None = None
    unit: ProductUnit = "un"
    net_quantity: Decimal | None = None
    image_upload_id: UUID | None = None


class ProductUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    brand: str | None = Field(default=None, max_length=120)
    category_id: UUID | None = None
    unit: ProductUnit | None = None
    net_quantity: Decimal | None = None
    image_upload_id: UUID | None = None
