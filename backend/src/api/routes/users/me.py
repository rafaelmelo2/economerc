"""Endpoints `/me` — perfil, preferências e exclusão de conta (LGPD/App Store)."""

from asyncpg import Connection
from fastapi import APIRouter, Depends, Response

from api.core.exceptions import NotFoundError
from api.dependencies.auth import CurrentUser
from api.repositories.users.user_preferences_repository import user_preferences_repository
from api.repositories.users.user_repository import user_repository
from api.schemas.users.me import MeResponse, PreferencesResponse, UpdatePreferencesRequest
from api.services.users.user_service import delete_account
from config.database import get_conn

router = APIRouter(prefix="/me", tags=["Users"])


@router.get("", response_model=MeResponse)
async def get_me(user: CurrentUser, conn: Connection = Depends(get_conn)) -> MeResponse:
    row = await user_repository.get_by_id(conn, user.user_id)
    if row is None or row["deleted_at"] is not None:
        raise NotFoundError(detail="Usuário não encontrado")
    preferences = await user_preferences_repository.get_by_user_id(conn, user.user_id)
    return MeResponse(
        **row,
        preferences=PreferencesResponse.model_validate(preferences) if preferences else None,
    )


@router.patch("/preferences", response_model=PreferencesResponse)
async def update_my_preferences(
    user: CurrentUser,
    body: UpdatePreferencesRequest,
    conn: Connection = Depends(get_conn),
) -> PreferencesResponse:
    fields = body.model_dump(exclude_unset=True)
    row = await user_preferences_repository.upsert(conn, user.user_id, fields)
    return PreferencesResponse.model_validate(row)


@router.delete("", status_code=204, summary="Exclui a conta (LGPD/App Store)")
async def delete_me(user: CurrentUser, conn: Connection = Depends(get_conn)) -> Response:
    await delete_account(conn, user.user_id)
    return Response(status_code=204)
