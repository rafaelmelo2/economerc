from asyncpg import Connection

from api.repositories.geo.city_repository import city_repository
from api.repositories.shared.listing import ListParams


async def test_list_cities_returns_seeded_catalao(db_conn: Connection):
    page = await city_repository.list_cities(db_conn, ListParams(skip=0, limit=10))
    names = [c["name"] for c in page.items]
    assert "Catalão" in names
    assert page.total >= 1
    assert page.has_more is False


async def test_get_by_ibge_code_finds_catalao(db_conn: Connection):
    city = await city_repository.get_by_ibge_code(db_conn, 5205109)
    assert city is not None
    assert city["name"] == "Catalão"
    assert city["state_code"] == "GO"
    assert city["is_active"] is True


async def test_get_by_ibge_code_unknown_returns_none(db_conn: Connection):
    city = await city_repository.get_by_ibge_code(db_conn, 9999999)
    assert city is None


async def test_list_cities_search_filters_by_name(db_conn: Connection):
    page = await city_repository.list_cities(db_conn, ListParams(skip=0, limit=10, search="Catal"))
    assert len(page.items) == 1
    assert page.items[0]["name"] == "Catalão"

    empty_page = await city_repository.list_cities(
        db_conn, ListParams(skip=0, limit=10, search="Cidade Que Nao Existe")
    )
    assert empty_page.items == []
    assert empty_page.total == 0
