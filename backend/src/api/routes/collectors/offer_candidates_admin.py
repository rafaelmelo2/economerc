from typing import Literal
from uuid import UUID

from asyncpg import Connection
from fastapi import APIRouter, Depends, Query

from api.dependencies.auth import AdminUser
from api.models.shared.paged_response import PagedResponse
from api.repositories.collectors.offer_candidate_repository import offer_candidate_repository
from api.routes.shared.list_params import ListParamsDep
from api.schemas.collectors.offer_candidate import (
    OfferCandidateApproveRequest,
    OfferCandidateResponse,
)
from api.services.collectors.offer_candidate_review_service import (
    approve_offer_candidate,
    reject_offer_candidate,
)
from config.database import get_conn

router = APIRouter(prefix="/admin/offer-candidates", tags=["Admin", "Collectors"])


@router.get("", response_model=PagedResponse[OfferCandidateResponse])
async def list_offer_candidates(
    user: AdminUser,
    params: ListParamsDep,
    status: Literal["pending", "approved", "rejected"] | None = Query(None),
    market_id: UUID | None = Query(None),
    conn: Connection = Depends(get_conn),
) -> PagedResponse[OfferCandidateResponse]:
    page = await offer_candidate_repository.list_candidates(
        conn, params, status=status, market_id=market_id
    )
    return PagedResponse(
        items=page.items,
        total=page.total,
        skip=params.skip,
        limit=params.limit,
        has_more=page.has_more,
    )


@router.post("/{candidate_id}/approve", response_model=OfferCandidateResponse)
async def approve_offer_candidate_route(
    candidate_id: UUID,
    body: OfferCandidateApproveRequest,
    user: AdminUser,
    conn: Connection = Depends(get_conn),
) -> OfferCandidateResponse:
    candidate = await approve_offer_candidate(
        conn, candidate_id, product_id=body.product_id, reviewed_by=user.user_id
    )
    return OfferCandidateResponse(**candidate)


@router.post("/{candidate_id}/reject", response_model=OfferCandidateResponse)
async def reject_offer_candidate_route(
    candidate_id: UUID, user: AdminUser, conn: Connection = Depends(get_conn)
) -> OfferCandidateResponse:
    candidate = await reject_offer_candidate(conn, candidate_id, reviewed_by=user.user_id)
    return OfferCandidateResponse(**candidate)
