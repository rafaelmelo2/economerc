from asyncpg import Connection
from fastapi import APIRouter, Depends

from api.models.shared.paged_response import PagedResponse
from api.repositories.catalog.category_repository import category_repository
from api.routes.shared.list_params import ListParamsDep
from api.schemas.catalog.category import CategoryResponse
from config.database import get_conn

router = APIRouter(prefix="/categories", tags=["Catalog"])


@router.get("", response_model=PagedResponse[CategoryResponse])
async def list_categories(
    params: ListParamsDep,
    conn: Connection = Depends(get_conn),
) -> PagedResponse[CategoryResponse]:
    page = await category_repository.list_categories(conn, params)
    return PagedResponse(
        items=page.items,
        total=page.total,
        skip=params.skip,
        limit=params.limit,
        has_more=page.has_more,
    )
