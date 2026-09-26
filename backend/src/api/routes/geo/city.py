from asyncpg import Connection
from fastapi import APIRouter, Depends

from api.models.shared.paged_response import PagedResponse
from api.repositories.geo.city_repository import city_repository
from api.routes.shared.list_params import ListParamsDep
from api.schemas.geo.city import CityResponse
from config.database import get_conn

router = APIRouter(prefix="/cities", tags=["Geo"])


@router.get("", response_model=PagedResponse[CityResponse])
async def list_cities(
    params: ListParamsDep,
    conn: Connection = Depends(get_conn),
) -> PagedResponse[CityResponse]:
    page = await city_repository.list_cities(conn, params)
    return PagedResponse(
        items=page.items,
        total=page.total,
        skip=params.skip,
        limit=params.limit,
        has_more=page.has_more,
    )
