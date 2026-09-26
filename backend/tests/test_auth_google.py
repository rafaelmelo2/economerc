"""`POST /api/auth/google` — id_token nativo do app (skill `auth`)."""

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

GOOGLE_ISSUER = "https://accounts.google.com"


@pytest.fixture(autouse=True)
def _mock_google_jwks(monkeypatch):
    keypair = generate_rsa_private_key()
    jwks = build_jwks(keypair)

    async def _fake_fetch_jwks(*, url, cache_key, cache_ttl_seconds):
        return jwks

    monkeypatch.setattr(jwks_cache, "fetch_jwks", _fake_fetch_jwks)
    return keypair


def _google_id_token(keypair, *, sub: str, email: str, email_verified: bool = True, name="Ana"):
    claims = base_claims(iss=GOOGLE_ISSUER, aud=settings.auth.google.client_id_web, sub=sub)
    claims.update({"email": email, "email_verified": email_verified, "name": name})
    return build_signed_token(keypair, claims)


async def test_google_login_creates_user_and_returns_pair(client: AsyncClient, _mock_google_jwks):
    token = _google_id_token(_mock_google_jwks, sub="google-sub-1", email="ana@example.com")
    res = await client.post("/api/auth/google", json={"id_token": token})
    assert res.status_code == 200
    body = res.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["expires_in"] > 0
    assert body["user"]["email"] == "ana@example.com"


async def test_google_login_same_subject_links_same_user(client: AsyncClient, _mock_google_jwks):
    token = _google_id_token(_mock_google_jwks, sub="google-sub-2", email="bia@example.com")
    first = await client.post("/api/auth/google", json={"id_token": token})
    second_token = _google_id_token(_mock_google_jwks, sub="google-sub-2", email="bia@example.com")
    second = await client.post("/api/auth/google", json={"id_token": second_token})
    assert first.json()["user"]["id"] == second.json()["user"]["id"]


async def test_google_login_unverified_email_is_rejected(client: AsyncClient, _mock_google_jwks):
    token = _google_id_token(
        _mock_google_jwks, sub="google-sub-3", email="carla@example.com", email_verified=False
    )
    res = await client.post("/api/auth/google", json={"id_token": token})
    assert res.status_code == 401


async def test_google_login_wrong_audience_is_rejected(client: AsyncClient, _mock_google_jwks):
    claims = base_claims(iss=GOOGLE_ISSUER, aud="not-our-client-id", sub="google-sub-4")
    claims.update({"email": "duda@example.com", "email_verified": True, "name": "Duda"})
    token = build_signed_token(_mock_google_jwks, claims)
    res = await client.post("/api/auth/google", json={"id_token": token})
    assert res.status_code == 401


async def test_google_login_web_client_sets_cookie_and_omits_refresh_body(
    client: AsyncClient, _mock_google_jwks
):
    token = _google_id_token(_mock_google_jwks, sub="google-sub-5", email="elis@example.com")
    res = await client.post(
        "/api/auth/google", json={"id_token": token}, headers={"X-Client": "web"}
    )
    assert res.status_code == 200
    assert res.json()["refresh_token"] is None
    assert "refresh_token=" in res.headers.get("set-cookie", "")
