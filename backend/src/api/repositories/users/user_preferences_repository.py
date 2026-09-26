"""Repositório de `user_preferences` (skill `database`). Dinheiro sempre `Decimal`."""

from decimal import Decimal
from uuid import UUID

from asyncpg import Connection

DEFAULT_BUDGET_ALERT_PERCENT = 80


class UserPreferencesRepository:
    async def get_by_user_id(self, conn: Connection, user_id: UUID) -> dict | None:
        row = await conn.fetchrow("SELECT * FROM user_preferences WHERE user_id = $1", user_id)
        return dict(row) if row else None

    async def upsert(self, conn: Connection, user_id: UUID, fields: dict) -> dict:
        """`fields` contém só os campos enviados (PATCH parcial); resto preserva.

        INSERT ... ON CONFLICT cobre onboarding (1ª escrita) e edição
        subsequente com a mesma query — sem dynamic SET clause.
        """
        city_id: UUID | None = fields.get("city_id")
        household_size: int | None = fields.get("household_size")
        monthly_budget: Decimal | None = fields.get("monthly_budget")
        budget_alert_percent: int | None = fields.get("budget_alert_percent")
        row = await conn.fetchrow(
            """
            INSERT INTO user_preferences (user_id, city_id, household_size, monthly_budget, budget_alert_percent)
            VALUES ($1::uuid, $2::uuid, $3::smallint, $4::numeric, COALESCE($5::smallint, $6::smallint))
            ON CONFLICT (user_id) DO UPDATE SET
                city_id              = COALESCE($2::uuid, user_preferences.city_id),
                household_size       = COALESCE($3::smallint, user_preferences.household_size),
                monthly_budget       = COALESCE($4::numeric, user_preferences.monthly_budget),
                budget_alert_percent = COALESCE($5::smallint, user_preferences.budget_alert_percent),
                updated_at           = now()
            RETURNING *
            """,
            user_id,
            city_id,
            household_size,
            monthly_budget,
            budget_alert_percent,
            DEFAULT_BUDGET_ALERT_PERCENT,
        )
        return dict(row)

    async def delete_for_user(self, conn: Connection, user_id: UUID) -> None:
        await conn.execute("DELETE FROM user_preferences WHERE user_id = $1", user_id)


user_preferences_repository = UserPreferencesRepository()
