import uuid

import asyncpg
import pytest
from asyncpg import Connection

from api.repositories.geo.city_repository import city_repository
from api.repositories.markets.market_repository import NewMarket, market_repository
from api.repositories.shared.listing import ListParams

CATALAO_IBGE_CODE = 5205109


async def _catalao_city_id(conn: Connection):
    city = await city_repository.get_by_ibge_code(conn, CATALAO_IBGE_CODE)
    assert city is not None
    return city["id"]


async def test_list_markets_returns_the_three_seeded_markets(db_conn: Connection):
    city_id = await _catalao_city_id(db_conn)
    page = await market_repository.list_markets(db_conn, ListParams(limit=20), city_id)
    names = {m["trade_name"] for m in page.items}
    assert names == {"Supermercado Catalão", "Pontal Atacado e Varejo", "Rio Vermelho Atacadista"}


async def test_list_markets_filters_by_search(db_conn: Connection):
    city_id = await _catalao_city_id(db_conn)
    page = await market_repository.list_markets(db_conn, ListParams(search="Pontal"), city_id)
    assert [m["trade_name"] for m in page.items] == ["Pontal Atacado e Varejo"]


async def test_list_markets_empty_result_for_unknown_city(db_conn: Connection):
    page = await market_repository.list_markets(db_conn, ListParams(), uuid.uuid4())
    assert page.items == []
    assert page.total == 0


async def test_create_market_with_duplicate_cnpj_raises_unique_violation(db_conn: Connection):
    city_id = await _catalao_city_id(db_conn)
    await market_repository.create(
        db_conn, NewMarket(city_id=city_id, trade_name="Mercado A", cnpj="11222333000181")
    )
    with pytest.raises(asyncpg.UniqueViolationError):
        await market_repository.create(
            db_conn, NewMarket(city_id=city_id, trade_name="Mercado B", cnpj="11222333000181")
        )


async def test_update_market_preserves_unset_fields(db_conn: Connection):
    city_id = await _catalao_city_id(db_conn)
    created = await market_repository.create(
        db_conn, NewMarket(city_id=city_id, trade_name="Mercado Original", is_partner=False)
    )
    updated = await market_repository.update(db_conn, created["id"], {"is_partner": True})
    assert updated is not None
    assert updated["is_partner"] is True
    assert updated["trade_name"] == "Mercado Original"


async def test_soft_delete_market_hides_from_get_by_id(db_conn: Connection):
    city_id = await _catalao_city_id(db_conn)
    created = await market_repository.create(
        db_conn, NewMarket(city_id=city_id, trade_name="Mercado a apagar")
    )
    assert await market_repository.soft_delete(db_conn, created["id"]) is True
    assert await market_repository.get_by_id(db_conn, created["id"]) is None
