from uuid import UUID

from asyncpg import Connection
from fastapi import APIRouter, Depends, Query

from api.core.exceptions import NotFoundError
from api.dependencies.auth import AdminUser, CurrentUser
from api.models.shared.paged_response import PagedResponse
from api.repositories.markets.market_repository import NewMarket, market_repository
from api.routes.shared.list_params import ListParamsDep
from api.schemas.markets.market import MarketCreateRequest, MarketResponse, MarketUpdateRequest
from config.database import get_conn

router = APIRouter(prefix="/markets", tags=["Markets"])


@router.get("", response_model=PagedResponse[MarketResponse])
async def list_markets(
    user: CurrentUser,
    params: ListParamsDep,
    city_id: UUID | None = Query(None),
    conn: Connection = Depends(get_conn),
) -> PagedResponse[MarketResponse]:
    page = await market_repository.list_markets(conn, params, city_id)
    return PagedResponse(
        items=page.items,
        total=page.total,
        skip=params.skip,
        limit=params.limit,
        has_more=page.has_more,
    )


@router.get("/{market_id}", response_model=MarketResponse)
async def get_market(
    market_id: UUID, user: CurrentUser, conn: Connection = Depends(get_conn)
) -> MarketResponse:
    market = await market_repository.get_by_id(conn, market_id)
    if market is None:
        raise NotFoundError(detail="Mercado não encontrado.")
    return MarketResponse(**market)


@router.post("", response_model=MarketResponse, status_code=201)
async def create_market(
    body: MarketCreateRequest, user: AdminUser, conn: Connection = Depends(get_conn)
) -> MarketResponse:
    market = await market_repository.create(conn, NewMarket(**body.model_dump()))
    return MarketResponse(**market)


@router.patch("/{market_id}", response_model=MarketResponse)
async def update_market(
    market_id: UUID,
    body: MarketUpdateRequest,
    user: AdminUser,
    conn: Connection = Depends(get_conn),
) -> MarketResponse:
    market = await market_repository.update(conn, market_id, body.model_dump(exclude_unset=True))
    if market is None:
        raise NotFoundError(detail="Mercado não encontrado.")
    return MarketResponse(**market)


@router.delete("/{market_id}", status_code=204)
async def delete_market(
    market_id: UUID, user: AdminUser, conn: Connection = Depends(get_conn)
) -> None:
    deleted = await market_repository.soft_delete(conn, market_id)
    if not deleted:
        raise NotFoundError(detail="Mercado não encontrado.")
