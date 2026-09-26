"""Helpers compartilhados pelos testes de `/sync/*` — cria usuário real (FK de
`carts`/`cart_items`) e emite o access token via o mesmo `issue_access_token`
usado pelo bloco 2A (auth), conforme o contrato do enunciado.
"""

import datetime as dt
from uuid import UUID, uuid4

from asyncpg import Connection

from api.core.security import issue_access_token


async def create_test_user(conn: Connection) -> UUID:
    row = await conn.fetchrow(
        "INSERT INTO users (email, display_name, role) VALUES ($1, $2, 'user') RETURNING id",
        f"sync-test-{uuid4()}@example.com",
        "Usuário de teste",
    )
    return row["id"]


def auth_headers(user_id: UUID) -> dict[str, str]:
    token = issue_access_token(user_id, "user")
    return {"Authorization": f"Bearer {token}"}


def iso(offset_seconds: int = 0, *, base: dt.datetime | None = None) -> str:
    """Timestamp UTC determinístico (tests.md > Repeatable) — relógio fixo +
    dado fixo, deslocado em segundos pra simular ordem de chegada."""
    reference = base or dt.datetime(2026, 9, 20, 12, 0, 0, tzinfo=dt.UTC)
    return (reference + dt.timedelta(seconds=offset_seconds)).isoformat()
