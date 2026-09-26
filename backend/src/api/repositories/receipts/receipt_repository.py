"""Repositório de `receipts` (skill `database`). Sem soft-delete — histórico é imutável;
o ciclo de vida é a máquina de estados `status` (ver `receipt_event_repository.py`)."""

import datetime as dt
from dataclasses import dataclass
from decimal import Decimal
from typing import Final
from uuid import UUID

from asyncpg import Connection

from api.repositories.shared.listing import ListPage, ListParams, sentinel
from api.repositories.shared.sorting import SortMap, by_column, order_by

_LIST_FILTER: Final = """
    FROM receipts
    WHERE user_id = $1
"""

# FROM + WHERE compartilhados entre a página e o COUNT de `GET /admin/receipts`. $1 = status
# (nullable = todos) — o admin usa `status=failed` pra fila de reprocessamento.
_ADMIN_LIST_FILTER: Final = """
    FROM receipts r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN markets m ON m.id = r.market_id
    WHERE ($1::text IS NULL OR r.status = $1)
"""

_ADMIN_SORTS: SortMap = {
    "created_at": by_column("created_at", alias="r", default_order="desc"),
}


@dataclass(frozen=True, slots=True)
class NewReceipt:
    user_id: UUID
    client_id: UUID
    access_key: str
    state_code: str
    qr_url: str
    status: str
    cart_id: UUID | None = None


class ReceiptRepository:
    async def create(self, conn: Connection, receipt: NewReceipt) -> dict:
        row = await conn.fetchrow(
            """
            INSERT INTO receipts (user_id, client_id, cart_id, access_key, state_code,
                                   qr_url, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            """,
            receipt.user_id,
            receipt.client_id,
            receipt.cart_id,
            receipt.access_key,
            receipt.state_code,
            receipt.qr_url,
            receipt.status,
        )
        return dict(row)

    async def get_by_id(self, conn: Connection, receipt_id: UUID) -> dict | None:
        row = await conn.fetchrow("SELECT * FROM receipts WHERE id = $1", receipt_id)
        return dict(row) if row else None

    async def get_by_id_for_user(
        self, conn: Connection, receipt_id: UUID, user_id: UUID
    ) -> dict | None:
        row = await conn.fetchrow(
            "SELECT * FROM receipts WHERE id = $1 AND user_id = $2", receipt_id, user_id
        )
        return dict(row) if row else None

    async def get_by_client_id(
        self, conn: Connection, user_id: UUID, client_id: UUID
    ) -> dict | None:
        """Replay do mesmo `(user_id, client_id)` — idempotência do POST (retry de rede)."""
        row = await conn.fetchrow(
            "SELECT * FROM receipts WHERE user_id = $1 AND client_id = $2", user_id, client_id
        )
        return dict(row) if row else None

    async def get_active_by_access_key(self, conn: Connection, access_key: str) -> dict | None:
        """A linha "canônica" (não-duplicada) desta chave, se já existir."""
        row = await conn.fetchrow(
            "SELECT * FROM receipts WHERE access_key = $1 AND status <> 'duplicate'", access_key
        )
        return dict(row) if row else None

    async def list_for_user(self, conn: Connection, user_id: UUID, params: ListParams) -> ListPage:
        order = "created_at DESC, id DESC"
        rows = await conn.fetch(
            f"SELECT * {_LIST_FILTER} ORDER BY {order} LIMIT $2 OFFSET $3",
            user_id,
            params.fetch_limit,
            params.skip,
        )
        total = None
        if params.wants_total:
            total = await conn.fetchval(f"SELECT COUNT(*) {_LIST_FILTER}", user_id)
        return sentinel(rows, params, total)

    async def mark_processing(self, conn: Connection, receipt_id: UUID) -> dict | None:
        """`attempts += 1` e `status = 'processing'` — chamado uma vez por tentativa do worker."""
        row = await conn.fetchrow(
            """
            UPDATE receipts
               SET status     = 'processing',
                   attempts   = attempts + 1,
                   updated_at = now()
             WHERE id = $1
             RETURNING *
            """,
            receipt_id,
        )
        return dict(row) if row else None

    async def mark_done(
        self,
        conn: Connection,
        receipt_id: UUID,
        *,
        market_id: UUID,
        issued_at: dt.datetime,
        total_amount: Decimal,
        discount_amount: Decimal | None,
        raw_html: str,
    ) -> dict | None:
        row = await conn.fetchrow(
            """
            UPDATE receipts
               SET status          = 'done',
                   market_id       = $2,
                   issued_at       = $3,
                   total_amount    = $4,
                   discount_amount = $5,
                   raw_html        = $6,
                   failure_reason  = NULL,
                   updated_at      = now()
             WHERE id = $1
             RETURNING *
            """,
            receipt_id,
            market_id,
            issued_at,
            total_amount,
            discount_amount,
            raw_html,
        )
        return dict(row) if row else None

    async def mark_failed(self, conn: Connection, receipt_id: UUID, reason: str) -> dict | None:
        row = await conn.fetchrow(
            """
            UPDATE receipts
               SET status         = 'failed',
                   failure_reason = $2,
                   updated_at     = now()
             WHERE id = $1
             RETURNING *
            """,
            receipt_id,
            reason[:200],
        )
        return dict(row) if row else None

    async def reset_to_pending(
        self, conn: Connection, receipt_id: UUID, reason: str
    ) -> dict | None:
        """Falha retryable (rate limit, timeout) — volta pra fila via NAK, motivo só informativo."""
        row = await conn.fetchrow(
            """
            UPDATE receipts
               SET status         = 'pending',
                   failure_reason = $2,
                   updated_at     = now()
             WHERE id = $1
             RETURNING *
            """,
            receipt_id,
            reason[:200],
        )
        return dict(row) if row else None

    async def list_for_admin(
        self, conn: Connection, params: ListParams, *, status: str | None
    ) -> ListPage:
        order = order_by(_ADMIN_SORTS, params.sort, params.order, default="created_at")
        rows = await conn.fetch(
            f"""
            SELECT r.*, u.email AS user_email, m.trade_name AS market_name
              {_ADMIN_LIST_FILTER}
             ORDER BY {order}
             LIMIT $2 OFFSET $3
            """,
            status,
            params.fetch_limit,
            params.skip,
        )
        total = None
        if params.wants_total:
            total = await conn.fetchval(f"SELECT COUNT(*) {_ADMIN_LIST_FILTER}", status)
        return sentinel(rows, params, total)

    async def mark_duplicate(self, conn: Connection, receipt: NewReceipt, canonical: dict) -> dict:
        """Nota já processada por outra pessoa — histórico próprio, sem reprocessar."""
        row = await conn.fetchrow(
            """
            INSERT INTO receipts (user_id, client_id, cart_id, access_key, state_code, qr_url,
                                   status, market_id, issued_at, total_amount, discount_amount)
            VALUES ($1, $2, $3, $4, $5, $6, 'duplicate', $7, $8, $9, $10)
            RETURNING *
            """,
            receipt.user_id,
            receipt.client_id,
            receipt.cart_id,
            receipt.access_key,
            receipt.state_code,
            receipt.qr_url,
            canonical["market_id"],
            canonical["issued_at"],
            canonical["total_amount"],
            canonical["discount_amount"],
        )
        return dict(row)


receipt_repository = ReceiptRepository()
