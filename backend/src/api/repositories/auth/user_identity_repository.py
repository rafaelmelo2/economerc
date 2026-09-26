"""Repositório de `user_identities` (skill `database`) — 1 usuário, N provedores."""

from uuid import UUID

from asyncpg import Connection

from api.models.auth.user_identity import AuthProvider


class UserIdentityRepository:
    async def find_by_provider_subject(
        self, conn: Connection, provider: AuthProvider, subject: str
    ) -> dict | None:
        row = await conn.fetchrow(
            "SELECT * FROM user_identities WHERE provider = $1 AND subject = $2",
            provider,
            subject,
        )
        return dict(row) if row else None

    async def create(
        self,
        conn: Connection,
        *,
        user_id: UUID,
        provider: AuthProvider,
        subject: str,
        email: str | None,
    ) -> dict:
        row = await conn.fetchrow(
            """
            INSERT INTO user_identities (user_id, provider, subject, email)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            """,
            user_id,
            provider,
            subject,
            email,
        )
        return dict(row)

    async def delete_for_user(self, conn: Connection, user_id: UUID) -> None:
        await conn.execute("DELETE FROM user_identities WHERE user_id = $1", user_id)


user_identity_repository = UserIdentityRepository()
