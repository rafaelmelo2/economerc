"""Regex de preço pt-BR (bloco 4C) — função pura, sem I/O."""

from decimal import Decimal

from api.services.collectors.whatsapp_price_regex import (
    extract_price_candidates,
    parse_price_line,
    parse_pt_br_decimal,
)


def test_parse_pt_br_decimal_handles_thousands_separator():
    assert parse_pt_br_decimal("1.234,56") == Decimal("1234.56")
    assert parse_pt_br_decimal("4,99") == Decimal("4.99")


def test_parse_price_line_with_currency_prefix():
    match = parse_price_line("Arroz Tio João 5kg R$ 24,99")
    assert match is not None
    assert match.amount == Decimal("24.99")
    assert match.unit is None
    assert "Arroz Tio João" in match.product_name


def test_parse_price_line_with_currency_prefix_and_unit_suffix():
    match = parse_price_line("Picanha bovina R$ 49,90/kg")
    assert match is not None
    assert match.amount == Decimal("49.90")
    assert match.unit == "kg"


def test_parse_price_line_without_currency_symbol_per_weight():
    match = parse_price_line("Contra file 39,90 kg")
    assert match is not None
    assert match.amount == Decimal("39.90")
    assert match.unit == "kg"
    assert match.product_name == "Contra file"


def test_parse_price_line_no_space_between_symbol_and_amount():
    match = parse_price_line("Sabonete Lux 85g R$1,99")
    assert match is not None
    assert match.amount == Decimal("1.99")


def test_parse_price_line_thousands_separator_in_message():
    match = parse_price_line("Feijão carioca fardo R$ 1.234,56")
    assert match is not None
    assert match.amount == Decimal("1234.56")


def test_parse_price_line_leve_pague_promotion_without_numeric_price():
    match = parse_price_line("Refrigerante 2L - Leve 3 pague 2")
    assert match is not None
    assert match.amount is None
    assert match.unit == "leve 3 pague 2"
    assert match.product_name == "Refrigerante 2L"


def test_parse_price_line_leve_pague_combined_with_price():
    match = parse_price_line("Refrigerante 2L R$ 5,99 - Leve 3 Pague 2")
    assert match is not None
    assert match.amount == Decimal("5.99")
    assert match.unit == "leve 3 pague 2"
    assert match.product_name == "Refrigerante 2L"


def test_parse_price_line_returns_none_when_no_price_found():
    assert parse_price_line("Oferta especial da semana, corre que acaba rápido!!") is None


def test_parse_price_line_returns_none_for_blank_line():
    assert parse_price_line("   ") is None


def test_extract_price_candidates_parses_one_offer_per_line():
    text = (
        "🔥 OFERTAS DA SEMANA 🔥\n"
        "Arroz Tio João 5kg R$ 24,99\n"
        "Picanha bovina R$ 49,90/kg\n"
        "Válido enquanto durar o estoque\n"
        "Refrigerante 2L - Leve 3 pague 2\n"
    )

    matches = extract_price_candidates(text)

    assert len(matches) == 3
    assert matches[0].amount == Decimal("24.99")
    assert matches[1].unit == "kg"
    assert matches[2].amount is None and matches[2].unit == "leve 3 pague 2"
