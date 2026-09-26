"""Cursor opaco do pull (rules/mobile.md): base64 do `sync_changes.id`.

O app nunca vê o BIGSERIAL cru — só um token opaco que ele devolve no próximo
`GET /sync/pull?cursor=`. Opaco = livre pra trocar a representação interna
(ex.: compor com outro campo) sem quebrar clientes já publicados.
"""

import base64
from typing import Final

from api.core.exceptions import BadRequestError

_ENCODING: Final = "ascii"


def encode_cursor(sequence_id: int) -> str:
    return base64.urlsafe_b64encode(str(sequence_id).encode(_ENCODING)).decode(_ENCODING)


def decode_cursor(cursor: str | None) -> int:
    """`None`/vazio = início do log (antes de qualquer `sync_changes.id`)."""
    if not cursor:
        return 0
    try:
        raw = base64.urlsafe_b64decode(cursor.encode(_ENCODING)).decode(_ENCODING)
        return int(raw)
    except (ValueError, UnicodeDecodeError) as exc:
        raise BadRequestError(detail=f"cursor inválido: {cursor!r}") from exc
