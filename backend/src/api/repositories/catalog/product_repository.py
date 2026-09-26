"""Repositório de `products` (skill `database`). EAN é a chave natural; soft-delete."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Final
from uuid import UUID

from asyncpg import Connection

from api.repositories.shared.listing import ListPage, ListParams, sentinel
from api.repositories.shared.sorting import SortMap, by_column, order_by

# FROM + WHERE compartilhados entre a query de página e a de COUNT — nunca divergem.
# $1 = search (nome ILIKE ou EAN exato). Paginação ($2/$3) vem depois.
_LIST_FILTER: Final = """
    FROM products
    WHERE deleted_at IS NULL
      AND ($1::text IS NULL OR name ILIKE '%' || $1 || '%' OR ean = $1)
"""

_SORTS: SortMap = {
    "name": by_column("name"),
    "created_at": by_column("created_at", default_order="desc"),
}


@dataclass(frozen=True, slots=True)
class NewProduct:
    """Input de CREATE — Pydantic/dataclass completo (id/timestamps ficam por conta do DB)."""

    name: str
    ean: str | None = None
    brand: str | None = None
    category_id: UUID | None = None
    unit: str = "un"
    net_quantity: Decimal | None = None
    image_upload_id: UUID | None = None
    source: str = "manual"


class ProductRepository:
    async def list_products(self, conn: Connection, params: ListParams) -> ListPage:
        order = order_by(_SORTS, params.sort, params.order, default="created_at")
        rows = await conn.fetch(
            f"SELECT * {_LIST_FILTER} ORDER BY {order} LIMIT $2 OFFSET $3",
            params.search,
            params.fetch_limit,
            params.skip,
        )
        total = None
        if params.wants_total:
            total = await conn.fetchval(f"SELECT COUNT(*) {_LIST_FILTER}", params.search)
        return sentinel(rows, params, total)

    async def get_by_id(self, conn: Connection, product_id: UUID) -> dict | None:
        row = await conn.fetchrow(
            "SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL", product_id
        )
        return dict(row) if row else None

    async def get_by_ean(self, conn: Connection, ean: str) -> dict | None:
        row = await conn.fetchrow(
            "SELECT * FROM products WHERE ean = $1 AND deleted_at IS NULL", ean
        )
        return dict(row) if row else None

    async def create(self, conn: Connection, product: NewProduct) -> dict:
        row = await conn.fetchrow(
            """
            INSERT INTO products (ean, name, brand, category_id, unit, net_quantity,
                                   image_upload_id, source)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            """,
            product.ean,
            product.name,
            product.brand,
            product.category_id,
            product.unit,
            product.net_quantity,
            product.image_upload_id,
            product.source,
        )
        return dict(row)

    async def update(self, conn: Connection, product_id: UUID, fields: dict) -> dict | None:
        """`fields` contém só os campos que mudaram (COALESCE preserva o resto)."""
        row = await conn.fetchrow(
            """
            UPDATE products
               SET name            = COALESCE($2, name),
                   brand           = COALESCE($3, brand),
                   category_id     = COALESCE($4, category_id),
                   unit            = COALESCE($5, unit),
                   net_quantity    = COALESCE($6, net_quantity),
                   image_upload_id = COALESCE($7, image_upload_id),
                   updated_at      = now()
             WHERE id = $1
               AND deleted_at IS NULL
             RETURNING *
            """,
            product_id,
            fields.get("name"),
            fields.get("brand"),
            fields.get("category_id"),
            fields.get("unit"),
            fields.get("net_quantity"),
            fields.get("image_upload_id"),
        )
        return dict(row) if row else None

    async def soft_delete(self, conn: Connection, product_id: UUID) -> bool:
        deleted_id = await conn.fetchval(
            """
            UPDATE products SET deleted_at = now()
             WHERE id = $1 AND deleted_at IS NULL
             RETURNING id
            """,
            product_id,
        )
        return deleted_id is not None


product_repository = ProductRepository()
