"""Preço por unidade (R$/kg, R$/L ou R$/un) — função pura, sempre `Decimal` (nunca float)."""

from decimal import ROUND_HALF_UP, Decimal
from typing import Final, Literal

UnitPriceLabel = Literal["kg", "l", "un"]

_QUANTIZE: Final = Decimal("0.0001")
_GRAMS_PER_KG: Final = Decimal("1000")
_ML_PER_LITER: Final = Decimal("1000")

# `unit` do produto -> unidade BASE em que o preço unitário é expresso.
_BASE_UNIT: Final[dict[str, UnitPriceLabel]] = {
    "kg": "kg",
    "g": "kg",
    "l": "l",
    "ml": "l",
    "un": "un",
}


def compute_unit_price(
    amount: Decimal, unit: str, net_quantity: Decimal | None
) -> tuple[UnitPriceLabel, Decimal] | None:
    """Converte preço + unidade + quantidade líquida em preço por unidade base.

    `net_quantity` é a quantidade NA PRÓPRIA unidade de `unit` (500 em 'g', 1 em 'l', 6 em 'un'
    para um pack de 6). Sem quantidade e fora de 'un' não dá pra calcular — devolve `None`.
    """
    label = _BASE_UNIT.get(unit)
    if label is None:
        return None
    if net_quantity is None or net_quantity <= 0:
        if unit == "un":
            return "un", amount.quantize(_QUANTIZE, rounding=ROUND_HALF_UP)
        return None
    quantity_in_base = net_quantity
    if unit == "g":
        quantity_in_base = net_quantity / _GRAMS_PER_KG
    elif unit == "ml":
        quantity_in_base = net_quantity / _ML_PER_LITER
    unit_price = (amount / quantity_in_base).quantize(_QUANTIZE, rounding=ROUND_HALF_UP)
    return label, unit_price
