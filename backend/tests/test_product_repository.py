from asyncpg import Connection

from api.repositories.catalog.product_repository import NewProduct, product_repository
from api.repositories.shared.listing import ListParams


async def test_create_and_get_by_ean(db_conn: Connection):
    created = await product_repository.create(
        db_conn, NewProduct(ean="4006381333931", name="Café Teste 500g", unit="g", net_quantity=500)
    )
    assert created["ean"] == "4006381333931"
    assert created["source"] == "manual"

    found = await product_repository.get_by_ean(db_conn, "4006381333931")
    assert found is not None
    assert found["id"] == created["id"]


async def test_get_by_ean_unknown_returns_none(db_conn: Connection):
    assert await product_repository.get_by_ean(db_conn, "0000000000000") is None


async def test_update_preserves_fields_not_sent(db_conn: Connection):
    created = await product_repository.create(
        db_conn, NewProduct(name="Arroz Teste", brand="MarcaX", unit="kg")
    )
    updated = await product_repository.update(db_conn, created["id"], {"brand": "MarcaY"})
    assert updated is not None
    assert updated["brand"] == "MarcaY"
    assert updated["name"] == "Arroz Teste"


async def test_update_soft_deleted_product_returns_none(db_conn: Connection):
    created = await product_repository.create(db_conn, NewProduct(name="Produto qualquer"))
    await product_repository.soft_delete(db_conn, created["id"])
    assert await product_repository.update(db_conn, created["id"], {"name": "Novo nome"}) is None


async def test_soft_delete_hides_from_get_by_id(db_conn: Connection):
    created = await product_repository.create(db_conn, NewProduct(name="Produto a apagar"))
    assert await product_repository.soft_delete(db_conn, created["id"]) is True
    assert await product_repository.get_by_id(db_conn, created["id"]) is None


async def test_list_products_search_matches_name_or_ean(db_conn: Connection):
    await product_repository.create(db_conn, NewProduct(ean="4006381333931", name="Café Especial"))
    await product_repository.create(db_conn, NewProduct(name="Feijão Carioca"))

    by_name = await product_repository.list_products(db_conn, ListParams(search="Café"))
    assert [p["name"] for p in by_name.items] == ["Café Especial"]

    by_ean = await product_repository.list_products(db_conn, ListParams(search="4006381333931"))
    assert [p["name"] for p in by_ean.items] == ["Café Especial"]


async def test_list_products_empty_result(db_conn: Connection):
    page = await product_repository.list_products(db_conn, ListParams(search="não existe nenhum"))
    assert page.items == []
    assert page.total == 0
    assert page.has_more is False
