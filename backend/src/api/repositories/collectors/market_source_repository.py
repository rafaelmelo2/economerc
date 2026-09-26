"""Repositório de `market_sources` (skill `database`). Sem soft-delete — fonte inativa
recebe `is_active = false`, nunca é apagada (histórico de `collector_runs` referencia)."""

from dataclasses import dataclass
from uuid import UUID

from asyncpg import Connection


@dataclass(frozen=True, slots=True)
class NewMarketSource:
    market_id: UUID
    kind: str
    identifier: str
    is_active: bool = True


class MarketSourceRepository:
    async def create(self, conn: Connection, source: NewMarketSource) -> dict:
        row = await conn.fetchrow(
            """
            INSERT INTO market_sources (market_id, kind, identifier, is_active)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            """,
            source.market_id,
            source.kind,
            source.identifier,
            source.is_active,
        )
        return dict(row)

    async def get_by_id(self, conn: Connection, market_source_id: UUID) -> dict | None:
        row = await conn.fetchrow("SELECT * FROM market_sources WHERE id = $1", market_source_id)
        return dict(row) if row else None

    async def get_active_site_by_market_name(
        self, conn: Connection, trade_name: str
    ) -> dict | None:
        """Usado pelo crawler: acha a fonte `site` ativa a partir do nome do mercado."""
        row = await conn.fetchrow(
            """
            SELECT ms.*
              FROM market_sources ms
              JOIN markets m ON m.id = ms.market_id
             WHERE m.trade_name = $1
               AND ms.kind = 'site'
               AND ms.is_active
            """,
            trade_name,
        )
        return dict(row) if row else None

    async def get_active_whatsapp_source_by_identifier(
        self, conn: Connection, remote_jid: str
    ) -> dict | None:
        """Usado pelo webhook: casa o `remoteJid` da mensagem (grupo ou contato) com a fonte."""
        row = await conn.fetchrow(
            """
            SELECT *
              FROM market_sources
             WHERE identifier = $1
               AND kind IN ('whatsapp_group', 'whatsapp_broadcast')
               AND is_active
            """,
            remote_jid,
        )
        return dict(row) if row else None

    async def mark_success(self, conn: Connection, market_source_id: UUID) -> None:
        await conn.execute(
            "UPDATE market_sources SET last_success_at = now(), updated_at = now() WHERE id = $1",
            market_source_id,
        )

    async def mark_error(self, conn: Connection, market_source_id: UUID, error: str) -> None:
        await conn.execute(
            """
            UPDATE market_sources
               SET last_error_at = now(), last_error = $2, updated_at = now()
             WHERE id = $1
            """,
            market_source_id,
            error[:500],
        )


market_source_repository = MarketSourceRepository()
