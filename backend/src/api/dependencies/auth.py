"""Dependências de autenticação para as rotas.

O papel vem do token; o bloco 2A endurece conferindo no banco que o usuário
ainda existe e não foi excluído — um access token válido (assinatura/exp OK)
de uma conta apagada por `DELETE /me` para de autenticar imediatamente, sem
esperar o TTL de 15 min. Assinatura/tipos exportados (`CurrentUser`/`AdminUser`)
não mudam — só o corpo de `require_current_user` ganhou a checagem + `conn`.
"""

from typing import Annotated

from asyncpg import Connection
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from api.core.exceptions import ForbiddenError, UnauthorizedError
from api.core.security import AccessTokenClaims, decode_access_token
from api.repositories.users.user_repository import user_repository
from config.database import get_conn

bearer_scheme = HTTPBearer(auto_error=False)


async def require_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    conn: Annotated[Connection, Depends(get_conn)],
) -> AccessTokenClaims:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthorizedError()
    claims = decode_access_token(credentials.credentials)
    user = await user_repository.get_by_id(conn, claims.user_id)
    if user is None or user["deleted_at"] is not None:
        raise UnauthorizedError()
    return claims


async def require_admin(
    user: Annotated[AccessTokenClaims, Depends(require_current_user)],
) -> AccessTokenClaims:
    if user.role != "admin":
        raise ForbiddenError()
    return user


CurrentUser = Annotated[AccessTokenClaims, Depends(require_current_user)]
AdminUser = Annotated[AccessTokenClaims, Depends(require_admin)]
