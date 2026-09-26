"""Contrato de `GET /sync/pull?cursor=&limit=` — pull incremental por cursor
opaco (rules/mobile.md). Formato de resposta:

```json
{
  "changes": [
    {
      "entity": "cart", "op": "upsert", "client_id": "…uuid…",
      "updated_at": "2026-09-26T12:00:00Z",
      "fields": {"status": "open", "budget": "300.00", "market_id": null, ...}
    },
    {
      "entity": "cart_item", "op": "delete", "client_id": "…uuid…",
      "updated_at": "2026-09-26T12:05:00Z",
      "fields": {}
    }
  ],
  "has_more": false,
  "next_cursor": "MTIz"
}
```

`fields` de um `op: "delete"` vem vazio — é só o tombstone. `next_cursor`
sempre volta preenchido (mesmo com `changes` vazio) pra o app persistir e
retomar exatamente dali na próxima chamada.
"""

import datetime as dt
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel


class SyncChangeResponse(BaseModel):
    entity: Literal["cart", "cart_item"]
    op: Literal["upsert", "delete"]
    client_id: UUID
    updated_at: dt.datetime
    fields: dict[str, Any]


class SyncPullResponse(BaseModel):
    changes: list[SyncChangeResponse]
    has_more: bool
    next_cursor: str
