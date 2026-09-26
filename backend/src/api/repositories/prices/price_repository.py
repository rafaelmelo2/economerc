"""Repositório de `prices` (skill `database`). Sem soft-delete — observação é imutável;
correção é um novo registro. INSERT idempotente por `(reported_by, client_id)`."""

import datetime as dt
from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from asyncpg import Connection


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


price_repository = PriceRepository()
