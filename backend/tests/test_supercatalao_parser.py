"""Parser do Supermercado Catalão contra fixtures HTML REAIS (`tests/fixtures/collectors/
supercatalao/`, capturadas em 26/09/2026 direto do site). Sem rede, sem mock — o parser é
função pura sobre string."""

from decimal import Decimal
from pathlib import Path

from api.services.collectors.supercatalao_parser import (
    extract_department_slugs,
    parse_department_page,
)

_FIXTURES_DIR = Path(__file__).parent / "fixtures" / "collectors" / "supercatalao"


def _read_fixture(name: str) -> str:
    return (_FIXTURES_DIR / name).read_text(encoding="utf-8")


def test_parse_home_page_extracts_items_with_promotion():
    html = _read_fixture("loja_home.html")

    result = parse_department_page(html)

    assert len(result.items) >= 40
    sabonete = next(item for item in result.items if item.market_code == "4888")
    assert sabonete.raw_name == "SABONETE ONETE LUX ROSAS FRANCESAS 85G"
    assert sabonete.amount == Decimal("2.29")
    assert sabonete.full_price == Decimal("3.28")
    assert sabonete.discount_percent == 31


def test_parse_home_page_item_without_promotion_has_no_full_price():
    html = _read_fixture("loja_home.html")

    result = parse_department_page(html)

    non_promo = next(item for item in result.items if item.discount_percent is None)
    assert non_promo.full_price is None
    assert non_promo.amount > 0


def test_parse_department_page_extracts_pagination_info():
    html = _read_fixture("departamento_acougue_p1.html")

    result = parse_department_page(html)

    assert result.pagination is not None
    assert result.pagination.page == 1
    assert result.pagination.total_pages == 4
    assert result.pagination.records == 107
    assert len(result.items) == 30


def test_parse_department_page_promo_item_amount_is_the_discounted_price():
    html = _read_fixture("departamento_acougue_p1.html")

    result = parse_department_page(html)

    pernil = next(item for item in result.items if item.market_code == "5990")
    assert pernil.raw_name == "PERNIL SUINO KG"
    assert pernil.amount == Decimal("14.98")
    assert pernil.full_price == Decimal("17.98")
    assert pernil.discount_percent == 17


def test_parse_department_page_hortifruti_has_no_pagination_conflict_with_acougue():
    html = _read_fixture("departamento_hortifruti_p1.html")

    result = parse_department_page(html)

    assert result.pagination is not None
    assert result.pagination.page == 1
    market_codes = {item.market_code for item in result.items}
    assert len(market_codes) == len(result.items)  # sem duplicata


def test_extract_department_slugs_finds_known_departments_and_skips_denylist():
    html = _read_fixture("loja_home.html")

    slugs = extract_department_slugs(html)

    assert "acougue-88" in slugs
    assert "hortifruti-11" in slugs
    assert "bebidas-1" in slugs
    assert not any(slug.startswith("produto-") for slug in slugs)
    assert len(slugs) == len(set(slugs))  # sem duplicata
