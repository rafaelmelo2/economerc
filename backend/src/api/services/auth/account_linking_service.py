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
from config.settings import settings

ADMIN_ROLE = "admin"


def _is_admin_email(email: str | None) -> bool:
    """E-mail verificado na whitelist `auth.admin_emails` (config, nunca hardcode)."""
    if not email:
        return False
    admin_emails = {configured.strip().lower() for configured in settings.auth.admin_emails}
    return email.strip().lower() in admin_emails


async def _ensure_admin_role(conn: Connection, user: dict) -> dict:
    """Roda em TODO login (não só na criação) — e-mail entrou na whitelist depois

    do cadastro também deve virar admin no próximo login (docs/roadmap-fase1.md > Etapa 2).
    """
    if user["role"] == ADMIN_ROLE or not _is_admin_email(user["email"]):
        return user
    promoted = await user_repository.set_role(conn, user["id"], ADMIN_ROLE)
    return promoted or user


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
        return await _ensure_admin_role(conn, user)

    user = await user_repository.get_active_by_email(conn, email) if email else None
    if user is None:
        user = await user_repository.create(conn, email=email, display_name=display_name)

    await user_identity_repository.create(
        conn, user_id=user["id"], provider=provider, subject=subject, email=email
    )
    return await _ensure_admin_role(conn, user)
