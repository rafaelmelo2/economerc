"""Repositório de `sync_changes` (skill `database`). Log append-only por
usuário; alimentado na MESMA transação do push (garante que pull nunca vê uma
mutação sem o efeito dela em `carts`/`cart_items`, e vice-versa).
"""

import datetime as dt
from typing import Any
from uuid import UUID

from asyncpg import Connection


class SyncChangeRepository:
    async def log_change(
        self,
        conn: Connection,
        user_id: UUID,
        entity: str,
        entity_id: UUID,
        op: str,
        payload: dict[str, Any],
        changed_at: dt.datetime,
    ) -> None:
        await conn.execute(
            """
            INSERT INTO sync_changes (user_id, entity, entity_id, op, payload, changed_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            user_id,
            entity,
            entity_id,
            op,
            payload,
            changed_at,
        )

    async def list_since(
        self, conn: Connection, user_id: UUID, after_id: int, fetch_limit: int
    ) -> list[dict]:
        rows = await conn.fetch(
            """
            SELECT id, entity, entity_id, op, payload, changed_at
              FROM sync_changes
             WHERE user_id = $1 AND id > $2
             ORDER BY id ASC
             LIMIT $3
            """,
            user_id,
            after_id,
            fetch_limit,
        )
        return [dict(row) for row in rows]


sync_change_repository = SyncChangeRepository()
