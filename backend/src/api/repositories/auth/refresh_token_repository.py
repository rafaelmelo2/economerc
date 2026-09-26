"""Repositório de `refresh_tokens` (skill `auth` > auth-hardened.md).

`claim_if_unused` é o único caminho de rotação — atômico via `UPDATE ...
WHERE used = false RETURNING *`, fecha o TOCTOU de dois refreshes concorrentes.
"""

import datetime as dt
from uuid import UUID

from asyncpg import Connection


class RefreshTokenRepository:
    async def create(
        self,
        conn: Connection,
        *,
        user_id: UUID,
        family: UUID,
        family_created_at: dt.datetime,
        token_hash: str,
        expires_at: dt.datetime,
    ) -> dict:
        row = await conn.fetchrow(
            """
            INSERT INTO refresh_tokens (user_id, family, family_created_at, token_hash, expires_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            """,
            user_id,
            family,
            family_created_at,
            token_hash,
            expires_at,
        )
        return dict(row)

    async def claim_if_unused(self, conn: Connection, token_hash: str) -> dict | None:
        row = await conn.fetchrow(
            """
            UPDATE refresh_tokens SET used = true
             WHERE token_hash = $1 AND used = false AND revoked_at IS NULL
            RETURNING *
            """,
            token_hash,
        )
        return dict(row) if row else None

    async def find_by_token_hash(self, conn: Connection, token_hash: str) -> dict | None:
        row = await conn.fetchrow("SELECT * FROM refresh_tokens WHERE token_hash = $1", token_hash)
        return dict(row) if row else None

    async def find_active_head_for_family(self, conn: Connection, family: UUID) -> dict | None:
        row = await conn.fetchrow(
            """
            SELECT * FROM refresh_tokens
             WHERE family = $1 AND used = false AND revoked_at IS NULL
             LIMIT 1
            """,
            family,
        )
        return dict(row) if row else None

    async def revoke_family(self, conn: Connection, family: UUID) -> None:
        await conn.execute(
            "UPDATE refresh_tokens SET revoked_at = now() WHERE family = $1 AND revoked_at IS NULL",
            family,
        )

    async def revoke_all_for_user(self, conn: Connection, user_id: UUID) -> None:
        await conn.execute(
            "UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
            user_id,
        )

    async def gc_dead_rows(self, conn: Connection, user_id: UUID, retention_seconds: int) -> None:
        """Deleta linhas revogadas/expiradas, e `used=true` cujo sucessor já passou

        da retenção (skill `auth` §3b — gata no `created_at` do SUCESSOR, nunca
        no da própria linha, senão ressuscita o replay perdido).
        """
        await conn.execute(
            """
            DELETE FROM refresh_tokens t
             WHERE t.user_id = $1
               AND (
                     t.revoked_at IS NOT NULL
                     OR t.expires_at < now()
                     OR (t.used = true AND EXISTS (
                           SELECT 1 FROM refresh_tokens s
                            WHERE s.family = t.family
                              AND s.created_at > t.created_at
                              AND s.created_at < now() - ($2 * INTERVAL '1 second')))
                   )
            """,
            user_id,
            retention_seconds,
        )


refresh_token_repository = RefreshTokenRepository()
