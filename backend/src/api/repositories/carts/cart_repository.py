"""Repositório de `carts` (skill `database`). Upsert idempotente por
`(user_id, client_id)` — quem decide CREATE vs UPDATE e resolve o LWW por
campo é `services/sync/sync_service.py`; este módulo só executa SQL.
"""

import datetime as dt
from typing import Any, Final
from uuid import UUID

from asyncpg import Connection

DEFAULT_CART_STATUS: Final = "open"  # espelha o DEFAULT da coluna (migration 20260926050001)


class CartRepository:
    async def get_by_client_id(
        self, conn: Connection, user_id: UUID, client_id: UUID
    ) -> dict | None:
        """Inclui linhas com `deleted_at` preenchido — o service precisa ver o tombstone."""
        row = await conn.fetchrow(
            "SELECT * FROM carts WHERE user_id = $1 AND client_id = $2",
            user_id,
            client_id,
        )
        return dict(row) if row else None

    async def get_by_id(self, conn: Connection, cart_id: UUID) -> dict | None:
        """Usado quando só se tem o `cart_id` interno (FK de `cart_items`), não o `client_id`
        do dono — ver `services/sync/sync_service.py` > geração de preço da comunidade."""
        row = await conn.fetchrow("SELECT * FROM carts WHERE id = $1", cart_id)
        return dict(row) if row else None

    async def create(
        self,
        conn: Connection,
        user_id: UUID,
        client_id: UUID,
        fields: dict[str, Any],
        field_versions: dict[str, str],
        updated_at: dt.datetime,
    ) -> dict:
        row = await conn.fetchrow(
            """
            INSERT INTO carts (
                user_id, client_id, market_id, status, budget,
                started_at, closed_at, field_versions, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()), $7, $8, $9)
            RETURNING *
            """,
            user_id,
            client_id,
            fields.get("market_id"),
            fields.get("status") or DEFAULT_CART_STATUS,
            fields.get("budget"),
            fields.get("started_at"),
            fields.get("closed_at"),
            field_versions,
            updated_at,
        )
        return dict(row)

    async def update(
        self,
        conn: Connection,
        cart_id: UUID,
        fields: dict[str, Any],
        field_versions_delta: dict[str, str],
        updated_at: dt.datetime,
    ) -> dict:
        """`fields`/`field_versions_delta` só têm as chaves que venceram o LWW.

        COALESCE preserva o resto (skill `database`). Limitação conhecida: não
        dá pra usar isto pra LIMPAR um campo nullable pra NULL explicitamente
        (ambíguo com "não mudou") — sem caso de uso disso em `carts` hoje.
        """
        row = await conn.fetchrow(
            """
            UPDATE carts
               SET market_id      = COALESCE($2, market_id),
                   status          = COALESCE($3, status),
                   budget          = COALESCE($4, budget),
                   started_at      = COALESCE($5, started_at),
                   closed_at       = COALESCE($6, closed_at),
                   field_versions  = field_versions || $7::jsonb,
                   updated_at      = $8
             WHERE id = $1
             RETURNING *
            """,
            cart_id,
            fields.get("market_id"),
            fields.get("status"),
            fields.get("budget"),
            fields.get("started_at"),
            fields.get("closed_at"),
            field_versions_delta,
            updated_at,
        )
        return dict(row)

    async def soft_delete(
        self,
        conn: Connection,
        cart_id: UUID,
        field_versions_delta: dict[str, str],
        updated_at: dt.datetime,
    ) -> dict:
        row = await conn.fetchrow(
            """
            UPDATE carts
               SET deleted_at     = $2,
                   field_versions = field_versions || $3::jsonb,
                   updated_at     = $2
             WHERE id = $1
             RETURNING *
            """,
            cart_id,
            updated_at,
            field_versions_delta,
        )
        return dict(row)


cart_repository = CartRepository()
