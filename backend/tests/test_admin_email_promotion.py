"""E-mail verificado na whitelist `auth.admin_emails` vira `role='admin'` no login

(docs/roadmap-fase1.md > Etapa 2, bloco 5B). `admin@example.com` é o e-mail de teste
em `tests/app.test.yaml > auth.admin_emails`.
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

GOOGLE_ISSUER = "https://accounts.google.com"


@pytest.fixture(autouse=True)
def _mock_google_jwks(monkeypatch):
    keypair = generate_rsa_private_key()
    jwks = build_jwks(keypair)

    async def _fake_fetch_jwks(*, url, cache_key, cache_ttl_seconds):
        return jwks

    monkeypatch.setattr(jwks_cache, "fetch_jwks", _fake_fetch_jwks)
    return keypair


def _google_id_token(keypair, *, sub: str, email: str):
    claims = base_claims(iss=GOOGLE_ISSUER, aud=settings.auth.google.client_id_web, sub=sub)
    claims.update({"email": email, "email_verified": True, "name": "Admin"})
    return build_signed_token(keypair, claims)


async def test_login_with_admin_email_promotes_new_user(client: AsyncClient, _mock_google_jwks):
    token = _google_id_token(_mock_google_jwks, sub="google-admin-1", email="admin@example.com")
    res = await client.post("/api/auth/google", json={"id_token": token})
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "admin"


async def test_login_with_non_admin_email_stays_user(client: AsyncClient, _mock_google_jwks):
    token = _google_id_token(_mock_google_jwks, sub="google-user-1", email="ana@example.com")
    res = await client.post("/api/auth/google", json={"id_token": token})
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "user"


async def test_email_added_to_admin_list_promotes_on_next_login(
    client: AsyncClient, _mock_google_jwks, monkeypatch
):
    """Cadastro anterior (e-mail ainda não era admin) + e-mail entra na whitelist depois

    → o PRÓXIMO login promove, sem precisar de re-cadastro."""
    first_token = _google_id_token(
        _mock_google_jwks, sub="google-late-admin", email="late@example.com"
    )
    first = await client.post("/api/auth/google", json={"id_token": first_token})
    assert first.json()["user"]["role"] == "user"

    monkeypatch.setattr(settings.auth, "admin_emails", ["late@example.com"])

    second_token = _google_id_token(
        _mock_google_jwks, sub="google-late-admin", email="late@example.com"
    )
    second = await client.post("/api/auth/google", json={"id_token": second_token})
    assert second.json()["user"]["role"] == "admin"
    assert second.json()["user"]["id"] == first.json()["user"]["id"]
