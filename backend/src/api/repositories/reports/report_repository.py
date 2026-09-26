"""Repositório de `reports` (skill `database`). Read-only — agrega `cart_items`/`carts` e

`receipt_items`/`receipts` do PRÓPRIO usuário. Sem tabela nova: nenhuma migration nesta faixa.

Regra anti-dupla-contagem (docs/roadmap-fase1.md > Onda 5, bloco 5B): a mesma ida ao mercado pode
virar um carrinho fechado no app E uma NFC-e lida depois. Quando existe uma nota PROCESSADA
(`status='done'`) do MESMO mercado no MESMO dia (fuso `America/Sao_Paulo` — o dia "civil" da
compra, não o UTC) do carrinho, a nota vence e o carrinho fica de fora da soma: a nota tem
preço/item por linha vindos da SEFAZ, mais confiáveis que o scan manual do usuário. Reconciliação é
por (mercado, dia), não por carrinho↔nota individual — não há vínculo direto entre as duas tabelas
além de `receipts.cart_id` (que só é preenchido quando o app manda o QR já ligado ao carrinho; a
regra de dia+mercado cobre também o caso comum de ler o QR bem depois, sem esse vínculo).
`_ELIGIBLE_CARTS`/`_ELIGIBLE_RECEIPTS` são os dois lados dessa regra, reusados pelos 3 endpoints.
"""

import datetime as dt
from decimal import Decimal
from typing import Final
from uuid import UUID
from zoneinfo import ZoneInfo

from asyncpg import Connection

from api.repositories.shared.listing import ListPage, ListParams, sentinel

REPORT_TIMEZONE: Final = "America/Sao_Paulo"
MONTHS_WINDOW: Final = 12

# Carrinho fechado do usuário, EXCETO quando existe nota processada do MESMO mercado no MESMO
# dia local — ver docstring do módulo. $1 = user_id.
_ELIGIBLE_CARTS: Final = f"""
    SELECT c.id,
           c.market_id,
           c.closed_at AS purchase_at,
           (
               -- ROUND: `quantity` é NUMERIC(10,3) — o produto tem mais de 2 casas; a soma dos
               -- itens do carrinho fecha em dinheiro (2 casas) só uma vez, aqui.
               SELECT ROUND(COALESCE(SUM(ci.unit_price * ci.quantity), 0), 2)
                 FROM cart_items ci
                WHERE ci.cart_id = c.id AND ci.deleted_at IS NULL
           ) AS total_amount,
           (
               SELECT COUNT(*)::int
                 FROM cart_items ci
                WHERE ci.cart_id = c.id AND ci.deleted_at IS NULL
           ) AS item_count
      FROM carts c
     WHERE c.user_id = $1
       AND c.status = 'closed'
       AND c.deleted_at IS NULL
       AND c.closed_at IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM receipts r
            WHERE r.user_id = c.user_id
              AND r.status = 'done'
              AND r.market_id = c.market_id
              AND (r.issued_at AT TIME ZONE '{REPORT_TIMEZONE}')::date
                = (c.closed_at AT TIME ZONE '{REPORT_TIMEZONE}')::date
       )
"""

# Nota processada do usuário. $1 = user_id.
_ELIGIBLE_RECEIPTS: Final = """
    SELECT r.id,
           r.market_id,
           r.issued_at AS purchase_at,
           COALESCE(r.total_amount, 0) AS total_amount,
           (SELECT COUNT(*)::int FROM receipt_items ri WHERE ri.receipt_id = r.id) AS item_count
      FROM receipts r
     WHERE r.user_id = $1
       AND r.status = 'done'
"""

# FROM compartilhado entre a página e o COUNT de `list_purchases`. $1 = user_id; paginação
# ($2/$3) e o JOIN de mercado vêm depois, no corpo do método.
_PURCHASES_FROM: Final = f"""
    FROM (
        SELECT id, market_id, purchase_at, total_amount, item_count, 'cart' AS origin
          FROM ({_ELIGIBLE_CARTS}) eligible_carts
        UNION ALL
        SELECT id, market_id, purchase_at, total_amount, item_count, 'receipt' AS origin
          FROM ({_ELIGIBLE_RECEIPTS}) eligible_receipts
    ) purchases
"""

_MONTHLY_TOTALS_SQL: Final = f"""
    WITH eligible_carts AS ({_ELIGIBLE_CARTS}),
         eligible_receipts AS ({_ELIGIBLE_RECEIPTS}),
         eligible AS (
             SELECT total_amount, purchase_at FROM eligible_carts
             UNION ALL
             SELECT total_amount, purchase_at FROM eligible_receipts
         )
    SELECT COALESCE(SUM(total_amount), 0) AS total_amount, COUNT(*)::int AS purchase_count
      FROM eligible
     WHERE (purchase_at AT TIME ZONE '{REPORT_TIMEZONE}')::date >= $2
       AND (purchase_at AT TIME ZONE '{REPORT_TIMEZONE}')::date < $3
"""

