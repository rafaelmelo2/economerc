from decimal import Decimal

from api.services.prices.unit_price_service import compute_unit_price


def test_kg_unit_returns_amount_as_is_when_net_quantity_is_one_kg():
    label, value = compute_unit_price(Decimal("10.00"), "kg", Decimal("1"))
    assert label == "kg"
    assert value == Decimal("10.0000")


def test_grams_converts_to_price_per_kg():
    # 500 g por R$ 5,00 -> R$ 10,00/kg
    label, value = compute_unit_price(Decimal("5.00"), "g", Decimal("500"))
    assert label == "kg"
    assert value == Decimal("10.0000")


def test_liters_returns_amount_as_is_when_net_quantity_is_one_liter():
    label, value = compute_unit_price(Decimal("6.50"), "l", Decimal("1"))
    assert label == "l"
    assert value == Decimal("6.5000")


def test_milliliters_converts_to_price_per_liter():
    # 250 ml por R$ 2,50 -> R$ 10,00/L
    label, value = compute_unit_price(Decimal("2.50"), "ml", Decimal("250"))
    assert label == "l"
    assert value == Decimal("10.0000")


def test_un_without_net_quantity_returns_amount_itself():
    label, value = compute_unit_price(Decimal("3.99"), "un", None)
    assert label == "un"
    assert value == Decimal("3.9900")


def test_un_pack_divides_by_net_quantity():
    # pacote de 12 unidades por R$ 24,00 -> R$ 2,00/un
    label, value = compute_unit_price(Decimal("24.00"), "un", Decimal("12"))
    assert label == "un"
    assert value == Decimal("2.0000")


def test_kg_without_net_quantity_returns_none():
    assert compute_unit_price(Decimal("10.00"), "kg", None) is None


def test_unknown_unit_returns_none():
    assert compute_unit_price(Decimal("10.00"), "cx", Decimal("1")) is None
