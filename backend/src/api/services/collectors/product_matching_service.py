"""Casamento nome → produto via RapidFuzz (bloco 4C, docs/fontes-de-dados.md).

O crawler do Supermercado Catalão não tem EAN na página — cada alias novo roda contra
`products.name` normalizado. Score >= `AUTO_LINK_SCORE_THRESHOLD` linka na hora; abaixo disso
só grava a sugestão (`product_aliases.suggested_product_id/score`) pro admin decidir depois.
Catálogo ainda pequeno (cold start) — comparar em Python contra a lista inteira é OK; RapidFuzz
é CPU-bound e roda em thread (skill `anyio-concurrency`) quando o catálogo crescer.
"""

import re
import unicodedata
from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from asyncpg import Connection
from rapidfuzz import fuzz, process

from api.repositories.catalog.product_repository import product_repository

AUTO_LINK_SCORE_THRESHOLD: Decimal = Decimal("92.0")

_WHITESPACE_RE = re.compile(r"\s+")


def normalize_product_name(name: str) -> str:
    """Maiúsculas, sem acento, espaços colapsados — mesma chave nos dois lados do match."""
    decomposed = unicodedata.normalize("NFKD", name)
    ascii_only = decomposed.encode("ascii", "ignore").decode("ascii")
    return _WHITESPACE_RE.sub(" ", ascii_only).strip().upper()


@dataclass(frozen=True, slots=True)
class ProductMatchSuggestion:
    product_id: UUID
    score: Decimal

    @property
    def is_auto_link(self) -> bool:
        return self.score >= AUTO_LINK_SCORE_THRESHOLD


async def suggest_product_match(conn: Connection, raw_name: str) -> ProductMatchSuggestion | None:
    """Melhor candidato do catálogo para `raw_name`, ou `None` se o catálogo está vazio."""
    candidates = await product_repository.list_id_and_name(conn)
    if not candidates:
        return None

    normalized_target = normalize_product_name(raw_name)
    choices = {c["id"]: normalize_product_name(c["name"]) for c in candidates}
    best = process.extractOne(normalized_target, choices, scorer=fuzz.WRatio)
    if best is None:
        return None

    _matched_name, score, product_id = best
    return ProductMatchSuggestion(product_id=product_id, score=Decimal(str(round(score, 2))))
