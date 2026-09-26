"""Validação e normalização de GTIN — função pura, sem I/O (Etapa 3 do roadmap).

Aceita EAN-8 (8), UPC-A (12), EAN-13 (13) e GTIN-14 (14). O dígito verificador usa o
algoritmo padrão GS1 (peso 3/1 alternado a partir do dígito mais à direita do corpo, antes
do próprio verificador) — funciona igual para qualquer um dos 4 comprimentos.
"""

import re
from typing import Final

from api.core.exceptions import BadRequestError

_DIGITS_ONLY: Final = re.compile(r"^\d+$")
_VALID_LENGTHS: Final = (8, 12, 13, 14)
# Comprimento de entrada -> zeros à esquerda para chegar em 13 dígitos (EAN-13 é o padrão de
# armazenamento; GTIN-14, que já chega com 14, não precisa de padding).
_LEADING_ZEROS_TO_THIRTEEN: Final = {8: 5, 12: 1, 13: 0}


class InvalidGtinError(BadRequestError):
    TITLE = "GTIN inválido"
    DETAIL = "Código de barras (GTIN) inválido."


def _check_digit(body: str) -> int:
    """Dígito verificador GS1: peso 3 no dígito mais à direita do corpo, alternando pra 1."""
    total = sum(
        int(digit) * (3 if position % 2 == 0 else 1)
        for position, digit in enumerate(reversed(body))
    )
    return (10 - total % 10) % 10


def normalize_gtin(raw: str) -> str:
    """Valida o formato e o dígito verificador; normaliza EAN-8/UPC-A para 13 dígitos.

    Levanta `InvalidGtinError` (400, pt-BR) se o comprimento ou o dígito verificador não baterem.
    """
    candidate = raw.strip()
    if not _DIGITS_ONLY.match(candidate) or len(candidate) not in _VALID_LENGTHS:
        raise InvalidGtinError(
            detail=f"GTIN precisa ter 8, 12, 13 ou 14 dígitos numéricos (recebido: {raw!r})."
        )
    body, check_digit = candidate[:-1], int(candidate[-1])
    if _check_digit(body) != check_digit:
        raise InvalidGtinError(detail=f"Dígito verificador inválido para o GTIN {raw!r}.")
    padding = _LEADING_ZEROS_TO_THIRTEEN.get(len(candidate), 0)
    return ("0" * padding) + candidate
