"""`POST /api/auth/dev-login` — só existe com `ENVIRONMENT=local` (onda 3A,

docs/fases-construcao.md > Depende de você: sem client IDs Google/Apple reais
ainda). Fora de local a rota não é registrada — 404 puro, testado recarregando
`api.routes.account` com `ENVIRONMENT` trocado (o `app` global do `main.py` já
importado não muda; só o módulo agregador reflete o novo valor).
"""

import importlib

from httpx import AsyncClient


async def test_dev_login_returns_tokens_in_local_env(client: AsyncClient):
    res = await client.post("/api/auth/dev-login")
    assert res.status_code == 200
    body = res.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["expires_in"] > 0
    assert body["user"]["email"] == "dev@economerc.local"


async def test_dev_login_is_idempotent_on_user(client: AsyncClient):
    first = await client.post("/api/auth/dev-login")
    second = await client.post("/api/auth/dev-login")
    assert first.json()["user"]["id"] == second.json()["user"]["id"]


def _collect_route_paths(router) -> list[str]:
    """FastAPI recente guarda sub-routers como `_IncludedRouter` preguiçoso

    (sem `.path` direto) — desce em `original_router` até achar as rotas
    concretas. Só usado neste teste de introspecção, nunca em runtime.
    """
    paths: list[str] = []
    for item in router.routes:
        if hasattr(item, "path"):
            paths.append(item.path)
        elif hasattr(item, "original_router"):
            paths.extend(_collect_route_paths(item.original_router))
    return paths


def test_dev_login_route_absent_outside_local(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "staging")
    account_module = importlib.import_module("api.routes.account")
    reloaded = importlib.reload(account_module)
    try:
        paths = _collect_route_paths(reloaded.router)
        assert not any("dev-login" in path for path in paths)
    finally:
        monkeypatch.delenv("ENVIRONMENT", raising=False)
        importlib.reload(account_module)


def test_is_dev_login_enabled_reflects_environment(monkeypatch):
    from api.routes.account import is_dev_login_enabled

    monkeypatch.setenv("ENVIRONMENT", "local")
    assert is_dev_login_enabled() is True

    monkeypatch.setenv("ENVIRONMENT", "prod")
    assert is_dev_login_enabled() is False

    monkeypatch.delenv("ENVIRONMENT", raising=False)
    assert is_dev_login_enabled() is True  # default = local (host-puro sem .env)
