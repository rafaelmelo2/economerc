from uuid import UUID

from asyncpg import Connection
from fastapi import APIRouter, Depends
from valkey.asyncio import Valkey

from api.core.exceptions import NotFoundError
from api.core.valkey_client import get_valkey
from api.dependencies.auth import AdminUser, CurrentUser
from api.models.shared.paged_response import PagedResponse
from api.repositories.catalog.product_repository import NewProduct, product_repository
from api.routes.shared.list_params import ListParamsDep
from api.schemas.catalog.product import (
    ProductCreateRequest,
    ProductResponse,
    ProductUpdateRequest,
)
from api.services.catalog.product_lookup_service import resolve_product_by_ean
from config.database import get_conn

router = APIRouter(prefix="/products", tags=["Catalog"])


@router.get("/by-ean/{ean}", response_model=ProductResponse)
async def get_product_by_ean(
    ean: str,
    user: CurrentUser,
    conn: Connection = Depends(get_conn),
    valkey: Valkey = Depends(get_valkey),
) -> ProductResponse:
    """Postgres → Valkey → Open Food Facts (Etapa 3). 400 = EAN inválido; 404 = inexistente."""
    product = await resolve_product_by_ean(conn, valkey, ean)
    return ProductResponse(**product)


@router.get("", response_model=PagedResponse[ProductResponse])
async def list_products(
    user: AdminUser,
    params: ListParamsDep,
    conn: Connection = Depends(get_conn),
) -> PagedResponse[ProductResponse]:
    page = await product_repository.list_products(conn, params)
    return PagedResponse(
        items=page.items,
        total=page.total,
        skip=params.skip,
        limit=params.limit,
        has_more=page.has_more,
    )


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: UUID, user: AdminUser, conn: Connection = Depends(get_conn)
) -> ProductResponse:
    product = await product_repository.get_by_id(conn, product_id)
    if product is None:
        raise NotFoundError(detail="Produto não encontrado.")
    return ProductResponse(**product)


@router.post("", response_model=ProductResponse, status_code=201)
async def create_product(
    body: ProductCreateRequest, user: AdminUser, conn: Connection = Depends(get_conn)
) -> ProductResponse:
    product = await product_repository.create(
        conn,
        NewProduct(
            ean=body.ean,
            name=body.name,
            brand=body.brand,
            category_id=body.category_id,
            unit=body.unit,
            net_quantity=body.net_quantity,
            image_upload_id=body.image_upload_id,
            source="manual",
        ),
    )
    return ProductResponse(**product)


@router.patch("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: UUID,
    body: ProductUpdateRequest,
    user: AdminUser,
    conn: Connection = Depends(get_conn),
) -> ProductResponse:
    product = await product_repository.update(conn, product_id, body.model_dump(exclude_unset=True))
    if product is None:
        raise NotFoundError(detail="Produto não encontrado.")
    return ProductResponse(**product)


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: UUID, user: AdminUser, conn: Connection = Depends(get_conn)
) -> None:
    deleted = await product_repository.soft_delete(conn, product_id)
    if not deleted:
        raise NotFoundError(detail="Produto não encontrado.")
