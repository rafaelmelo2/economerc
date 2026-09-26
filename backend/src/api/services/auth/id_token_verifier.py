"""Verificação genérica de id_token/identity_token via JWKS (skill `auth`).

Reusado por Google e Apple — a única diferença entre os dois é qual JWKS
buscar e quais `iss`/`aud` aceitar. Nunca decodifica sem `kid` resolvido pra
uma chave real do JWKS (não confia em `alg`/chave do próprio token).
"""

import json
from collections.abc import Collection
from typing import Final

import jwt
from jwt.algorithms import RSAAlgorithm

from api.core.exceptions import UnauthorizedError
from api.services.auth import jwks_cache

REQUIRED_ID_TOKEN_CLAIMS: Final = ["exp", "iat", "iss", "aud", "sub"]


def _select_jwk(jwks: dict, kid: str) -> dict:
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    raise UnauthorizedError(detail="Chave de assinatura não encontrada no JWKS")


async def verify_id_token(
    token: str,
    *,
    jwks_url: str,
    cache_key: str,
    cache_ttl_seconds: int,
    issuers: Collection[str],
    audiences: Collection[str],
) -> dict:
    """Valida assinatura (JWKS), `aud` (audience) e `iss` (issuer); devolve os claims."""
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise UnauthorizedError(detail="Token malformado") from exc

    kid = header.get("kid")
    if not kid:
        raise UnauthorizedError(detail="Token sem 'kid' no header")

    jwks = await jwks_cache.fetch_jwks(
        url=jwks_url, cache_key=cache_key, cache_ttl_seconds=cache_ttl_seconds
    )
    jwk = _select_jwk(jwks, kid)
    public_key = RSAAlgorithm.from_jwk(json.dumps(jwk))

    try:
        claims = jwt.decode(
            token,
            key=public_key,
            algorithms=["RS256"],
            audience=list(audiences),
            options={"require": REQUIRED_ID_TOKEN_CLAIMS},
        )
    except jwt.PyJWTError as exc:
        raise UnauthorizedError(detail="Token inválido") from exc

    if claims.get("iss") not in issuers:
        raise UnauthorizedError(detail="Issuer inválido")
    return claims
