"""Verificação do id_token do Google Sign-In NATIVO (app Expo).

Diferente do fluxo web popup auth-code (`google-login.md`): o app manda o
id_token direto (já assinado pelo Google), sem troca de authorization code —
o backend só verifica assinatura/iss/aud/exp via JWKS (skill `auth` §6).
"""

from typing import Final

from api.core.exceptions import UnauthorizedError
from api.services.auth.id_token_verifier import verify_id_token
from config.settings import settings

GOOGLE_ISSUERS: Final = ("accounts.google.com", "https://accounts.google.com")
GOOGLE_JWKS_CACHE_KEY: Final = "jwks:google"


async def verify_google_id_token(id_token_str: str) -> dict:
    google = settings.auth.google
    claims = await verify_id_token(
        id_token_str,
        jwks_url=google.jwks_url,
        cache_key=GOOGLE_JWKS_CACHE_KEY,
        cache_ttl_seconds=google.jwks_cache_ttl_seconds,
        issuers=GOOGLE_ISSUERS,
        audiences=(google.client_id_ios, google.client_id_android, google.client_id_web),
    )
    if not claims.get("email_verified", False):
        raise UnauthorizedError(detail="E-mail não verificado pelo Google")
    return claims
