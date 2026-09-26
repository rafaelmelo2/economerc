"""Repositório de `markets` (skill `database`). Soft-delete; CNPJ único quando informado."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Final
from uuid import UUID

from asyncpg import Connection

from api.repositories.shared.listing import ListPage, ListParams, sentinel
from api.repositories.shared.sorting import SortMap, by_column, order_by

# FROM + WHERE compartilhados entre a query de página e a de COUNT — nunca divergem.
# $1 = city_id (filtro exato); $2 = search (nome ILIKE). Paginação ($3/$4) vem depois.
_LIST_FILTER: Final = """
    FROM markets
    WHERE deleted_at IS NULL
      AND ($1::uuid IS NULL OR city_id = $1)
      AND ($2::text IS NULL OR trade_name ILIKE '%' || $2 || '%')
"""

_SORTS: SortMap = {
    "trade_name": by_column("trade_name"),
    "created_at": by_column("created_at", default_order="desc"),
}


@dataclass(frozen=True, slots=True)
class NewMarket:
    city_id: UUID
    trade_name: str
    cnpj: str | None = None
    legal_name: str | None = None
    address: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    is_partner: bool = False


class MarketRepository:
    async def list_markets(
        self, conn: Connection, params: ListParams, city_id: UUID | None
    ) -> ListPage:
        order = order_by(_SORTS, params.sort, params.order, default="trade_name")
        rows = await conn.fetch(
            f"SELECT * {_LIST_FILTER} ORDER BY {order} LIMIT $3 OFFSET $4",
            city_id,
            params.search,
            params.fetch_limit,
            params.skip,
        )
        total = None
        if params.wants_total:
            total = await conn.fetchval(f"SELECT COUNT(*) {_LIST_FILTER}", city_id, params.search)
        return sentinel(rows, params, total)

    async def get_by_id(self, conn: Connection, market_id: UUID) -> dict | None:
        row = await conn.fetchrow(
            "SELECT * FROM markets WHERE id = $1 AND deleted_at IS NULL", market_id
        )
        return dict(row) if row else None

    async def create(self, conn: Connection, market: NewMarket) -> dict:
        row = await conn.fetchrow(
            """
            INSERT INTO markets (city_id, trade_name, cnpj, legal_name, address,
                                  latitude, longitude, is_partner)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            """,
            market.city_id,
            market.trade_name,
            market.cnpj,
            market.legal_name,
            market.address,
            market.latitude,
            market.longitude,
            market.is_partner,
        )
        return dict(row)

    async def update(self, conn: Connection, market_id: UUID, fields: dict) -> dict | None:
        row = await conn.fetchrow(
            """
            UPDATE markets
               SET trade_name = COALESCE($2, trade_name),
                   cnpj       = COALESCE($3, cnpj),
                   legal_name = COALESCE($4, legal_name),
                   address    = COALESCE($5, address),
                   latitude   = COALESCE($6, latitude),
                   longitude  = COALESCE($7, longitude),
                   is_partner = COALESCE($8, is_partner),
                   updated_at = now()
             WHERE id = $1
               AND deleted_at IS NULL
             RETURNING *
            """,
            market_id,
            fields.get("trade_name"),
            fields.get("cnpj"),
            fields.get("legal_name"),
            fields.get("address"),
            fields.get("latitude"),
            fields.get("longitude"),
            fields.get("is_partner"),
        )
        return dict(row) if row else None

    async def soft_delete(self, conn: Connection, market_id: UUID) -> bool:
        deleted_id = await conn.fetchval(
            """
            UPDATE markets SET deleted_at = now()
             WHERE id = $1 AND deleted_at IS NULL
             RETURNING id
            """,
            market_id,
        )
        return deleted_id is not None


market_repository = MarketRepository()
