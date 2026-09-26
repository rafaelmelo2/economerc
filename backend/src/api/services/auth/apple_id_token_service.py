"""Verificação do identity_token do Sign in with Apple (app Expo).

Apple só manda `email`/`name` no PRIMEIRO login — o app envia o nome à parte
(`full_name` no request) porque o token não carrega mais em logins seguintes.
Suporta e-mail relay/oculto (`is_private_email`): tratado como e-mail normal
para vinculação de conta, só não é confiável para contato fora do relay.
"""

from typing import Final

from api.services.auth.id_token_verifier import verify_id_token
from config.settings import settings

APPLE_ISSUER: Final = "https://appleid.apple.com"
APPLE_JWKS_CACHE_KEY: Final = "jwks:apple"


def _truthy_apple_flag(value: object) -> bool:
    """Apple manda `email_verified`/`is_private_email` como string "true"/"false"."""
    if isinstance(value, bool):
        return value
    return str(value).lower() == "true"


async def verify_apple_id_token(identity_token: str) -> dict:
    apple = settings.auth.apple
    audiences = [aud for aud in (apple.bundle_id, apple.service_id) if aud]
    claims = await verify_id_token(
        identity_token,
        jwks_url=apple.jwks_url,
        cache_key=APPLE_JWKS_CACHE_KEY,
        cache_ttl_seconds=apple.jwks_cache_ttl_seconds,
        issuers=(APPLE_ISSUER,),
        audiences=audiences,
    )
    claims["email_verified"] = _truthy_apple_flag(claims.get("email_verified", True))
    claims["is_private_email"] = _truthy_apple_flag(claims.get("is_private_email", False))
    return claims
