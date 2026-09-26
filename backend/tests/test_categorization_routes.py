"""`PATCH /api/products/{id}/category` e `POST /api/admin/categorization/run`."""

from dataclasses import dataclass

import orjson
import pytest
from asyncpg import Connection
from httpx import AsyncClient

from api.core.valkey_client import get_valkey
from api.main import app
from api.repositories.catalog.category_repository import category_repository
from api.repositories.catalog.product_repository import NewProduct, product_repository
from api.services.ai import ai_client


class _FakeValkey:
    def __init__(self):
        self._store: dict[str, bytes] = {}

    async def get(self, key: str) -> bytes | None:
        return self._store.get(key)

    async def set(self, key: str, value: bytes, ex: int | None = None) -> None:
        self._store[key] = value


@pytest.fixture(autouse=True)
def _fake_valkey():
    fake = _FakeValkey()
    app.dependency_overrides[get_valkey] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_valkey, None)


@dataclass
class _FakeCompletion:
    content: str


# --- PATCH /products/{id}/category -----------------------------------------------


async def test_correct_product_category_requires_auth(client: AsyncClient, db_conn: Connection):
    product = await product_repository.create(db_conn, NewProduct(name="Produto Qualquer"))
    laticinios = await category_repository.get_by_slug(db_conn, "laticinios")

    res = await client.patch(
        f"/api/products/{product['id']}/category", json={"category_id": str(laticinios["id"])}
    )
    assert res.status_code == 401


async def test_correct_product_category_unknown_product_returns_404(
    client: AsyncClient, db_conn: Connection, bearer
):
    laticinios = await category_repository.get_by_slug(db_conn, "laticinios")
    res = await client.patch(
        "/api/products/00000000-0000-0000-0000-000000000000/category",
        json={"category_id": str(laticinios["id"])},
        headers=await bearer(),
    )
    assert res.status_code == 404


async def test_correct_product_category_unknown_category_returns_404(
    client: AsyncClient, db_conn: Connection, bearer
):
    product = await product_repository.create(db_conn, NewProduct(name="Produto Qualquer 2"))
    res = await client.patch(
        f"/api/products/{product['id']}/category",
        json={"category_id": "00000000-0000-0000-0000-000000000000"},
        headers=await bearer(),
    )
    assert res.status_code == 404


async def test_correct_product_category_overrides_ai_source_and_records_correction(
    client: AsyncClient, db_conn: Connection, bearer
):
    bebidas = await category_repository.get_by_slug(db_conn, "bebidas")
    laticinios = await category_repository.get_by_slug(db_conn, "laticinios")
    product = await product_repository.create(db_conn, NewProduct(name="Item Ambíguo"))
    await product_repository.update_category(db_conn, product["id"], bebidas["id"], "ai")

    res = await client.patch(
        f"/api/products/{product['id']}/category",
        json={"category_id": str(laticinios["id"])},
        headers=await bearer(),
    )

    assert res.status_code == 200
    body = res.json()
    assert body["category_source"] == "user"
    assert body["category_slug"] == "laticinios"

    updated = await product_repository.get_by_id(db_conn, product["id"])
    assert updated["category_id"] == laticinios["id"]
    assert updated["category_source"] == "user"

    corrections = await db_conn.fetch(
        "SELECT * FROM category_corrections WHERE product_id = $1", product["id"]
    )
    assert len(corrections) == 1
    assert corrections[0]["previous_category_id"] == bebidas["id"]
    assert corrections[0]["category_id"] == laticinios["id"]


# --- POST /admin/categorization/run -----------------------------------------------


async def test_admin_categorization_run_requires_admin(client: AsyncClient, bearer):
    res = await client.post("/api/admin/categorization/run", json={}, headers=await bearer("user"))
    assert res.status_code == 403


async def test_admin_categorization_run_categorizes_by_ncm_rule_and_ai(
    client: AsyncClient, db_conn: Connection, monkeypatch: pytest.MonkeyPatch, bearer
):
    ncm_product = await product_repository.create(db_conn, NewProduct(name="Produto NCM XPTO-1"))
    await db_conn.execute(
        "UPDATE products SET ncm = $1 WHERE id = $2", "04012010", ncm_product["id"]
    )
    rule_product = await product_repository.create(db_conn, NewProduct(name="Detergente Ypê 500ml"))
    ai_product = await product_repository.create(
        db_conn, NewProduct(ean="7891000100127", name="Item Sem Termo XPTO-2")
    )

    calls: list[str] = []

    async def fake_complete(task: str, **kwargs):
        calls.append(task)
        return _FakeCompletion(content=orjson.dumps({"category_slug": "outros"}).decode())

    monkeypatch.setattr(ai_client, "complete", fake_complete)

    res = await client.post(
        "/api/admin/categorization/run", json={"limit": 50}, headers=await bearer("admin")
    )

    assert res.status_code == 200
    body = res.json()
    assert body["processed"] == 3
    assert body["categorized"] == 3
    assert body["by_source"] == {"ncm": 1, "rule": 1, "ai": 1}
    assert calls == ["categorize_product"]

    updated_ncm = await product_repository.get_by_id(db_conn, ncm_product["id"])
    assert updated_ncm["category_source"] == "ncm"
    updated_rule = await product_repository.get_by_id(db_conn, rule_product["id"])
    assert updated_rule["category_source"] == "rule"
    updated_ai = await product_repository.get_by_id(db_conn, ai_product["id"])
    assert updated_ai["category_source"] == "ai"


async def test_admin_categorization_run_empty_when_nothing_uncategorized(
    client: AsyncClient, bearer
):
    res = await client.post(
        "/api/admin/categorization/run", json={"limit": 10}, headers=await bearer("admin")
    )
    assert res.status_code == 200
    body = res.json()
    assert body["processed"] == 0
    assert body["categorized"] == 0
