from asyncpg import Connection

from api.repositories.catalog.product_repository import NewProduct, product_repository
from api.services.collectors.product_matching_service import (
    AUTO_LINK_SCORE_THRESHOLD,
    normalize_product_name,
    suggest_product_match,
)


def test_normalize_product_name_strips_accents_case_and_whitespace():
    assert normalize_product_name("Café   com Açúcar") == "CAFE COM ACUCAR"
    assert normalize_product_name("  leite  integral  ") == "LEITE INTEGRAL"


async def test_suggest_product_match_returns_none_for_empty_catalog(db_conn: Connection):
    suggestion = await suggest_product_match(db_conn, "CONTRA FILE KG")
    assert suggestion is None


async def test_suggest_product_match_exact_name_scores_above_auto_link_threshold(
    db_conn: Connection,
):
    product = await product_repository.create(db_conn, NewProduct(name="CONTRA FILE KG"))

    suggestion = await suggest_product_match(db_conn, "CONTRA FILE KG")

    assert suggestion is not None
    assert suggestion.product_id == product["id"]
    assert suggestion.is_auto_link
    assert suggestion.score >= AUTO_LINK_SCORE_THRESHOLD


async def test_suggest_product_match_unrelated_name_scores_below_threshold(db_conn: Connection):
    await product_repository.create(db_conn, NewProduct(name="CONTRA FILE KG"))

    suggestion = await suggest_product_match(db_conn, "SABONETE LUX ROSAS FRANCESAS 85G")

    assert suggestion is not None
    assert not suggestion.is_auto_link
