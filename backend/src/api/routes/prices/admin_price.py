from uuid import UUID

from asyncpg import Connection
from fastapi import APIRouter, Depends, Query

from api.dependencies.auth import AdminUser
from api.models.shared.paged_response import PagedResponse
from api.repositories.prices.price_repository import price_repository
from api.routes.shared.list_params import ListParamsDep
from api.schemas.prices.admin_price import AdminPriceResponse
from api.schemas.prices.price import PriceSource
from config.database import get_conn

router = APIRouter(prefix="/admin/prices", tags=["Admin", "Prices"])


@router.get("", response_model=PagedResponse[AdminPriceResponse])
async def list_admin_prices(
    user: AdminUser,
    params: ListParamsDep,
    market_id: UUID | None = Query(None),
    product_id: UUID | None = Query(None),
    source: PriceSource | None = Query(None),
    stale_only: bool = Query(False, description="Só preços sem confirmação há mais de 15 dias"),
    conn: Connection = Depends(get_conn),
) -> PagedResponse[AdminPriceResponse]:
    page = await price_repository.list_for_admin(
        conn,
        params,
        market_id=market_id,
        product_id=product_id,
        source=source,
        stale_only=stale_only,
    )
    return PagedResponse(
        items=page.items,
        total=page.total,
        skip=params.skip,
        limit=params.limit,
        has_more=page.has_more,
    )
