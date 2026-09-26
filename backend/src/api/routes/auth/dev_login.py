"""`POST /api/auth/dev-login` — login sem credenciais Google/Apple reais
(docs/fases-construcao.md > Onda 3: "Depende de você" ainda não provisionou os
client IDs). Só é registrada quando `ENVIRONMENT=local` — ver
`is_dev_login_enabled` em `routes/centralizer.py`. Nunca existe em
staging/prod, nem atrás de flag em runtime: a rota simplesmente não é
incluída no router fora de local, então bate 404 puro.
"""

from asyncpg import Connection
from fastapi import APIRouter, Depends

from api.repositories.users.user_repository import user_repository
from api.schemas.auth.auth import TokenResponse
from api.schemas.users.user import UserResponse
from api.services.auth import refresh_token_service
from config.database import get_conn

router = APIRouter(prefix="/auth", tags=["Auth (dev)"])

DEV_USER_EMAIL = "dev@economerc.local"
DEV_USER_DISPLAY_NAME = "Usuário de desenvolvimento"


async def _get_or_create_dev_user(conn: Connection) -> dict:
    user = await user_repository.get_active_by_email(conn, DEV_USER_EMAIL)
    if user is not None:
        return user
    return await user_repository.create(
        conn, email=DEV_USER_EMAIL, display_name=DEV_USER_DISPLAY_NAME
    )


@router.post(
    "/dev-login",
    response_model=TokenResponse,
    summary="Login de desenvolvimento — SÓ existe com ENVIRONMENT=local",
)
async def dev_login(conn: Connection = Depends(get_conn)) -> TokenResponse:
    user = await _get_or_create_dev_user(conn)
    await user_repository.update_last_login(conn, user["id"])
    pair = await refresh_token_service.issue_new_session(conn, user)
    return TokenResponse(
        access_token=pair.access_token,
        refresh_token=pair.refresh_token,
        expires_in=pair.expires_in,
        user=UserResponse.model_validate(pair.user),
    )
