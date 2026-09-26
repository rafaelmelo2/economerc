"""Unit tests do verificador genérico de id_token via JWKS (skill `auth`).

Chaves RSA geradas no teste; `jwks_cache.fetch_jwks` é monkeypatchado — nunca
bate na rede real do Google/Apple.
"""

import pytest

from api.core.exceptions import UnauthorizedError
from api.services.auth import id_token_verifier, jwks_cache
from tests.jwks_test_utils import (
    base_claims,
    build_jwks,
    build_signed_token,
    generate_rsa_private_key,
)

ISSUER = "https://issuer.example.com"
AUDIENCE = "test-audience"


@pytest.fixture
def keypair():
    return generate_rsa_private_key()


@pytest.fixture(autouse=True)
def _mock_jwks(monkeypatch, keypair):
    jwks = build_jwks(keypair)

    async def _fake_fetch_jwks(*, url, cache_key, cache_ttl_seconds):
        return jwks

    monkeypatch.setattr(jwks_cache, "fetch_jwks", _fake_fetch_jwks)
    return jwks


async def _verify(token: str) -> dict:
    return await id_token_verifier.verify_id_token(
        token,
        jwks_url="https://issuer.example.com/jwks",
        cache_key="jwks:test",
        cache_ttl_seconds=60,
        issuers=(ISSUER,),
        audiences=(AUDIENCE,),
    )


async def test_valid_token_round_trips_claims(keypair):
    token = build_signed_token(keypair, base_claims(iss=ISSUER, aud=AUDIENCE, sub="user-1"))
    claims = await _verify(token)
    assert claims["sub"] == "user-1"
    assert claims["iss"] == ISSUER


async def test_invalid_signature_is_rejected(keypair):
    other_key = generate_rsa_private_key()
    # Assinado por uma chave DIFERENTE da anunciada no JWKS (mesmo `kid`).
    token = build_signed_token(other_key, base_claims(iss=ISSUER, aud=AUDIENCE))
    with pytest.raises(UnauthorizedError):
        await _verify(token)


async def test_wrong_audience_is_rejected(keypair):
    token = build_signed_token(keypair, base_claims(iss=ISSUER, aud="someone-elses-app"))
    with pytest.raises(UnauthorizedError):
        await _verify(token)


async def test_wrong_issuer_is_rejected(keypair):
    token = build_signed_token(keypair, base_claims(iss="https://evil.example.com", aud=AUDIENCE))
    with pytest.raises(UnauthorizedError):
        await _verify(token)


async def test_expired_token_is_rejected(keypair):
    token = build_signed_token(keypair, base_claims(iss=ISSUER, aud=AUDIENCE, ttl_seconds=-60))
    with pytest.raises(UnauthorizedError):
        await _verify(token)


async def test_unknown_kid_is_rejected(keypair):
    token = build_signed_token(keypair, base_claims(iss=ISSUER, aud=AUDIENCE), kid="unknown-kid")
    with pytest.raises(UnauthorizedError):
        await _verify(token)
