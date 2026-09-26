"""Endpoints `/auth/*` (skill `auth`). Google/Apple recebem o id_token/identity_token

já emitido pelo SDK nativo do app — nenhum code exchange aqui (isso é o fluxo
web popup, fora de escopo da Fase 1).
"""

from typing import Annotated, Final

from asyncpg import Connection
from fastapi import APIRouter, Body, Depends, Header, Request, Response

from api.core.exceptions import UnauthorizedError
from api.repositories.users.user_repository import user_repository
from api.schemas.auth.auth import (
    AppleLoginRequest,
    GoogleLoginRequest,
    RefreshRequest,
    TokenResponse,
)
from api.schemas.users.user import UserResponse
from api.services.auth import refresh_token_service
from api.services.auth.account_linking_service import get_or_create_user_for_identity
from api.services.auth.apple_id_token_service import verify_apple_id_token
from api.services.auth.google_id_token_service import verify_google_id_token
from api.services.auth.refresh_token_service import SessionTokenPair
from config.api import api_config
from config.database import get_conn
from config.settings import settings

router = APIRouter(prefix="/auth", tags=["Auth"])

REFRESH_COOKIE_NAME: Final = "refresh_token"
REFRESH_COOKIE_PATH: Final = f"{api_config.API_PREFIX}/auth/refresh"
WEB_CLIENT_HEADER_VALUE: Final = "web"


def _is_web_client(x_client: str | None) -> bool:
    return (x_client or "").strip().lower() == WEB_CLIENT_HEADER_VALUE


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)


def _apply_refresh_cookie(response: Response, raw_refresh: str, expires_in: int) -> None:
    """Clear-then-set (skill `auth` §7) — o browser nunca guarda cookie stale."""
    _clear_refresh_cookie(response)
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        raw_refresh,
        httponly=True,
        secure=settings.cookies.secure,
        samesite="strict",
        path=REFRESH_COOKIE_PATH,
        max_age=expires_in,
    )


def _token_response(pair: SessionTokenPair, response: Response, *, is_web: bool) -> TokenResponse:
    """App nativo: refresh no corpo JSON (SecureStore). Web (`X-Client: web`):

    refresh só em cookie HttpOnly — nunca os dois ao mesmo tempo.
    """
    if is_web:
        _apply_refresh_cookie(response, pair.refresh_token, pair.expires_in)
        refresh_token_out = None
    else:
        refresh_token_out = pair.refresh_token
    return TokenResponse(
        access_token=pair.access_token,
        refresh_token=refresh_token_out,
        expires_in=pair.expires_in,
        user=UserResponse.model_validate(pair.user),
    )


@router.post("/google", response_model=TokenResponse, summary="Login com Google (id_token nativo)")
async def login_with_google(
    body: GoogleLoginRequest,
    response: Response,
    x_client: Annotated[str | None, Header(alias="X-Client")] = None,
    conn: Connection = Depends(get_conn),
) -> TokenResponse:
    claims = await verify_google_id_token(body.id_token)
    user = await get_or_create_user_for_identity(
        conn,
        provider="google",
        subject=claims["sub"],
        email=claims.get("email"),
        display_name=claims.get("name"),
    )
    await user_repository.update_last_login(conn, user["id"])
    pair = await refresh_token_service.issue_new_session(conn, user)
    return _token_response(pair, response, is_web=_is_web_client(x_client))


@router.post("/apple", response_model=TokenResponse, summary="Login com Apple (identity_token)")
async def login_with_apple(
    body: AppleLoginRequest,
    response: Response,
    x_client: Annotated[str | None, Header(alias="X-Client")] = None,
    conn: Connection = Depends(get_conn),
) -> TokenResponse:
    claims = await verify_apple_id_token(body.identity_token)
    user = await get_or_create_user_for_identity(
        conn,
        provider="apple",
        subject=claims["sub"],
        email=claims.get("email"),
        display_name=body.full_name,
    )
    await user_repository.update_last_login(conn, user["id"])
    pair = await refresh_token_service.issue_new_session(conn, user)
    return _token_response(pair, response, is_web=_is_web_client(x_client))


@router.post("/refresh", response_model=TokenResponse, summary="Rotaciona o refresh token")
async def refresh_session(
    request: Request,
    response: Response,
    conn: Connection = Depends(get_conn),
    body: Annotated[RefreshRequest | None, Body()] = None,
) -> TokenResponse:
    from_cookie = request.cookies.get(REFRESH_COOKIE_NAME)
    raw_refresh = (body.refresh_token if body else None) or from_cookie
    if not raw_refresh:
        raise UnauthorizedError(detail="Refresh token ausente")

    pair = await refresh_token_service.rotate_refresh_token(conn, raw_refresh)
    is_web = body is None and from_cookie is not None
    return _token_response(pair, response, is_web=is_web)


@router.post("/logout", status_code=204, summary="Revoga a família do refresh token")
async def logout(
    request: Request,
    response: Response,
    conn: Connection = Depends(get_conn),
    body: Annotated[RefreshRequest | None, Body()] = None,
) -> Response:
    raw_refresh = (body.refresh_token if body else None) or request.cookies.get(REFRESH_COOKIE_NAME)
    if raw_refresh:
        await refresh_token_service.revoke_session(conn, raw_refresh)
    _clear_refresh_cookie(response)
    return Response(status_code=204)
