import datetime as dt
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

PurchaseOrigin = Literal["cart", "receipt"]


class CategorySpending(BaseModel):
    """Uma fatia do gasto do mês por categoria — `category_id=None` agrupa itens sem

    categoria (produto ainda não classificado, `category_name="Sem categoria"`)."""

    category_id: UUID | None
    category_name: str
    amount: Decimal


class MonthlyReportResponse(BaseModel):
    month: str  # "YYYY-MM"
    total_amount: Decimal
    purchase_count: int
    by_category: list[CategorySpending]


class MonthSummaryResponse(BaseModel):
    """Um ponto do gráfico de evolução — mês sem compra vem com `total_amount="0"`."""

    month: str
    total_amount: Decimal


class PurchaseResponse(BaseModel):
    id: UUID
    market_id: UUID | None
    market_name: str
    purchase_at: dt.datetime
    item_count: int
    total_amount: Decimal
    origin: PurchaseOrigin
