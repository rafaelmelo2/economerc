"""Helpers de teste para simular o JWKS do Google/Apple (skill `auth`).

Gera um par RSA local por teste — nunca bate na rede. `fetch_jwks` é
monkeypatchado para devolver o JWKS fabricado aqui, independente da URL real.
"""

import datetime as dt
import json
from typing import Any

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

TEST_KID = "test-kid-1"


def generate_rsa_private_key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def build_jwks(private_key: rsa.RSAPrivateKey, *, kid: str = TEST_KID) -> dict:
    jwk = json.loads(RSAAlgorithm.to_jwk(private_key.public_key()))
    jwk.update({"kid": kid, "use": "sig", "alg": "RS256"})
    return {"keys": [jwk]}


def build_signed_token(
    private_key: rsa.RSAPrivateKey,
    claims: dict[str, Any],
    *,
    kid: str = TEST_KID,
) -> str:
    return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": kid})


def base_claims(
    *, iss: str, aud: str, sub: str = "user-subject-1", ttl_seconds: int = 3600
) -> dict:
    now = dt.datetime.now(dt.UTC)
    return {
        "iss": iss,
        "aud": aud,
        "sub": sub,
        "iat": int(now.timestamp()),
        "exp": int((now + dt.timedelta(seconds=ttl_seconds)).timestamp()),
    }
