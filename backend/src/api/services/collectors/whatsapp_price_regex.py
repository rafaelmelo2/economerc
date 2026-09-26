"""Regex de preço pt-BR (bloco 4C) — primeira tentativa antes de gastar IA.

Cobre o jeito como mercado de bairro escreve oferta no WhatsApp: `R$ 4,99`, `4,99 kg` (preço
por peso sem "R$" explícito, comum em açougue), e condição promocional tipo `leve 3 pague 2`
(sem preço numérico — só a condição, o worker ainda tenta achar um preço na mesma linha).

Função pura, sem I/O — testada em `test_whatsapp_price_regex.py` com vários formatos.
"""

import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Final

_UNIT_WORDS: Final = ("kg", "g", "l", "ml", "un")
_UNIT_PATTERN: Final = "|".join(_UNIT_WORDS)

# R$ 4,99  |  R$4,99  |  R$ 1.234,56
_PRICE_WITH_PREFIX_RE: Final = re.compile(
    r"R\$\s*(?P<amount>\d{1,3}(?:\.\d{3})*,\d{2})(?:\s*/?\s*(?P<unit>" + _UNIT_PATTERN + r")\b)?",
    re.IGNORECASE,
)
# 4,99 kg  |  4,99/kg — preço por peso sem "R$" (comum em açougue/hortifruti)
_PRICE_PER_UNIT_RE: Final = re.compile(
    r"(?P<amount>\d{1,3}(?:\.\d{3})*,\d{2})\s*/?\s*(?P<unit>" + _UNIT_PATTERN + r")\b",
    re.IGNORECASE,
)
# leve 3 pague 2 / compre 2 leve 3
_LEVE_PAGUE_RE: Final = re.compile(r"leve\s+(?P<leve>\d+)\s+pague\s+(?P<pague>\d+)", re.IGNORECASE)


@dataclass(frozen=True, slots=True)
class PriceLineMatch:
    product_name: str
    amount: Decimal | None
    unit: str | None
    raw_line: str


def parse_pt_br_decimal(raw: str) -> Decimal:
    """`"1.234,56"` -> `Decimal("1234.56")`. Nunca float (regra de dinheiro do projeto)."""
    return Decimal(raw.replace(".", "").replace(",", "."))


def _remove_spans(line: str, matches: tuple[re.Match | None, ...]) -> str:
    """Remove os trechos casados (ordenados, offsets recalculados) e sobra o nome do produto."""
    spans = sorted(m.span() for m in matches if m is not None)
    result = line
    shift = 0
    for start, end in spans:
        result = result[: start - shift] + result[end - shift :]
        shift += end - start
    return result.strip(" -:|\t")


def parse_price_line(line: str) -> PriceLineMatch | None:
    """Uma linha de oferta -> preço + unidade + nome do produto (best-effort).

    "leve N pague M" e o preço numérico podem conviver na MESMA linha ("Refrigerante 2L
    R$ 5,99 - Leve 3 Pague 2") — tenta achar os dois; sem preço numérico, a condição promo
    sozinha só vira o `unit` (sem `amount`, quem chama decide se isso basta pra um candidato).
    """
    stripped = line.strip()
    if not stripped:
        return None

    leve_pague_match = _LEVE_PAGUE_RE.search(stripped)
    price_match = _PRICE_WITH_PREFIX_RE.search(stripped) or _PRICE_PER_UNIT_RE.search(stripped)

    if price_match is None and leve_pague_match is None:
        return None

    if leve_pague_match:
        unit = f"leve {leve_pague_match.group('leve')} pague {leve_pague_match.group('pague')}"
    elif price_match:
        unit_group = price_match.group("unit")
        unit = unit_group.lower() if unit_group else None
    else:
        unit = None

    amount = parse_pt_br_decimal(price_match.group("amount")) if price_match else None
    product_name = _remove_spans(stripped, (price_match, leve_pague_match)) or stripped

    return PriceLineMatch(product_name=product_name, amount=amount, unit=unit, raw_line=stripped)


def extract_price_candidates(text: str) -> list[PriceLineMatch]:
    """Aplica `parse_price_line` linha a linha — mensagem de oferta é tipicamente 1 item/linha."""
    matches = []
    for line in text.splitlines():
        match = parse_price_line(line)
        if match is not None:
            matches.append(match)
    return matches
