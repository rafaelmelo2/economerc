"""Endpoints `/reports/*` (bloco 5B, docs/roadmap-fase1.md > Etapa 9/10) — dados SÓ do próprio

usuário (`CurrentUser`, nunca `AdminUser`: histórico é privado). Regra anti-dupla-contagem
documentada em `api.repositories.reports.report_repository`."""

import datetime as dt
import re
from typing import Final

from asyncpg import Connection
from fastapi import APIRouter, Depends, Query

from api.core.exceptions import BadRequestError
from api.dependencies.auth import CurrentUser
from api.models.shared.paged_response import PagedResponse
from api.repositories.reports.report_repository import MONTHS_WINDOW, report_repository
from api.routes.shared.list_params import ListParamsDep
from api.schemas.reports.report import (
    CategorySpending,
    MonthlyReportResponse,
    MonthSummaryResponse,
    PurchaseResponse,
)
from config.database import get_conn

router = APIRouter(prefix="/reports", tags=["Reports"])

MONTH_QUERY_PATTERN: Final = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
DECEMBER: Final = 12


def _parse_month(month: str) -> dt.date:
    if not MONTH_QUERY_PATTERN.match(month):
        raise BadRequestError(detail=f"Mês inválido: {month!r} (esperado YYYY-MM).")
    year, mon = month.split("-")
    return dt.date(int(year), int(mon), 1)


def _next_month(day: dt.date) -> dt.date:
    if day.month == DECEMBER:
        return dt.date(day.year + 1, 1, 1)
    return dt.date(day.year, day.month + 1, 1)


@router.get("/monthly", response_model=MonthlyReportResponse)
async def get_monthly_report(
    user: CurrentUser,
    month: str = Query(..., description="Mês no formato YYYY-MM"),
    conn: Connection = Depends(get_conn),
) -> MonthlyReportResponse:
    start = _parse_month(month)
    end = _next_month(start)
    totals = await report_repository.get_monthly_totals(conn, user.user_id, start, end)
    by_category = await report_repository.get_monthly_category_breakdown(
        conn, user.user_id, start, end
    )
    return MonthlyReportResponse(
        month=month,
        total_amount=totals["total_amount"],
        purchase_count=totals["purchase_count"],
        by_category=[CategorySpending(**row) for row in by_category],
    )


@router.get("/purchases", response_model=PagedResponse[PurchaseResponse])
async def list_purchases(
    user: CurrentUser,
    params: ListParamsDep,
    conn: Connection = Depends(get_conn),
) -> PagedResponse[PurchaseResponse]:
    page = await report_repository.list_purchases(conn, user.user_id, params)
    return PagedResponse(
        items=page.items,
        total=page.total,
        skip=params.skip,
        limit=params.limit,
        has_more=page.has_more,
    )


@router.get("/months", response_model=list[MonthSummaryResponse])
async def list_months(
    user: CurrentUser, conn: Connection = Depends(get_conn)
) -> list[MonthSummaryResponse]:
    rows = await report_repository.get_last_months_summary(conn, user.user_id, months=MONTHS_WINDOW)
    return [MonthSummaryResponse(**row) for row in rows]
