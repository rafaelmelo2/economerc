"""Exclusão de conta (LGPD/App Store) — orquestra as 4 tabelas do bloco 2A."""

from uuid import UUID

from asyncpg import Connection

from api.core.exceptions import NotFoundError
from api.repositories.auth.refresh_token_repository import refresh_token_repository
from api.repositories.auth.user_identity_repository import user_identity_repository
from api.repositories.users.user_preferences_repository import user_preferences_repository
from api.repositories.users.user_repository import user_repository


async def delete_account(conn: Connection, user_id: UUID) -> None:
    """Anonimiza `users`, revoga TODOS os refresh tokens e apaga identidades/preferências.

    Ordem importa pouco (mesma conexão/transação implícita por request), mas o
    anonimize primeiro garante que um 404 aborta antes de qualquer revogação.
    """
    anonymized = await user_repository.soft_delete_and_anonymize(conn, user_id)
    if not anonymized:
        raise NotFoundError(detail="Usuário não encontrado")
    await refresh_token_repository.revoke_all_for_user(conn, user_id)
    await user_identity_repository.delete_for_user(conn, user_id)
    await user_preferences_repository.delete_for_user(conn, user_id)
