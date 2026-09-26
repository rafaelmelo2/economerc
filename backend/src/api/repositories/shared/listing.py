"""Helpers de listagem paginada (skill `database` > `list-pagination.md`).

`ListParams` mora na camada de repository (não em `routes/`) — repository não
importa de `routes/`.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Literal


@dataclass(frozen=True, slots=True)
class ListParams:
    skip: int = 0
    limit: int = 10
    search: str | None = None
    sort: str | None = None
    order: Literal["asc", "desc"] | None = None

    @property
    def fetch_limit(self) -> int:
        """O que entra em `LIMIT $n` — um a mais que o pedido (sentinela de `has_more`)."""
        return self.limit + 1

    @property
    def wants_total(self) -> bool:
        """Só a primeira página paga o `COUNT(*)`."""
        return self.skip == 0


@dataclass(frozen=True, slots=True)
class ListPage:
    items: list[dict]
    total: int
    has_more: bool


def sentinel(rows: Sequence[Any], params: ListParams, total: int | None = None) -> ListPage:
    """Fatia um resultado over-fetched (`LIMIT limit + 1`) no envelope."""
    has_more = len(rows) > params.limit
    items = [dict(row) for row in rows[: params.limit]]
    if total is None:
        total = params.skip + len(items) + int(has_more)
    return ListPage(items=items, total=total, has_more=has_more)
