"""Lógica pura, sem I/O (tests.md > Scope) — dicionário de termos pt-BR."""

from api.services.categorization.term_dictionary import (
    match_category_slug_by_term,
    normalize_term,
)


def test_normalize_term_strips_accents_and_lowercases():
    assert normalize_term("Requeijão") == "requeijao"
    assert normalize_term("AÇÚCAR") == "acucar"


def test_match_category_slug_by_term_finds_laticinios():
    assert match_category_slug_by_term("Leite Integral Itambé 1L") == "laticinios"


def test_match_category_slug_by_term_ignores_accent_in_product_name():
    assert match_category_slug_by_term("Requeijão Catupiry 200g") == "laticinios"


def test_match_category_slug_by_term_finds_limpeza():
    assert match_category_slug_by_term("Detergente Neutro Ypê 500ml") == "limpeza"


def test_match_category_slug_by_term_finds_carnes():
    assert match_category_slug_by_term("Alcatra Bovina Resfriada kg") == "carnes"
    assert match_category_slug_by_term("Frango Congelado 1kg") == "carnes"


def test_match_category_slug_by_term_longest_term_wins():
    """'creme de leite' precisa vencer 'leite' quando os dois aparecem no nome."""
    assert match_category_slug_by_term("Creme de Leite Nestlé 200g") == "laticinios"


def test_match_category_slug_by_term_no_match_returns_none():
    assert match_category_slug_by_term("Produto Genérico XYZ-9000") is None
