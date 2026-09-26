"""Get-or-create de usuário a partir de uma identidade Google/Apple.

Regra de negócio (docs/roadmap-fase1.md > Etapa 2): mesmo e-mail verificado em
provedores diferentes vira a MESMA conta — a 2ª vinculação só adiciona uma
linha em `user_identities`, nunca um `users` duplicado.
"""

from asyncpg import Connection

from api.core.exceptions import UnauthorizedError
from api.models.auth.user_identity import AuthProvider
from api.repositories.auth.user_identity_repository import user_identity_repository
from api.repositories.users.user_repository import user_repository


async def get_or_create_user_for_identity(
    conn: Connection,
    *,
    provider: AuthProvider,
    subject: str,
    email: str | None,
    display_name: str | None,
) -> dict:
    identity = await user_identity_repository.find_by_provider_subject(conn, provider, subject)
    if identity is not None:
        user = await user_repository.get_by_id(conn, identity["user_id"])
        if user is None or user["deleted_at"] is not None:
            raise UnauthorizedError(detail="Conta associada a este login não existe mais")
        return user

    user = await user_repository.get_active_by_email(conn, email) if email else None
    if user is None:
        user = await user_repository.create(conn, email=email, display_name=display_name)

    await user_identity_repository.create(
        conn, user_id=user["id"], provider=provider, subject=subject, email=email
    )
    return user
