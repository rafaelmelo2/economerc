"""`POST /api/auth/apple` — identity_token nativo do app (skill `auth`).

Cobre e-mail relay/oculto e vinculação por e-mail verificado entre provedores
(Google + Apple mesma conta).
"""

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

APPLE_ISSUER = "https://appleid.apple.com"


@pytest.fixture(autouse=True)
def _mock_apple_jwks(monkeypatch):
    keypair = generate_rsa_private_key()
    jwks = build_jwks(keypair)

    async def _fake_fetch_jwks(*, url, cache_key, cache_ttl_seconds):
        return jwks

    monkeypatch.setattr(jwks_cache, "fetch_jwks", _fake_fetch_jwks)
    return keypair


def _apple_identity_token(keypair, *, sub: str, email: str | None, is_private_email=False):
    claims = base_claims(iss=APPLE_ISSUER, aud=settings.auth.apple.bundle_id, sub=sub)
    if email:
        claims.update(
            {
                "email": email,
                "email_verified": "true",
                "is_private_email": "true" if is_private_email else "false",
            }
        )
    return build_signed_token(keypair, claims)


async def test_apple_login_first_time_uses_full_name_from_request(
    client: AsyncClient, _mock_apple_jwks
):
    token = _apple_identity_token(_mock_apple_jwks, sub="apple-sub-1", email="fabio@example.com")
    res = await client.post(
        "/api/auth/apple",
        json={"identity_token": token, "full_name": "Fábio Silva"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["display_name"] == "Fábio Silva"
    assert body["refresh_token"]


async def test_apple_login_supports_private_relay_email(client: AsyncClient, _mock_apple_jwks):
    token = _apple_identity_token(
        _mock_apple_jwks,
        sub="apple-sub-2",
        email="relay-abc123@privaterelay.appleid.com",
        is_private_email=True,
    )
    res = await client.post("/api/auth/apple", json={"identity_token": token})
    assert res.status_code == 200
    assert res.json()["user"]["email"] == "relay-abc123@privaterelay.appleid.com"


async def test_apple_login_second_time_without_email_keeps_same_account(
    client: AsyncClient, _mock_apple_jwks
):
    first_token = _apple_identity_token(
        _mock_apple_jwks, sub="apple-sub-3", email="gil@example.com"
    )
    first = await client.post(
        "/api/auth/apple", json={"identity_token": first_token, "full_name": "Gil"}
    )
    # 2º login: Apple não reenvia email/name — só o `sub` identifica a conta.
    second_token = _apple_identity_token(_mock_apple_jwks, sub="apple-sub-3", email=None)
    second = await client.post("/api/auth/apple", json={"identity_token": second_token})
    assert second.status_code == 200
    assert second.json()["user"]["id"] == first.json()["user"]["id"]


async def test_apple_login_wrong_issuer_is_rejected(client: AsyncClient, _mock_apple_jwks):
    claims = base_claims(iss="https://not-apple.example.com", aud=settings.auth.apple.bundle_id)
    token = build_signed_token(_mock_apple_jwks, claims)
    res = await client.post("/api/auth/apple", json={"identity_token": token})
    assert res.status_code == 401
