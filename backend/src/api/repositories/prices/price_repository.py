"""Repositório de `prices` (skill `database`). Sem soft-delete — observação é imutável;
correção é um novo registro. INSERT idempotente por `(reported_by, client_id)`."""

import datetime as dt
from dataclasses import dataclass
from decimal import Decimal
from typing import Final
from uuid import UUID

from asyncpg import Connection

from api.repositories.shared.listing import ListPage, ListParams, sentinel
from api.repositories.shared.sorting import SortMap, by_column, order_by

STALE_AFTER_DAYS: Final = 15

# Um preço "vivo" por (produto, mercado): a observação mais recente — é ISSO que o admin modera
# (docs > "Preço desatualizado: > 15 dias sem confirmação = sinalizado"), não o histórico bruto de
# observações (linha superada não é "desatualizada", é só velha por natureza).
_ADMIN_LATEST_PER_PRODUCT_MARKET: Final = """
    SELECT DISTINCT ON (p.product_id, p.market_id) p.*
      FROM prices p
     ORDER BY p.product_id, p.market_id, p.observed_at DESC, p.id DESC
"""

# FROM + WHERE compartilhados entre a página e o COUNT de `GET /admin/prices`. Todos os filtros
# são opcionais (NULL = "todos") — o admin combina livremente mercado/produto/fonte/desatualizado.
# $1 = market_id, $2 = product_id, $3 = source, $4 = stale_only.
_ADMIN_LIST_FILTER: Final = f"""
    FROM ({_ADMIN_LATEST_PER_PRODUCT_MARKET}) p
    JOIN products pr ON pr.id = p.product_id AND pr.deleted_at IS NULL
    JOIN markets m ON m.id = p.market_id AND m.deleted_at IS NULL
    WHERE ($1::uuid IS NULL OR p.market_id = $1)
      AND ($2::uuid IS NULL OR p.product_id = $2)
      AND ($3::text IS NULL OR p.source = $3)
      AND ($4::bool IS NOT TRUE OR p.observed_at < now() - INTERVAL '{STALE_AFTER_DAYS} days')
"""

_ADMIN_SORTS: SortMap = {
    "observed_at": by_column("observed_at", alias="p", default_order="desc"),
    "amount": by_column("amount", alias="p"),
}


@dataclass(frozen=True, slots=True)
class NewPriceObservation:
    product_id: UUID
    market_id: UUID
    city_id: UUID
    amount: Decimal
    source: str
    confidence: Decimal
    observed_at: dt.datetime
    reported_by: UUID | None = None
    client_id: UUID | None = None
    promo_until: dt.datetime | None = None


class PriceRepository:
    async def create(self, conn: Connection, price: NewPriceObservation) -> dict:
        """Reenviar o mesmo `(reported_by, client_id)` devolve a linha já criada (idempotente)."""
        row = await conn.fetchrow(
            """
            INSERT INTO prices (product_id, market_id, city_id, amount, source, confidence,
                                 reported_by, client_id, observed_at, promo_until)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (reported_by, client_id) WHERE client_id IS NOT NULL DO NOTHING
            RETURNING *
            """,
            price.product_id,
            price.market_id,
            price.city_id,
            price.amount,
            price.source,
            price.confidence,
            price.reported_by,
            price.client_id,
            price.observed_at,
            price.promo_until,
        )
        if row is not None:
            return dict(row)
        existing = await conn.fetchrow(
            "SELECT * FROM prices WHERE reported_by = $1 AND client_id = $2",
            price.reported_by,
            price.client_id,
        )
        return dict(existing)

    async def get_latest_by_market(
        self, conn: Connection, product_id: UUID, city_id: UUID
    ) -> list[dict]:
        """Um resultado por mercado: a observação mais recente do produto na cidade."""
        rows = await conn.fetch(
            """
            SELECT DISTINCT ON (p.market_id) p.*, m.trade_name AS market_name
              FROM prices p
              JOIN markets m ON m.id = p.market_id
             WHERE p.product_id = $1
               AND p.city_id = $2
               AND m.deleted_at IS NULL
             ORDER BY p.market_id, p.observed_at DESC, p.id DESC
            """,
            product_id,
            city_id,
        )
        return [dict(row) for row in rows]

    async def list_for_admin(
        self,
        conn: Connection,
        params: ListParams,
        *,
        market_id: UUID | None,
        product_id: UUID | None,
        source: str | None,
        stale_only: bool,
    ) -> ListPage:
        """Último preço por (produto, mercado), com nome de produto/mercado e `is_stale`."""
        order = order_by(_ADMIN_SORTS, params.sort, params.order, default="observed_at")
        rows = await conn.fetch(
            f"""
            SELECT p.*,
                   pr.name AS product_name,
                   pr.ean AS product_ean,
                   m.trade_name AS market_name,
                   p.observed_at < now() - INTERVAL '{STALE_AFTER_DAYS} days' AS is_stale
              {_ADMIN_LIST_FILTER}
             ORDER BY {order}
             LIMIT $5 OFFSET $6
            """,
            market_id,
            product_id,
            source,
            stale_only,
            params.fetch_limit,
            params.skip,
        )
        total = None
        if params.wants_total:
            total = await conn.fetchval(
                f"SELECT COUNT(*) {_ADMIN_LIST_FILTER}", market_id, product_id, source, stale_only
            )
        return sentinel(rows, params, total)


price_repository = PriceRepository()
