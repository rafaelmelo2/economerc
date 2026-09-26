"""Repositório de `offer_candidates` (skill `database`). Fila de revisão — sem soft-delete;
`status` é a máquina de estados (`pending -> approved|rejected`, nunca volta)."""

import datetime as dt
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Final
from uuid import UUID

from asyncpg import Connection

from api.repositories.shared.listing import ListPage, ListParams, sentinel
from api.repositories.shared.sorting import SortMap, by_column, order_by

# FROM + WHERE compartilhados entre a query de página e a de COUNT — $1 = status (nullable =
# todos), $2 = market_id (nullable = todos). Paginação ($3/$4) vem depois.
_LIST_FILTER: Final = """
    FROM offer_candidates
    WHERE ($1::text IS NULL OR status = $1)
      AND ($2::uuid IS NULL OR market_id = $2)
"""

_SORTS: SortMap = {
    "created_at": by_column("created_at", default_order="desc"),
}


@dataclass(frozen=True, slots=True)
class NewOfferCandidate:
    market_id: UUID
    market_source_id: UUID
    product_name: str
    price_amount: Decimal
    source: str
    unit: str | None = None
    ean: str | None = None
    valid_until: dt.datetime | None = None
    raw_text: str | None = None
    raw_payload: dict[str, Any] | None = None


class OfferCandidateRepository:
    async def list_candidates(
        self, conn: Connection, params: ListParams, *, status: str | None, market_id: UUID | None
    ) -> ListPage:
        order = order_by(_SORTS, params.sort, params.order, default="created_at")
        rows = await conn.fetch(
            f"SELECT * {_LIST_FILTER} ORDER BY {order} LIMIT $3 OFFSET $4",
            status,
            market_id,
            params.fetch_limit,
            params.skip,
        )
        total = None
        if params.wants_total:
            total = await conn.fetchval(f"SELECT COUNT(*) {_LIST_FILTER}", status, market_id)
        return sentinel(rows, params, total)

    async def get_by_id(self, conn: Connection, candidate_id: UUID) -> dict | None:
        row = await conn.fetchrow("SELECT * FROM offer_candidates WHERE id = $1", candidate_id)
        return dict(row) if row else None

    async def create(self, conn: Connection, candidate: NewOfferCandidate) -> dict:
        row = await conn.fetchrow(
            """
            INSERT INTO offer_candidates (market_id, market_source_id, product_name, ean,
                                           price_amount, unit, valid_until, raw_text,
                                           raw_payload, source)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
            """,
            candidate.market_id,
            candidate.market_source_id,
            candidate.product_name,
            candidate.ean,
            candidate.price_amount,
            candidate.unit,
            candidate.valid_until,
            candidate.raw_text,
            candidate.raw_payload or {},
            candidate.source,
        )
        return dict(row)

    async def mark_reviewed(
        self, conn: Connection, candidate_id: UUID, *, status: str, reviewed_by: UUID
    ) -> dict | None:
        """`status` só sai de `pending` — a query trava a transição dupla (aprovar 2x)."""
        row = await conn.fetchrow(
            """
            UPDATE offer_candidates
               SET status = $2, reviewed_by = $3, reviewed_at = now()
             WHERE id = $1
               AND status = 'pending'
             RETURNING *
            """,
            candidate_id,
            status,
            reviewed_by,
        )
        return dict(row) if row else None


offer_candidate_repository = OfferCandidateRepository()
