"""Whitelist fechado de `ORDER BY` (skill `database` > `list-pagination.md`).

asyncpg não tem quoting de identificador — a string do cliente é só chave de
dict, o fragmento SQL é literal, escrito à mão no fonte. `sort`/`order` do
request NUNCA vira f-string direto; sempre passa por `order_by(_SORTS, ...)`.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Final

DEFAULT_SORT_KEY: Final = "created_at"


@dataclass(frozen=True, slots=True)
class SortSpec:
    asc: str
    desc: str
    default_order: str = "asc"


SortMap = Mapping[str, SortSpec]


def by_column(column: str, *, alias: str = "", default_order: str = "asc") -> SortSpec:
    """Monta os dois fragmentos de `column`, SEMPRE desempatados por `id`."""
    prefix = f"{alias}." if alias else ""
    return SortSpec(
        asc=f"{prefix}{column} ASC, {prefix}id ASC",
        desc=f"{prefix}{column} DESC, {prefix}id DESC",
        default_order=default_order,
    )


def standard_sorts(
    alias: str = "",
    *,
    alpha: str | None = None,
    updated: bool = True,
    extra: Mapping[str, SortSpec] | None = None,
) -> dict[str, SortSpec]:
    """Mapa canônico: `created_at` (default), chave alfabética, `updated_at`."""
    sorts = {"created_at": by_column("created_at", alias=alias, default_order="desc")}
    if alpha:
        sorts[alpha] = by_column(alpha, alias=alias)
    if updated:
        sorts["updated_at"] = by_column("updated_at", alias=alias, default_order="desc")
    if extra:
        sorts.update(extra)
    return sorts


def order_by(
    sorts: SortMap,
    sort: str | None,
    order: str | None,
    default: str = DEFAULT_SORT_KEY,
) -> str:
    """Resolve o par do request num fragmento. Chave desconhecida → `sorts[default]`."""
    spec = sorts.get(sort or "") or sorts[default]
    direction = (order or spec.default_order).lower()
    return spec.desc if direction == "desc" else spec.asc
