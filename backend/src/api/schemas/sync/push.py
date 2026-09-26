"""Contrato de `POST /sync/push` — consumido pelo motor de sync do app na
onda 3 (rules/mobile.md > outbox). Formato do lote:

```json
{
  "mutations": [
    {
      "entity": "cart",
      "op": "upsert",
      "client_id": "…uuid…",
      "updated_at": "2026-09-26T12:00:00Z",
      "fields": {"status": "open", "budget": "300.00"}
    },
    {
      "entity": "cart_item",
      "op": "upsert",
      "client_id": "…uuid…",
      "updated_at": "2026-09-26T12:01:00Z",
      "fields": {
        "cart_client_id": "…uuid do carrinho acima…",
        "product_name": "Arroz 5kg", "unit_price": "24.90", "quantity": "1", "unit": "un"
      }
    }
  ]
}
```

Dinheiro sempre string decimal (`"24.90"`, nunca `24.9`) — `float` no JSON já
perdeu precisão antes de chegar aqui, então o campo REJEITA number cru (422),
não só aceita e converte.
"""

import datetime as dt
from decimal import Decimal
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_validator

MAX_PUSH_BATCH_SIZE = 500


def _require_decimal_as_string(value: Any) -> Any:
    """`money` só entra como string decimal — number JSON (float ou int) já
    passou por um parser binário no cliente antes de virar payload; rejeitar
    aqui é a única forma de garantir que nenhum float tocou o valor em algum
    ponto da cadeia (rules/project.md > Dinheiro)."""
    if not isinstance(value, str):
        raise ValueError(f'dinheiro precisa ser string decimal (ex.: "12.50"), recebido {value!r}')
    return value


MoneyDecimal = Annotated[Decimal, BeforeValidator(_require_decimal_as_string)]

CartStatus = Literal["open", "closed", "cancelled"]
CartItemUnit = Literal["un", "kg", "g", "l", "ml"]
SyncOp = Literal["upsert", "delete"]
SyncPushStatus = Literal["applied", "ignored_stale", "rejected"]


class CartFields(BaseModel):
    """Campos editáveis de `carts` — cada um sujeito a LWW por campo."""

    model_config = ConfigDict(extra="forbid")

    market_id: UUID | None = None
    status: CartStatus | None = None
    budget: MoneyDecimal | None = Field(default=None, ge=0)
    started_at: dt.datetime | None = None
    closed_at: dt.datetime | None = None


class CartItemFields(BaseModel):
    """Campos editáveis de `cart_items` — cada um sujeito a LWW por campo.

    `cart_client_id` só é exigido na CRIAÇÃO (o service valida — o repositório
    só sabe se a linha já existe depois de consultar o banco).
    """

    model_config = ConfigDict(extra="forbid")

    cart_client_id: UUID | None = None
    product_id: UUID | None = None
    ean: str | None = Field(default=None, max_length=14)
    product_name: str | None = Field(default=None, max_length=200)
    unit_price: MoneyDecimal | None = Field(default=None, ge=0)
    quantity: Decimal | None = Field(default=None, gt=0)
    unit: CartItemUnit | None = None
    is_offer: bool | None = None


class _TimestampedMutation(BaseModel):
    """Base comum: `updated_at` precisa ser timezone-aware — LWW compara
    instantes absolutos, um valor naive não diz UTC de quê."""

    model_config = ConfigDict(extra="forbid")

    updated_at: dt.datetime

    @field_validator("updated_at")
    @classmethod
    def _updated_at_must_be_aware(cls, value: dt.datetime) -> dt.datetime:
        if value.tzinfo is None:
            raise ValueError("updated_at precisa ser timezone-aware (com Z ou offset UTC)")
        return value


class CartMutation(_TimestampedMutation):
    entity: Literal["cart"]
    op: SyncOp
    client_id: UUID
    fields: CartFields = CartFields()


class CartItemMutation(_TimestampedMutation):
    entity: Literal["cart_item"]
    op: SyncOp
    client_id: UUID
    fields: CartItemFields = CartItemFields()


SyncMutation = Annotated[CartMutation | CartItemMutation, Field(discriminator="entity")]


class SyncPushRequest(BaseModel):
    mutations: list[SyncMutation] = Field(min_length=1, max_length=MAX_PUSH_BATCH_SIZE)


class SyncPushItemResult(BaseModel):
    client_id: UUID
    status: SyncPushStatus
    reason: str | None = None
    updated_at: dt.datetime | None = None


class SyncPushResponse(BaseModel):
    results: list[SyncPushItemResult]
