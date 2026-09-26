"""Parser puro do HTML da loja Mercafacil do Supermercado Catalão (bloco 4C).

A página é Next.js App Router (RSC) — o catálogo REAL não está nas classes do DOM renderizado
(styled-components troca o hash a cada build, então casar por `class=` quebraria no próximo
deploy do site). Cada produto vem embutido como JSON dentro dos chunks de streaming
`self.__next_f.push([1, "..."])`, um objeto `{"__typename":"EcommerceProduct", ...}` por item.
Extraímos por casamento de chaves balanceadas (`{`/`}`), não por regex guloso — o objeto tem
arrays aninhados (`variants`, `wholesale`) que um regex não-guloso ingênuo cortaria no meio.

Sem I/O aqui — função pura testada contra fixtures reais em
`tests/fixtures/collectors/supercatalao/` (`test_supercatalao_parser.py`).
"""

import datetime as dt
import json
import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Final

_NEXT_F_PUSH_RE: Final = re.compile(r'self\.__next_f\.push\(\[1,(".*?")\]\)', re.S)
_PRODUCT_MARKER: Final = '{"__typename":"EcommerceProduct"'
_PAGINATION_MARKER: Final = '{"pagination":'


@dataclass(frozen=True, slots=True)
class ScrapedProductItem:
    """Um produto da vitrine — `market_code` é o id que aparece na URL (`.../nome-<id>`)."""

    market_code: str
    raw_name: str
    amount: Decimal
    full_price: Decimal | None
    discount_percent: int | None
    department: str | None
    promo_until: dt.datetime | None


@dataclass(frozen=True, slots=True)
class PaginationInfo:
    page: int
    total_pages: int
    records: int


@dataclass(frozen=True, slots=True)
class DepartmentPageResult:
    items: list[ScrapedProductItem]
    pagination: PaginationInfo | None


def _extract_flight_texts(html: str) -> list[str]:
    """Decodifica cada literal de string JS dos chunks RSC — texto plano com JSON dentro."""
    texts = []
    for match in _NEXT_F_PUSH_RE.finditer(html):
        try:
            texts.append(json.loads(match.group(1)))
        except json.JSONDecodeError:
            continue
    return texts


def _extract_balanced_json(text: str, start: int) -> dict[str, Any] | None:
    """`text[start]` é `{` — devolve o objeto JSON completo até o `}` que fecha esse nível."""
    depth = 0
    for i in range(start, len(text)):
        char = text[i]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start : i + 1])
                except json.JSONDecodeError:
                    return None
    return None


def _parse_product(raw: dict[str, Any]) -> ScrapedProductItem | None:
    market_code = raw.get("modelId")
    name = raw.get("name")
    price = raw.get("price")
    if market_code is None or not name or price is None:
        return None

    discount_percent = int(raw.get("discount") or 0)
    price_with_discount = raw.get("priceWithDiscount") or 0
    promo_until: dt.datetime | None = None
    if discount_percent > 0 and price_with_discount:
        amount = Decimal(str(price_with_discount))
        full_price = Decimal(str(price))
        promo_until = _parse_expiration_date(raw.get("expirationDate"))
    else:
        amount = Decimal(str(price))
        full_price = None

    return ScrapedProductItem(
        market_code=str(market_code),
        raw_name=name.strip(),
        amount=amount,
        full_price=full_price,
        discount_percent=discount_percent or None,
        department=raw.get("department"),
        promo_until=promo_until,
    )


def _parse_expiration_date(value: Any) -> dt.datetime | None:
    """`expirationDate` do site — sempre `null` nas amostras reais coletadas (26/09/2026), mas o
    campo existe no payload; lemos por completude sem depender disso pra fechar a Fase."""
    if not isinstance(value, str) or not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _parse_pagination(text: str) -> PaginationInfo | None:
    start = text.find(_PAGINATION_MARKER)
    if start == -1:
        return None
    wrapper = _extract_balanced_json(text, start)
    if wrapper is None:
        return None
    pagination = wrapper.get("pagination")
    if not isinstance(pagination, dict):
        return None
    try:
        return PaginationInfo(
            page=pagination["page"],
            total_pages=pagination["totalPages"],
            records=pagination["records"],
        )
    except KeyError:
        return None


def parse_department_page(html: str) -> DepartmentPageResult:
    """Extrai os produtos + paginação de UMA página de departamento (ou da home)."""
    items: list[ScrapedProductItem] = []
    seen_market_codes: set[str] = set()
    pagination: PaginationInfo | None = None

    for text in _extract_flight_texts(html):
        for match in re.finditer(re.escape(_PRODUCT_MARKER), text):
            raw = _extract_balanced_json(text, match.start())
            if raw is None:
                continue
            item = _parse_product(raw)
            if item is None or item.market_code in seen_market_codes:
                continue
            seen_market_codes.add(item.market_code)
            items.append(item)
        if pagination is None:
            pagination = _parse_pagination(text)

    return DepartmentPageResult(items=items, pagination=pagination)


_DEPARTMENT_LINK_RE: Final = re.compile(r'"/loja/([a-zA-Z0-9-]+-\d+)"')
_DEPARTMENT_SLUG_DENYLIST: Final = frozenset({"produto", "checkout", "conta", "categorias"})


def extract_department_slugs(home_html: str) -> list[str]:
    """Slugs de departamento (`acougue-88`, `hortifruti-11`, ...) linkados na home.

    A home não traz um menu de departamentos em `<a href>` óbvio (é imagem + onClick no client),
    mas os hrefs REAIS (`/loja/{slug}-{id}`) aparecem nos mesmos chunks RSC — mesma extração.
    """
    slugs: list[str] = []
    seen: set[str] = set()
    for match in _DEPARTMENT_LINK_RE.finditer(home_html):
        slug = match.group(1)
        prefix = slug.split("-")[0]
        if prefix in _DEPARTMENT_SLUG_DENYLIST or slug in seen:
            continue
        seen.add(slug)
        slugs.append(slug)
    return slugs
