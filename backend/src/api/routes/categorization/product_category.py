"""`PATCH /api/products/{id}/category` — correção manual (docs/roadmap-fase1.md >
Etapa 8). Tem prioridade sobre NCM/regra/IA (`category_source='user'`) e nunca é
reprocessada pelo job em lote (`list_uncategorized` só pega `category_id IS NULL`).
"""

from uuid import UUID

from asyncpg import Connection
from fastapi import APIRouter, Depends

from api.core.exceptions import NotFoundError
from api.dependencies.auth import CurrentUser
from api.repositories.catalog.category_repository import category_repository
from api.repositories.catalog.product_repository import product_repository
from api.repositories.categorization.category_correction_repository import (
    NewCategoryCorrection,
    category_correction_repository,
)
from api.schemas.categorization.category import (
    ProductCategoryResponse,
    ProductCategoryUpdateRequest,
)
from config.database import get_conn

router = APIRouter(prefix="/products", tags=["Categorization"])

CATEGORY_SOURCE_USER = "user"


@router.patch("/{product_id}/category", response_model=ProductCategoryResponse)
async def correct_product_category(
    product_id: UUID,
    body: ProductCategoryUpdateRequest,
    user: CurrentUser,
    conn: Connection = Depends(get_conn),
) -> ProductCategoryResponse:
    product = await product_repository.get_by_id(conn, product_id)
    if product is None:
        raise NotFoundError(detail="Produto não encontrado.")

    category = await category_repository.get_by_id(conn, body.category_id)
    if category is None:
        raise NotFoundError(detail="Categoria não encontrada.")

    await product_repository.update_category(
        conn, product_id, body.category_id, CATEGORY_SOURCE_USER
    )
    await category_correction_repository.create(
        conn,
        NewCategoryCorrection(
            product_id=product_id,
            previous_category_id=product["category_id"],
            category_id=body.category_id,
            corrected_by=user.user_id,
        ),
    )

    return ProductCategoryResponse(
        product_id=product_id,
        category_id=category["id"],
        category_slug=category["slug"],
        category_name=category["name"],
        category_source=CATEGORY_SOURCE_USER,
    )
