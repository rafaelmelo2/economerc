from pydantic import BaseModel


class PagedResponse[T](BaseModel):
    """Envelope padrão de toda listagem (skill `database` > `list-pagination.md`).

    `total` é exato quando `skip == 0`; fora daí é lower bound. `limit` ecoa o
    PEDIDO do cliente, nunca o `limit+1` da sentinela.
    """

    items: list[T]
    total: int
    skip: int
    limit: int
    has_more: bool = False
