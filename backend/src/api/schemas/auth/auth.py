from pydantic import BaseModel, Field

from api.schemas.users.user import UserResponse


class GoogleLoginRequest(BaseModel):
    """`id_token` do Google Sign-In NATIVO (app) — já assinado, backend só verifica."""

    id_token: str = Field(..., min_length=1)


class AppleLoginRequest(BaseModel):
    """`identity_token` do Sign in with Apple. `full_name` só vem no 1º login —

    Apple não reenvia em logins seguintes, então o app manda no request.
    """

    identity_token: str = Field(..., min_length=1)
    full_name: str | None = None


class RefreshRequest(BaseModel):
    """App nativo manda o refresh no corpo — SecureStore, nunca cookie (exceção

    documentada à regra de cookie da skill `auth`, que vale para a web).
    """

    refresh_token: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    # None quando `X-Client: web` — o refresh vai em cookie HttpOnly, nunca no JSON.
    refresh_token: str | None = None
    expires_in: int
    user: UserResponse
