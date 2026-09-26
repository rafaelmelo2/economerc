"""Dicionário de termos pt-BR → categoria (docs/roadmap-fase1.md > Etapa 8, passo b).

Dado versionado em `category_terms.json` (curadoria manual). `category_corrections`
(tabela) é o ledger de correções manuais — funciona como a matéria-prima de
estatística para uma futura revisão deste dicionário; a atualização do JSON em
si continua manual/curada, não automática.
"""

import json
import unicodedata
from pathlib import Path
from typing import Final

_TERMS_PATH: Final = Path(__file__).parent / "category_terms.json"


def normalize_term(text: str) -> str:
    """NFKD → ASCII → minúsculas. 'Alcatrão' e 'alcatra' não colidem: normaliza,
    não stem — casamento é por substring do termo normalizado."""
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return ascii_text.lower()


def _load_term_index() -> list[tuple[str, str]]:
    """`(termo normalizado, slug da categoria)`, do termo mais LONGO pro mais curto —
    'creme de leite' precisa vencer 'leite' quando os dois aparecem no produto."""
    raw: dict[str, list[str]] = json.loads(_TERMS_PATH.read_text(encoding="utf-8"))
    pairs = [(normalize_term(term), slug) for slug, terms in raw.items() for term in terms]
    return sorted(pairs, key=lambda pair: len(pair[0]), reverse=True)


_TERM_INDEX: Final = _load_term_index()


def match_category_slug_by_term(product_name: str) -> str | None:
    """Primeiro termo do índice (mais longo primeiro) que aparece no nome normalizado."""
    normalized_name = normalize_term(product_name)
    for term, slug in _TERM_INDEX:
        if term in normalized_name:
            return slug
    return None
