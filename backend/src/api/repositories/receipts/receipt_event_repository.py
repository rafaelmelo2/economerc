"""Repositório de `receipt_events` (skill `database`) — log append-only das transições de
`receipts.status`, gravado pelo worker a cada mudança (docs/fases-construcao.md > Onda 4)."""

from uuid import UUID

from asyncpg import Connection


class ReceiptEventRepository:
    async def append(
        self,
        conn: Connection,
        receipt_id: UUID,
        *,
        from_status: str | None,
        to_status: str,
        detail: str | None = None,
    ) -> dict:
        row = await conn.fetchrow(
            """
            INSERT INTO receipt_events (receipt_id, from_status, to_status, detail)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            """,
            receipt_id,
            from_status,
            to_status,
            detail[:300] if detail else None,
        )
        return dict(row)

    async def list_by_receipt(self, conn: Connection, receipt_id: UUID) -> list[dict]:
        rows = await conn.fetch(
            "SELECT * FROM receipt_events WHERE receipt_id = $1 ORDER BY created_at", receipt_id
        )
        return [dict(row) for row in rows]


receipt_event_repository = ReceiptEventRepository()
