"""Rotação de `refresh_tokens` com detecção de reuso (skill `auth` > auth-hardened.md).

Contrato: refresh opaco (`secrets.token_urlsafe`) + SHA-256 no banco + family
rotation. `claim_if_unused` é o único caminho de consumo — atômico, fecha o
TOCTOU de dois refreshes concorrentes reivindicando o mesmo token.
"""

import datetime as dt
import hashlib
import secrets
import uuid
from dataclasses import dataclass
from typing import Final

from asyncpg import Connection

from api.core.exceptions import UnauthorizedError
from api.core.security import ACCESS_TOKEN_TTL, issue_access_token
from api.repositories.auth.refresh_token_repository import refresh_token_repository
from api.repositories.users.user_repository import user_repository
from config.settings import settings

REFRESH_TOKEN_ENTROPY_BYTES: Final = 64


@dataclass(frozen=True, slots=True)
class SessionTokenPair:
    access_token: str
    refresh_token: str
    expires_in: int
    user: dict


def _generate_opaque_refresh_token() -> str:
    return secrets.token_urlsafe(REFRESH_TOKEN_ENTROPY_BYTES)


def _hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def issue_new_session(conn: Connection, user: dict) -> SessionTokenPair:
    """Cunha uma family nova — 1 por login (per-device), igual ao contrato da skill."""
    now = dt.datetime.now(dt.UTC)
    raw_refresh = _generate_opaque_refresh_token()
    ttl = dt.timedelta(days=settings.auth.refresh_token.ttl_days)
    await refresh_token_repository.create(
        conn,
        user_id=user["id"],
        family=uuid.uuid4(),
        family_created_at=now,
        token_hash=_hash_refresh_token(raw_refresh),
        expires_at=now + ttl,
    )
    access_token = issue_access_token(user["id"], user["role"])
    return SessionTokenPair(
        access_token=access_token,
        refresh_token=raw_refresh,
        expires_in=int(ACCESS_TOKEN_TTL.total_seconds()),
        user=user,
    )


async def _issue_rotated_pair(conn: Connection, claimed: dict) -> SessionTokenPair:
    now = dt.datetime.now(dt.UTC)
    absolute_lifetime = dt.timedelta(days=settings.auth.refresh_token.absolute_lifetime_days)
    if now >= claimed["family_created_at"] + absolute_lifetime:
        await refresh_token_repository.revoke_family(conn, claimed["family"])
        raise UnauthorizedError(detail="Sessão expirada — faça login novamente")

    user = await user_repository.get_by_id(conn, claimed["user_id"])
    if user is None or user["deleted_at"] is not None:
        await refresh_token_repository.revoke_family(conn, claimed["family"])
        raise UnauthorizedError(detail="Usuário inválido")

    raw_refresh = _generate_opaque_refresh_token()
    ttl = dt.timedelta(days=settings.auth.refresh_token.ttl_days)
    await refresh_token_repository.create(
        conn,
        user_id=user["id"],
        family=claimed["family"],
        family_created_at=claimed["family_created_at"],
        token_hash=_hash_refresh_token(raw_refresh),
        expires_at=now + ttl,
    )
    await refresh_token_repository.gc_dead_rows(
        conn, user["id"], settings.auth.refresh_token.gc_retention_seconds
    )
    access_token = issue_access_token(user["id"], user["role"])
    return SessionTokenPair(
        access_token=access_token,
        refresh_token=raw_refresh,
        expires_in=int(ACCESS_TOKEN_TTL.total_seconds()),
        user=user,
    )


async def _try_grace_recovery(conn: Connection, row: dict) -> SessionTokenPair | None:
    """Janela de graça (10-30s): recupera um Set-Cookie/resposta perdida logo

    após uma rotação sem queimar a família — só dentro da janela E se o head
    ainda estiver livre (`claim_if_unused`); senão cai no replay genuíno.
    """
    head = await refresh_token_repository.find_active_head_for_family(conn, row["family"])
    if head is None:
        return None
    grace = dt.timedelta(seconds=settings.auth.refresh_token.reuse_grace_seconds)
    if dt.datetime.now(dt.UTC) - head["created_at"] > grace:
        return None
    recovered = await refresh_token_repository.claim_if_unused(conn, head["token_hash"])
    if recovered is None:
        return None
    return await _issue_rotated_pair(conn, recovered)


async def rotate_refresh_token(conn: Connection, raw_refresh: str) -> SessionTokenPair:
    digest = _hash_refresh_token(raw_refresh)

    claimed = await refresh_token_repository.claim_if_unused(conn, digest)
    if claimed is not None:
        return await _issue_rotated_pair(conn, claimed)

    row = await refresh_token_repository.find_by_token_hash(conn, digest)
    if row is None:
        raise UnauthorizedError(detail="Refresh token inválido")
    if row["revoked_at"] is not None:
        raise UnauthorizedError(detail="Sessão revogada")

    recovered = await _try_grace_recovery(conn, row)
    if recovered is not None:
        return recovered

    # Token já `used`, fora da janela de graça, família ainda viva: reuso real.
    await refresh_token_repository.revoke_family(conn, row["family"])
    raise UnauthorizedError(detail="Reuso de refresh token detectado — sessão encerrada")


async def revoke_session(conn: Connection, raw_refresh: str) -> None:
    """Logout: revoga a family inteira. Best-effort — token desconhecido é no-op."""
    row = await refresh_token_repository.find_by_token_hash(conn, _hash_refresh_token(raw_refresh))
    if row is None:
        return
    await refresh_token_repository.revoke_family(conn, row["family"])
