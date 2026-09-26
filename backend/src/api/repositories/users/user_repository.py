"""Repositório de `users` (skill `database`). Soft-delete + anonimização (LGPD)."""

from uuid import UUID

from asyncpg import Connection


class UserRepository:
    async def create(
        self, conn: Connection, *, email: str | None, display_name: str | None
    ) -> dict:
        row = await conn.fetchrow(
            """
            INSERT INTO users (email, display_name)
            VALUES ($1, $2)
            RETURNING *
            """,
            email,
            display_name,
        )
        return dict(row)

    async def get_by_id(self, conn: Connection, user_id: UUID) -> dict | None:
        """Sem filtro de `deleted_at` — quem chama decide o que fazer com uma conta apagada."""
        row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        return dict(row) if row else None

    async def get_active_by_email(self, conn: Connection, email: str) -> dict | None:
        row = await conn.fetchrow(
            "SELECT * FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL",
            email,
        )
        return dict(row) if row else None

    async def update_last_login(self, conn: Connection, user_id: UUID) -> None:
        await conn.execute(
            "UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1",
            user_id,
        )

    async def set_role(self, conn: Connection, user_id: UUID, role: str) -> dict | None:
        """Promoção por e-mail admin (bloco 5B) — nunca rebaixa fora daqui, e nunca

        mexe quando o papel já é o mesmo (evita `updated_at` sem mudança real).
        """
        row = await conn.fetchrow(
            "UPDATE users SET role = $2, updated_at = now() WHERE id = $1 RETURNING *",
            user_id,
            role,
        )
        return dict(row) if row else None

    async def soft_delete_and_anonymize(self, conn: Connection, user_id: UUID) -> bool:
        """LGPD/App Store: apaga PII e marca `deleted_at`. `email`/`display_name`

        somem para o e-mail poder ser reusado (índice único é partial).
        """
        deleted_id = await conn.fetchval(
            """
            UPDATE users
               SET email = NULL, display_name = NULL, deleted_at = now(), updated_at = now()
             WHERE id = $1 AND deleted_at IS NULL
             RETURNING id
            """,
            user_id,
        )
        return deleted_id is not None


user_repository = UserRepository()
