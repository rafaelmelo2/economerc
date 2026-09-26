from asyncpg import Connection

from api.repositories.catalog.category_repository import category_repository
from api.repositories.shared.listing import ListParams


async def test_list_categories_returns_all_ten_seeded(db_conn: Connection):
    page = await category_repository.list_categories(db_conn, ListParams(skip=0, limit=20))
    assert page.total == 10
    slugs = {c["slug"] for c in page.items}
    assert slugs == {
        "hortifruti",
        "laticinios",
        "mercearia",
        "bebidas",
        "carnes",
        "padaria",
        "congelados",
        "limpeza",
        "higiene",
        "outros",
    }


async def test_list_categories_default_order_is_position_ascending(db_conn: Connection):
    page = await category_repository.list_categories(db_conn, ListParams(skip=0, limit=20))
    positions = [c["position"] for c in page.items]
    assert positions == sorted(positions)
    assert page.items[0]["slug"] == "hortifruti"


async def test_get_by_slug_returns_icon_and_ncm_prefixes(db_conn: Connection):
    category = await category_repository.get_by_slug(db_conn, "laticinios")
    assert category is not None
    assert category["icon"] == "Milk"
    assert category["ncm_prefixes"] == ["04"]


async def test_get_by_slug_unknown_returns_none(db_conn: Connection):
    assert await category_repository.get_by_slug(db_conn, "nao-existe") is None


async def test_find_by_ncm_prefers_longest_matching_prefix(db_conn: Connection):
    """'1905' (padaria) precisa vencer '19' (mercearia) — prefixo mais específico."""
    category = await category_repository.find_by_ncm(db_conn, "19059090")
    assert category is not None
    assert category["slug"] == "padaria"


async def test_find_by_ncm_falls_back_to_broader_prefix(db_conn: Connection):
    category = await category_repository.find_by_ncm(db_conn, "19021900")
    assert category is not None
    assert category["slug"] == "mercearia"


async def test_find_by_ncm_no_match_returns_none(db_conn: Connection):
    assert await category_repository.find_by_ncm(db_conn, "99999999") is None
