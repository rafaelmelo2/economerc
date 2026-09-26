import uuid

import pytest
from asyncpg import Connection
from httpx import AsyncClient

from api.core.security import issue_access_token
from api.core.valkey_client import get_valkey
from api.main import app
from api.repositories.catalog.product_repository import NewProduct, product_repository

VALID_EAN13 = "4006381333931"


class _FakeValkey:
    """Stub mínimo de Valkey (get/set) — lifespan não roda sob `ASGITransport` (ver conftest)."""

    def __init__(self):
        self._store: dict[str, bytes] = {}

    async def get(self, key: str) -> bytes | None:
        return self._store.get(key)

    async def set(self, key: str, value: bytes, ex: int | None = None) -> None:
        self._store[key] = value


@pytest.fixture(autouse=True)
def _fake_valkey():
    """`get_valkey()` real levanta `RuntimeError` fora do lifespan — todo teste de rota
    de produto passa por essa dependency, mesmo quando a lógica não chega a usar cache."""
    fake = _FakeValkey()
    app.dependency_overrides[get_valkey] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_valkey, None)


def _bearer(role: str = "user") -> dict[str, str]:
    token = issue_access_token(uuid.uuid4(), role)
    return {"Authorization": f"Bearer {token}"}


async def test_get_product_by_ean_requires_auth(client: AsyncClient):
    res = await client.get(f"/api/products/by-ean/{VALID_EAN13}")
    assert res.status_code == 401


async def test_get_product_by_ean_invalid_gtin_returns_400(client: AsyncClient):
    res = await client.get("/api/products/by-ean/12345", headers=_bearer())
    assert res.status_code == 400


async def test_get_product_by_ean_known_locally_skips_off(
    client: AsyncClient, db_conn: Connection, monkeypatch
):
    await product_repository.create(
        db_conn, NewProduct(ean=VALID_EAN13, name="Café Local", unit="g", net_quantity=500)
    )

    async def _fail_if_called(ean: str) -> dict | None:  # pragma: no cover - não deve rodar
        raise AssertionError(f"OFF não deveria ser chamado para EAN já local: {ean}")

    monkeypatch.setattr(
        "api.services.catalog.product_lookup_service.fetch_off_raw_product", _fail_if_called
    )
    res = await client.get(f"/api/products/by-ean/{VALID_EAN13}", headers=_bearer())

    assert res.status_code == 200
    assert res.json()["name"] == "Café Local"


async def test_get_product_by_ean_found_only_in_off_creates_local_product(
    client: AsyncClient, monkeypatch
):
    calls: list[str] = []

    async def fake_fetch(ean: str) -> dict | None:
        calls.append(ean)
        return {"product_name_pt": "Arroz Off 1kg", "brands": "MarcaOff", "quantity": "1 kg"}

    monkeypatch.setattr(
        "api.services.catalog.product_lookup_service.fetch_off_raw_product", fake_fetch
    )

    first = await client.get(f"/api/products/by-ean/{VALID_EAN13}", headers=_bearer())
    assert first.status_code == 200
    body = first.json()
    assert body["name"] == "Arroz Off 1kg"
    assert body["source"] == "off"
    assert body["unit"] == "kg"

    second = await client.get(f"/api/products/by-ean/{VALID_EAN13}", headers=_bearer())
    assert second.status_code == 200
    assert second.json()["id"] == body["id"]

    assert calls == [VALID_EAN13]  # produto já existe local na 2ª chamada — OFF não repete


async def test_get_product_by_ean_not_found_anywhere_caches_miss(client: AsyncClient, monkeypatch):
    calls: list[str] = []

    async def fake_fetch(ean: str) -> dict | None:
        calls.append(ean)
        return None

    monkeypatch.setattr(
        "api.services.catalog.product_lookup_service.fetch_off_raw_product", fake_fetch
    )

    first = await client.get(f"/api/products/by-ean/{VALID_EAN13}", headers=_bearer())
    second = await client.get(f"/api/products/by-ean/{VALID_EAN13}", headers=_bearer())

    assert first.status_code == 404
    assert second.status_code == 404
    assert calls == [VALID_EAN13]  # segunda chamada usou o cache de "não encontrado"


async def test_list_products_requires_admin(client: AsyncClient):
    res = await client.get("/api/products", headers=_bearer("user"))
    assert res.status_code == 403


async def test_list_products_empty_for_admin(client: AsyncClient):
    res = await client.get("/api/products", headers=_bearer("admin"))
    assert res.status_code == 200
    body = res.json()
    assert body["items"] == []
    assert body["total"] == 0


async def test_admin_product_crud_lifecycle(client: AsyncClient):
    admin_headers = _bearer("admin")

    created = await client.post(
        "/api/products",
        json={"name": "Produto Admin", "unit": "un"},
        headers=admin_headers,
    )
    assert created.status_code == 201
    product_id = created.json()["id"]

    fetched = await client.get(f"/api/products/{product_id}", headers=admin_headers)
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Produto Admin"

    updated = await client.patch(
        f"/api/products/{product_id}", json={"brand": "Marca Nova"}, headers=admin_headers
    )
    assert updated.status_code == 200
    assert updated.json()["brand"] == "Marca Nova"

    deleted = await client.delete(f"/api/products/{product_id}", headers=admin_headers)
    assert deleted.status_code == 204

    after_delete = await client.get(f"/api/products/{product_id}", headers=admin_headers)
    assert after_delete.status_code == 404
