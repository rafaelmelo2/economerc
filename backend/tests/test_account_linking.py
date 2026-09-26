"""Mesmo e-mail verificado, provedores diferentes → MESMA conta (docs/roadmap-fase1.md > Etapa 2)."""

import pytest
from httpx import AsyncClient

from api.services.auth import jwks_cache
from config.settings import settings
from tests.jwks_test_utils import (
    base_claims,
    build_jwks,
    build_signed_token,
    generate_rsa_private_key,
)


@pytest.fixture
def _mock_multi_provider_jwks(monkeypatch):
    """Uma única chave/JWKS serve os dois provedores no teste (`fetch_jwks` ignora a URL)."""
    keypair = generate_rsa_private_key()
    jwks = build_jwks(keypair)

    async def _fake_fetch_jwks(*, url, cache_key, cache_ttl_seconds):
        return jwks

    monkeypatch.setattr(jwks_cache, "fetch_jwks", _fake_fetch_jwks)
    return keypair


async def test_same_verified_email_links_google_and_apple_to_one_account(
    client: AsyncClient, _mock_multi_provider_jwks
):
    keypair = _mock_multi_provider_jwks
    email = "shared@example.com"

    google_claims = base_claims(
        iss="https://accounts.google.com",
        aud=settings.auth.google.client_id_web,
        sub="google-shared",
    )
    google_claims.update({"email": email, "email_verified": True, "name": "Shared"})
    google_token = build_signed_token(keypair, google_claims)
    google_res = await client.post("/api/auth/google", json={"id_token": google_token})
    assert google_res.status_code == 200

    apple_claims = base_claims(
        iss="https://appleid.apple.com", aud=settings.auth.apple.bundle_id, sub="apple-shared"
    )
    apple_claims.update({"email": email, "email_verified": "true", "is_private_email": "false"})
    apple_token = build_signed_token(keypair, apple_claims)
    apple_res = await client.post("/api/auth/apple", json={"identity_token": apple_token})
    assert apple_res.status_code == 200

    assert google_res.json()["user"]["id"] == apple_res.json()["user"]["id"]
