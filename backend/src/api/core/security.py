"""Access token (JWT HS256) — contrato único entre os blocos da Onda 2.

Emissão (`issue_access_token`) é usada pelo login do bloco 2A; a verificação
(`decode_access_token`) protege toda rota autenticada. Refresh token NÃO é JWT
(opaco + SHA-256, skill `auth`) e mora no bloco 2A.
"""

import datetime as dt
import uuid
from dataclasses import dataclass
from typing import Final, Literal

import jwt

from api.core.exceptions import UnauthorizedError
from config.settings import settings

ACCESS_TOKEN_ALGORITHM: Final = "HS256"
ACCESS_TOKEN_ISSUER: Final = "economerc-api"
ACCESS_TOKEN_AUDIENCE: Final = "economerc-app"
ACCESS_TOKEN_TTL: Final = dt.timedelta(minutes=15)
REQUIRED_CLAIMS: Final = ["exp", "iat", "sub", "iss", "aud", "jti", "role"]

UserRole = Literal["user", "moderator", "admin"]


@dataclass(frozen=True, slots=True)
class AccessTokenClaims:
    user_id: uuid.UUID
    role: UserRole
    jti: str


def issue_access_token(user_id: uuid.UUID, role: UserRole, now: dt.datetime | None = None) -> str:
    issued_at = now or dt.datetime.now(dt.UTC)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iss": ACCESS_TOKEN_ISSUER,
        "aud": ACCESS_TOKEN_AUDIENCE,
        "iat": issued_at,
        "exp": issued_at + ACCESS_TOKEN_TTL,
        "jti": uuid.uuid4().hex,
    }
    secret = settings.jwt_secret_key.get_secret_value()
    return jwt.encode(payload, secret, algorithm=ACCESS_TOKEN_ALGORITHM)


def decode_access_token(token: str) -> AccessTokenClaims:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key.get_secret_value(),
            algorithms=[ACCESS_TOKEN_ALGORITHM],
            issuer=ACCESS_TOKEN_ISSUER,
            audience=ACCESS_TOKEN_AUDIENCE,
            options={"require": REQUIRED_CLAIMS},
        )
        return AccessTokenClaims(
            user_id=uuid.UUID(payload["sub"]), role=payload["role"], jti=payload["jti"]
        )
    except (jwt.PyJWTError, ValueError, KeyError) as exc:
        raise UnauthorizedError() from exc
