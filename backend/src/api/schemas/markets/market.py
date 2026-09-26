from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class MarketResponse(BaseModel):
    id: UUID
    city_id: UUID
    cnpj: str | None
    legal_name: str | None
    trade_name: str
    address: str | None
    latitude: Decimal | None
    longitude: Decimal | None
    is_partner: bool


class MarketCreateRequest(BaseModel):
    city_id: UUID
    trade_name: str = Field(min_length=1, max_length=200)
    cnpj: str | None = Field(default=None, min_length=14, max_length=14)
    legal_name: str | None = Field(default=None, max_length=200)
    address: str | None = Field(default=None, max_length=300)
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    is_partner: bool = False


class MarketUpdateRequest(BaseModel):
    trade_name: str | None = Field(default=None, min_length=1, max_length=200)
    cnpj: str | None = Field(default=None, min_length=14, max_length=14)
    legal_name: str | None = Field(default=None, max_length=200)
    address: str | None = Field(default=None, max_length=300)
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    is_partner: bool | None = None
