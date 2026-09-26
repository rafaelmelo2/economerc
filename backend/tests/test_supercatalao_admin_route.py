"""`POST /api/admin/collectors/supercatalao/run` (bloco 4C) — rede sempre mockada aqui (fixtures
reais); o crawler contra o site de verdade é exercitado manualmente, fora da suíte (ver relatório
do bloco 4C)."""

from decimal import Decimal
from pathlib import Path

import pytest
from asyncpg import Connection
from httpx import AsyncClient

from api.repositories.catalog.product_repository import NewProduct, product_repository
from api.services.collectors import supercatalao_crawler

_FIXTURES_DIR = Path(__file__).parent / "fixtures" / "collectors" / "supercatalao"


def _read_fixture(name: str) -> str:
    return (_FIXTURES_DIR / name).read_text(encoding="utf-8")


class _FakeResponse:
    def __init__(self, text: str):
        self.text = text

    def raise_for_status(self) -> None:
        return None


class _FakeSession:
    """Substitui `curl_cffi.requests.AsyncSession` — devolve fixtures locais por URL."""

    def __init__(self, pages: dict[str, str]):
        self._pages = pages
        self.requested_urls: list[str] = []

    async def __aenter__(self) -> "_FakeSession":
        return self

    async def __aexit__(self, *exc_info) -> bool:
        return False

    async def get(self, url: str, **kwargs) -> _FakeResponse:
        self.requested_urls.append(url)
        for suffix, html in self._pages.items():
            if url.endswith(suffix):
                return _FakeResponse(html)
        raise AssertionError(f"URL sem fixture cadastrada: {url}")


@pytest.fixture(autouse=True)
def _fake_supercatalao_site(monkeypatch: pytest.MonkeyPatch):
    pages = {
        "/loja": _read_fixture("loja_home.html"),
        "/loja/acougue-88": _read_fixture("departamento_acougue_p1.html"),
        "/loja/hortifruti-11": _read_fixture("departamento_hortifruti_p1.html"),
    }
    fake_session = _FakeSession(pages)
    monkeypatch.setattr(supercatalao_crawler, "AsyncSession", lambda *a, **kw: fake_session)
    # Só os 2 departamentos com fixture — home real lista 14, sem fixture pra todos.
    monkeypatch.setattr(
        supercatalao_crawler,
        "extract_department_slugs",
        lambda html: ["acougue-88", "hortifruti-11"],
    )
    monkeypatch.setattr("anyio.sleep", _instant_sleep)
    return fake_session


async def _instant_sleep(_seconds: float) -> None:
    return None


async def test_run_supercatalao_route_requires_admin(client: AsyncClient, bearer):
    res = await client.post("/api/admin/collectors/supercatalao/run", headers=await bearer("user"))
    assert res.status_code == 403


async def test_run_supercatalao_route_creates_run_and_aliases(
    client: AsyncClient, db_conn: Connection, bearer
):
    res = await client.post(
        "/api/admin/collectors/supercatalao/run",
        params={"max_pages": 1},
        headers=await bearer("admin"),
    )

    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "success"
    assert body["items_found"] > 0
    assert body["aliases_created"] == body["items_found"]  # catálogo vazio: nenhum produto ligado
    assert body["prices_created"] == 0

    alias_count = await db_conn.fetchval("SELECT COUNT(*) FROM product_aliases")
    assert alias_count == body["aliases_created"]


async def test_run_supercatalao_route_auto_links_and_creates_price_for_exact_match(
    client: AsyncClient, db_conn: Connection, bearer
):
    product = await product_repository.create(db_conn, NewProduct(name="CONTRA FILE KG"))

    res = await client.post(
        "/api/admin/collectors/supercatalao/run",
        params={"max_pages": 1},
        headers=await bearer("admin"),
    )

    assert res.status_code == 201
    body = res.json()
    assert body["prices_created"] >= 1

    # market_code 5933 é o `modelId` de "CONTRA FILE KG" na fixture (docs/fontes-de-dados.md).
    alias = await db_conn.fetchrow("SELECT * FROM product_aliases WHERE market_code = $1", "5933")
    assert alias is not None
    assert alias["product_id"] == product["id"]

    price_row = await db_conn.fetchrow(
        "SELECT * FROM prices WHERE product_id = $1 AND source = 'scraper'", product["id"]
    )
    assert price_row is not None
    assert price_row["amount"] == Decimal("49.98")


async def test_run_supercatalao_route_is_idempotent_on_second_run(
    client: AsyncClient, db_conn: Connection, bearer
):
    headers = await bearer("admin")
    first = await client.post(
        "/api/admin/collectors/supercatalao/run", params={"max_pages": 1}, headers=headers
    )
    assert first.status_code == 201

    second = await client.post(
        "/api/admin/collectors/supercatalao/run", params={"max_pages": 1}, headers=headers
    )
    assert second.status_code == 201
    assert second.json()["aliases_created"] == 0
