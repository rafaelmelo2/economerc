"""`POST /api/auth/refresh` e `/api/auth/logout` — rotação + detecção de reuso.

Skill `auth` > auth-hardened.md §3: `claim_if_unused` atômico, reuso de um
token já rotacionado queima a família inteira (próximo refresh, mesmo com o
token novo em mãos, falha).
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


async def _login(client: AsyncClient, keypair, *, sub: str, email: str) -> dict:
    claims = base_claims(iss=GOOGLE_ISSUER, aud=settings.auth.google.client_id_web, sub=sub)
    claims.update({"email": email, "email_verified": True, "name": "Teste"})
    token = build_signed_token(keypair, claims)
    res = await client.post("/api/auth/google", json={"id_token": token})
    assert res.status_code == 200
    return res.json()


async def test_refresh_rotates_and_old_token_becomes_unusable(
    client: AsyncClient, _mock_google_jwks
):
    login = await _login(client, _mock_google_jwks, sub="refresh-sub-1", email="hugo@example.com")
    old_refresh = login["refresh_token"]

    refreshed = await client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert refreshed.status_code == 200
    new_refresh = refreshed.json()["refresh_token"]
    assert new_refresh != old_refresh

    # Reaproveitar o token novo funciona (rotação normal).
    second_refresh = await client.post("/api/auth/refresh", json={"refresh_token": new_refresh})
    assert second_refresh.status_code == 200


async def test_refresh_reuse_of_rotated_token_kills_the_family(
    client: AsyncClient, _mock_google_jwks
):
    login = await _login(client, _mock_google_jwks, sub="refresh-sub-2", email="ines@example.com")
    old_refresh = login["refresh_token"]

    first = await client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert first.status_code == 200
    new_refresh = first.json()["refresh_token"]

    # Reuso do token JÁ rotacionado, fora da janela de graça de fato irrelevante
    # aqui (mesmo dentro dela, é o MESMO chamador reapresentando o token velho
    # depois de já ter recebido o novo com sucesso — replay genuíno).
    replay = await client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert replay.status_code == 401

    # Família inteira morta: nem o token novo (que era válido) funciona mais.
    blocked = await client.post("/api/auth/refresh", json={"refresh_token": new_refresh})
    assert blocked.status_code == 401


async def test_refresh_unknown_token_is_rejected(client: AsyncClient):
    res = await client.post("/api/auth/refresh", json={"refresh_token": "not-a-real-token"})
    assert res.status_code == 401


async def test_logout_revokes_family_and_refresh_stops_working(
    client: AsyncClient, _mock_google_jwks
):
    login = await _login(client, _mock_google_jwks, sub="refresh-sub-3", email="joana@example.com")
    refresh_token = login["refresh_token"]

    logout_res = await client.post("/api/auth/logout", json={"refresh_token": refresh_token})
    assert logout_res.status_code == 204

    after_logout = await client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert after_logout.status_code == 401


async def test_logout_without_token_is_a_no_op_success(client: AsyncClient):
    res = await client.post("/api/auth/logout")
    assert res.status_code == 204