_MONTHLY_CATEGORY_SQL: Final = f"""
    WITH eligible_carts AS ({_ELIGIBLE_CARTS}),
         eligible_receipts AS ({_ELIGIBLE_RECEIPTS}),
         cart_lines AS (
             SELECT p.category_id AS category_id,
                    cat.name AS category_name,
                    ci.unit_price * ci.quantity AS amount
               FROM cart_items ci
               JOIN eligible_carts ec ON ec.id = ci.cart_id
          LEFT JOIN products p ON p.id = ci.product_id
          LEFT JOIN categories cat ON cat.id = p.category_id
              WHERE ci.deleted_at IS NULL
                AND (ec.purchase_at AT TIME ZONE '{REPORT_TIMEZONE}')::date >= $2
                AND (ec.purchase_at AT TIME ZONE '{REPORT_TIMEZONE}')::date < $3
         ),
         receipt_lines AS (
             SELECT p.category_id AS category_id,
                    cat.name AS category_name,
                    ri.total_price AS amount
               FROM receipt_items ri
               JOIN eligible_receipts er ON er.id = ri.receipt_id
          LEFT JOIN products p ON p.id = ri.product_id
          LEFT JOIN categories cat ON cat.id = p.category_id
              WHERE (er.purchase_at AT TIME ZONE '{REPORT_TIMEZONE}')::date >= $2
                AND (er.purchase_at AT TIME ZONE '{REPORT_TIMEZONE}')::date < $3
         )
    SELECT category_id,
           COALESCE(category_name, 'Sem categoria') AS category_name,
           ROUND(SUM(amount), 2) AS amount
      FROM (SELECT * FROM cart_lines UNION ALL SELECT * FROM receipt_lines) combined
     GROUP BY category_id, category_name
     ORDER BY amount DESC, category_name
"""

_MONTHS_SUMMARY_SQL: Final = f"""
    WITH eligible_carts AS ({_ELIGIBLE_CARTS}),
         eligible_receipts AS ({_ELIGIBLE_RECEIPTS}),
         eligible AS (
             SELECT total_amount, purchase_at FROM eligible_carts
             UNION ALL
             SELECT total_amount, purchase_at FROM eligible_receipts
         )
    SELECT to_char(date_trunc('month', purchase_at AT TIME ZONE '{REPORT_TIMEZONE}'), 'YYYY-MM')
               AS month,
           COALESCE(SUM(total_amount), 0) AS total_amount
      FROM eligible
     WHERE (purchase_at AT TIME ZONE '{REPORT_TIMEZONE}')::date >= $2
     GROUP BY 1
"""


def _shift_months(day: dt.date, delta: int) -> dt.date:
    month_index = day.month - 1 + delta
    year = day.year + month_index // 12
    month = month_index % 12 + 1
    return dt.date(year, month, 1)


class ReportRepository:
    async def get_monthly_totals(
        self, conn: Connection, user_id: UUID, start: dt.date, end: dt.date
    ) -> dict:
        row = await conn.fetchrow(_MONTHLY_TOTALS_SQL, user_id, start, end)
        return dict(row)

    async def get_monthly_category_breakdown(
        self, conn: Connection, user_id: UUID, start: dt.date, end: dt.date
    ) -> list[dict]:
        rows = await conn.fetch(_MONTHLY_CATEGORY_SQL, user_id, start, end)
        return [dict(row) for row in rows]

    async def list_purchases(self, conn: Connection, user_id: UUID, params: ListParams) -> ListPage:
        order = "purchase_at DESC, id DESC"
        rows = await conn.fetch(
            f"""
            SELECT purchases.*,
                   COALESCE(m.trade_name, 'Mercado não informado') AS market_name
              {_PURCHASES_FROM}
         LEFT JOIN markets m ON m.id = purchases.market_id
             ORDER BY {order}
             LIMIT $2 OFFSET $3
            """,
            user_id,
            params.fetch_limit,
            params.skip,
        )
        total = None
        if params.wants_total:
            total = await conn.fetchval(f"SELECT COUNT(*) {_PURCHASES_FROM}", user_id)
        return sentinel(rows, params, total)

    async def get_last_months_summary(
        self, conn: Connection, user_id: UUID, *, months: int = MONTHS_WINDOW
    ) -> list[dict]:
        """Últimos `months` meses (incluindo o atual), meses sem compra entram com total 0 —

        o gráfico de evolução não pode "pular" um mês silencioso (rules/backend.md > DateTime:
        data comparada no MESMO fuso em que foi montada)."""
        today_local = dt.datetime.now(dt.UTC).astimezone(ZoneInfo(REPORT_TIMEZONE)).date()
        first_of_current_month = today_local.replace(day=1)
        window_start = _shift_months(first_of_current_month, -(months - 1))

        rows = await conn.fetch(_MONTHS_SUMMARY_SQL, user_id, window_start)
        by_month = {row["month"]: row["total_amount"] for row in rows}

        result: list[dict] = []
        cursor = window_start
        for _ in range(months):
            key = cursor.strftime("%Y-%m")
            result.append({"month": key, "total_amount": by_month.get(key, Decimal("0"))})
            cursor = _shift_months(cursor, 1)
        return result


report_repository = ReportRepository()
