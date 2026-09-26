"""Repositório de `states` — tabela de referência pequena (uma linha por UF), sem paginação."""

from asyncpg import Connection


class StateRepository:
    async def list_all(self, conn: Connection) -> list[dict]:
        rows = await conn.fetch("SELECT * FROM states ORDER BY name ASC")
        return [dict(row) for row in rows]

    async def get_by_code(self, conn: Connection, code: str) -> dict | None:
        row = await conn.fetchrow("SELECT * FROM states WHERE code = $1", code)
        return dict(row) if row else None


state_repository = StateRepository()
