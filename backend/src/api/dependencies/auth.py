"""Dependências de autenticação para as rotas.

O papel vem do token aqui; o bloco 2A pode endurecer (ex.: conferir usuário
ativo/`deleted_at` no banco) sem mudar a assinatura usada pelas rotas.
"""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from api.core.exceptions import ForbiddenError, UnauthorizedError
from api.core.security import AccessTokenClaims, decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def require_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> AccessTokenClaims:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthorizedError()
    return decode_access_token(credentials.credentials)


def require_admin(
    user: Annotated[AccessTokenClaims, Depends(require_current_user)],
) -> AccessTokenClaims:
    if user.role != "admin":
        raise ForbiddenError()
    return user


CurrentUser = Annotated[AccessTokenClaims, Depends(require_current_user)]
AdminUser = Annotated[AccessTokenClaims, Depends(require_admin)]
