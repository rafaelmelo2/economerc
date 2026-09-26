"""Repositório de `categories` (skill `database`). Tabela de referência (sem soft-delete)."""

from typing import Final
from uuid import UUID

from asyncpg import Connection

from api.repositories.shared.listing import ListPage, ListParams, sentinel
from api.repositories.shared.sorting import SortMap, by_column, order_by

_LIST_FILTER: Final = """
    FROM categories
    WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%' OR slug ILIKE '%' || $1 || '%')
"""

_SORTS: SortMap = {
    "position": by_column("position"),
    "name": by_column("name"),
}


class CategoryRepository:
    async def list_categories(self, conn: Connection, params: ListParams) -> ListPage:
        order = order_by(_SORTS, params.sort, params.order, default="position")
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

    async def get_by_id(self, conn: Connection, category_id: UUID) -> dict | None:
        row = await conn.fetchrow("SELECT * FROM categories WHERE id = $1", category_id)
        return dict(row) if row else None

    async def list_all(self, conn: Connection) -> list[dict]:
        """Sem paginação — tabela de referência pequena (10 linhas na Fase 1). Uso
        interno (prompt da IA de categorização, validação de slug), não é endpoint."""
        rows = await conn.fetch("SELECT * FROM categories ORDER BY position")
        return [dict(row) for row in rows]

    async def get_by_slug(self, conn: Connection, slug: str) -> dict | None:
        row = await conn.fetchrow("SELECT * FROM categories WHERE slug = $1", slug)
        return dict(row) if row else None

    async def find_by_ncm(self, conn: Connection, ncm: str) -> dict | None:
        """Regra de categorização: casa o NCM do item contra os prefixos cadastrados.

        `ncm_prefixes` é `VARCHAR(8)[]`; o prefixo mais longo que casar vence
        (ex.: '0201' bate carnes antes de um prefixo genérico '02').
        """
        row = await conn.fetchrow(
            """
            SELECT c.*
              FROM categories c, unnest(c.ncm_prefixes) AS prefix
             WHERE $1 LIKE (prefix || '%')
             ORDER BY length(prefix) DESC
             LIMIT 1
            """,
            ncm,
        )
        return dict(row) if row else None


category_repository = CategoryRepository()
