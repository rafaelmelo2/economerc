"""`/me` — perfil, preferências (Decimal) e exclusão de conta (LGPD)."""

from decimal import Decimal

import pytest
from asyncpg import Connection
from httpx import AsyncClient

from api.repositories.geo.city_repository import city_repository
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


async def _login(client: AsyncClient, keypair, *, sub: str, email: str) -> dict:
    claims = base_claims(iss=GOOGLE_ISSUER, aud=settings.auth.google.client_id_web, sub=sub)
    claims.update({"email": email, "email_verified": True, "name": "Perfil Teste"})
    token = build_signed_token(keypair, claims)
    res = await client.post("/api/auth/google", json={"id_token": token})
    assert res.status_code == 200
    return res.json()


def _auth_headers(access_token: str) -> dict:
    return {"Authorization": f"Bearer {access_token}"}


async def test_get_me_without_token_is_401(client: AsyncClient):
    res = await client.get("/api/me")
    assert res.status_code == 401


async def test_get_me_returns_profile(client: AsyncClient, _mock_google_jwks):
    login = await _login(client, _mock_google_jwks, sub="me-sub-1", email="karina@example.com")
    res = await client.get("/api/me", headers=_auth_headers(login["access_token"]))
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == "karina@example.com"
    assert body["preferences"] is None


async def test_update_preferences_persists_decimal_money(
    client: AsyncClient, _mock_google_jwks, db_conn: Connection
):
    login = await _login(client, _mock_google_jwks, sub="me-sub-2", email="leo@example.com")
    catalao = await city_repository.get_by_ibge_code(db_conn, 5205109)
    assert catalao is not None

    res = await client.patch(
        "/api/me/preferences",
        headers=_auth_headers(login["access_token"]),
        json={
            "city_id": str(catalao["id"]),
            "household_size": 3,
            "monthly_budget": "850.55",
            "budget_alert_percent": 75,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert Decimal(body["monthly_budget"]) == Decimal("850.55")
    assert body["budget_alert_percent"] == 75
    assert body["city_id"] == str(catalao["id"])

    # PATCH parcial: só manda household_size — resto preserva (COALESCE).
    partial = await client.patch(
        "/api/me/preferences",
        headers=_auth_headers(login["access_token"]),
        json={"household_size": 4},
    )
    assert partial.status_code == 200
    partial_body = partial.json()
    assert partial_body["household_size"] == 4
    assert Decimal(partial_body["monthly_budget"]) == Decimal("850.55")


async def test_delete_me_blocks_old_access_token(client: AsyncClient, _mock_google_jwks):
    login = await _login(client, _mock_google_jwks, sub="me-sub-3", email="marta@example.com")
    headers = _auth_headers(login["access_token"])

    delete_res = await client.delete("/api/me", headers=headers)
    assert delete_res.status_code == 204

    blocked = await client.get("/api/me", headers=headers)
    assert blocked.status_code == 401

    refresh_blocked = await client.post(
        "/api/auth/refresh", json={"refresh_token": login["refresh_token"]}
    )
    assert refresh_blocked.status_code == 401
