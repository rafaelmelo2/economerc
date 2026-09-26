"""`categorize_product` — ordem NCM → regra → IA (IA sempre mockada, tests.md)."""

from dataclasses import dataclass

import orjson
import pytest
from asyncpg import Connection

from api.repositories.catalog.product_repository import NewProduct, product_repository
from api.services.ai import ai_client
from api.services.categorization.categorization_service import categorize_product


class _FakeValkey:
    def __init__(self):
        self._store: dict[str, bytes] = {}

    async def get(self, key: str) -> bytes | None:
        return self._store.get(key)

    async def set(self, key: str, value: bytes, ex: int | None = None) -> None:
        self._store[key] = value


@dataclass
class _FakeCompletion:
    content: str


def _install_ai_slug(monkeypatch: pytest.MonkeyPatch, slug: str | None, *, calls: list):
    content = "não é json" if slug is None else orjson.dumps({"category_slug": slug}).decode()

    async def fake_complete(task: str, **kwargs):
        calls.append(task)
        return _FakeCompletion(content=content)

    monkeypatch.setattr(ai_client, "complete", fake_complete)


async def test_categorize_by_ncm_wins_over_everything(db_conn: Connection):
    product = await product_repository.create(
        db_conn, NewProduct(name="Produto Sem Termo Reconhecível XPTO")
    )
    await db_conn.execute("UPDATE products SET ncm = $1 WHERE id = $2", "04012010", product["id"])

    result = await categorize_product(
        db_conn,
        _FakeValkey(),
        product_id=product["id"],
        ean=None,
        name="Produto Sem Termo Reconhecível XPTO",
        ncm="04012010",
    )

    assert result is not None
    assert result.source == "ncm"
    assert result.category_slug == "laticinios"
    updated = await product_repository.get_by_id(db_conn, product["id"])
    assert updated["category_source"] == "ncm"
    assert updated["category_id"] == result.category_id


async def test_categorize_by_rule_when_no_ncm(db_conn: Connection):
    product = await product_repository.create(db_conn, NewProduct(name="Detergente Ypê 1L"))

    result = await categorize_product(
        db_conn,
        _FakeValkey(),
        product_id=product["id"],
        ean=None,
        name="Detergente Ypê 1L",
        ncm=None,
    )

    assert result is not None
    assert result.source == "rule"
    assert result.category_slug == "limpeza"


async def test_categorize_by_ai_fallback_when_no_ncm_or_rule_match(
    db_conn: Connection, monkeypatch
):
    calls: list[str] = []
    _install_ai_slug(monkeypatch, "outros", calls=calls)
    product = await product_repository.create(db_conn, NewProduct(name="Item Sem Termo XPTO-9"))

    result = await categorize_product(
        db_conn,
        _FakeValkey(),
        product_id=product["id"],
        ean="7891000100103",
        name="Item Sem Termo XPTO-9",
        ncm=None,
    )

    assert result is not None
    assert result.source == "ai"
    assert result.category_slug == "outros"
    assert calls == ["categorize_product"]


async def test_categorize_by_ai_caches_result_by_ean(db_conn: Connection, monkeypatch):
    calls: list[str] = []
    _install_ai_slug(monkeypatch, "outros", calls=calls)
    valkey = _FakeValkey()
    ean = "7891000100110"
    product = await product_repository.create(db_conn, NewProduct(ean=ean, name="Item XPTO-9 v2"))

    first = await categorize_product(
        db_conn, valkey, product_id=product["id"], ean=ean, name="Item XPTO-9 v2", ncm=None
    )
    second = await categorize_product(
        db_conn, valkey, product_id=product["id"], ean=ean, name="Item XPTO-9 v2", ncm=None
    )

    assert first is not None
    assert second is not None
    assert second.source == "ai"
    assert calls == ["categorize_product"]  # 2ª vez usou o cache por EAN


async def test_categorize_by_ai_invalid_response_leaves_product_uncategorized(
    db_conn: Connection, monkeypatch
):
    _install_ai_slug(monkeypatch, None, calls=[])
    product = await product_repository.create(db_conn, NewProduct(name="Item Sem Termo XPTO-10"))

    result = await categorize_product(
        db_conn,
        _FakeValkey(),
        product_id=product["id"],
        ean=None,
        name="Item Sem Termo XPTO-10",
        ncm=None,
    )

    assert result is None
    updated = await product_repository.get_by_id(db_conn, product["id"])
    assert updated["category_id"] is None
    assert updated["category_source"] is None


async def test_categorize_by_ai_unknown_slug_is_rejected(db_conn: Connection, monkeypatch):
    _install_ai_slug(monkeypatch, "categoria-que-nao-existe", calls=[])
    product = await product_repository.create(db_conn, NewProduct(name="Item Sem Termo XPTO-11"))

    result = await categorize_product(
        db_conn,
        _FakeValkey(),
        product_id=product["id"],
        ean=None,
        name="Item Sem Termo XPTO-11",
        ncm=None,
    )

    assert result is None
