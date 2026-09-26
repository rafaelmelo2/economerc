"""Repositório de `cities` (skill `database`). Tabela de referência (sem soft-delete)."""

from typing import Final
from uuid import UUID

from asyncpg import Connection

from api.repositories.shared.listing import ListPage, ListParams, sentinel
from api.repositories.shared.sorting import SortMap, by_column, order_by

# FROM + WHERE compartilhados entre a query de página e a de COUNT — nunca divergem.
# $1 = search (nome ILIKE). Paginação ($2/$3) vem depois.
_LIST_FILTER: Final = """
    FROM cities
    WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%')
"""

_SORTS: SortMap = {
    "name": by_column("name"),
    "ibge_code": by_column("ibge_code"),
}


class CityRepository:
    async def list_cities(self, conn: Connection, params: ListParams) -> ListPage:
        order = order_by(_SORTS, params.sort, params.order, default="name")
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

    async def get_by_id(self, conn: Connection, city_id: UUID) -> dict | None:
        row = await conn.fetchrow("SELECT * FROM cities WHERE id = $1", city_id)
        return dict(row) if row else None

    async def get_by_ibge_code(self, conn: Connection, ibge_code: int) -> dict | None:
        row = await conn.fetchrow("SELECT * FROM cities WHERE ibge_code = $1", ibge_code)
        return dict(row) if row else None


city_repository = CityRepository()
