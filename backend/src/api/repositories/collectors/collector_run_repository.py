"""Repositório de `collector_runs` (skill `database`). Uma linha por execução; nunca some,
`finish` só atualiza contagens/status — histórico completo para o admin auditar."""

from uuid import UUID

from asyncpg import Connection


class CollectorRunRepository:
    async def start(
        self, conn: Connection, collector: str, market_source_id: UUID | None = None
    ) -> dict:
        row = await conn.fetchrow(
            """
            INSERT INTO collector_runs (market_source_id, collector, status)
            VALUES ($1, $2, 'running')
            RETURNING *
            """,
            market_source_id,
            collector,
        )
        return dict(row)

    async def finish(
        self,
        conn: Connection,
        run_id: UUID,
        *,
        status: str,
        items_found: int,
        aliases_created: int,
        prices_created: int,
        error_message: str | None = None,
    ) -> dict:
        row = await conn.fetchrow(
            """
            UPDATE collector_runs
               SET status = $2, items_found = $3, aliases_created = $4, prices_created = $5,
                   error_message = $6, finished_at = now()
             WHERE id = $1
             RETURNING *
            """,
            run_id,
            status,
            items_found,
            aliases_created,
            prices_created,
            error_message,
        )
        return dict(row)

    async def get_by_id(self, conn: Connection, run_id: UUID) -> dict | None:
        row = await conn.fetchrow("SELECT * FROM collector_runs WHERE id = $1", run_id)
        return dict(row) if row else None


collector_run_repository = CollectorRunRepository()
