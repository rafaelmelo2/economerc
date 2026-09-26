"""Handler de erros padrão — corpo tipo `problem+json` (RFC 7807, simplificado)."""

import re

import asyncpg
from fastapi import FastAPI, HTTPException, Request, status

from api.core.serializers import CustomORJSONResponse

# Mapa de constraint UNIQUE → mensagem pt-BR. Crescer conforme novas migrations chegam.
UNIQUE_CONSTRAINT_MESSAGES: dict[str, str] = {
    "products_ean_uq": "Já existe um produto com este EAN.",
    "markets_cnpj_uq": "Já existe um mercado com este CNPJ.",
    "cities_ibge_code_key": "Já existe uma cidade com este código IBGE.",
}


class BaseAPIExceptionError(Exception):
    """Exceção de domínio com corpo HTTP explícito. Suba esta, não `HTTPException` crua."""

    TYPE: str = "about:blank"
    TITLE: str = "Erro interno"
    STATUS: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    DETAIL: str = "Ocorreu um erro inesperado."

    def __init__(
        self,
        type: str | None = None,  # noqa: A002
        title: str | None = None,
        status: int | None = None,
        detail: str | None = None,
        instance: str | None = None,
    ):
        self.status_code = status or self.STATUS
        self.content = {
            "type": type or self.TYPE,
            "title": title or self.TITLE,
            "status": status or self.STATUS,
            "detail": detail or self.DETAIL,
            "instance": instance,
        }

    @property
    def detail(self) -> str:
        return self.content["detail"]


class NotFoundError(BaseAPIExceptionError):
    TITLE = "Não encontrado"
    STATUS = status.HTTP_404_NOT_FOUND
    DETAIL = "Recurso não encontrado."


class BadRequestError(BaseAPIExceptionError):
    TITLE = "Requisição inválida"
    STATUS = status.HTTP_400_BAD_REQUEST
    DETAIL = "Requisição inválida."


class UnauthorizedError(BaseAPIExceptionError):
    TITLE = "Não autenticado"
    STATUS = status.HTTP_401_UNAUTHORIZED
    DETAIL = "Sessão inválida ou expirada. Entre de novo."


class ForbiddenError(BaseAPIExceptionError):
    TITLE = "Sem permissão"
    STATUS = status.HTTP_403_FORBIDDEN
    DETAIL = "Você não tem permissão para esta ação."


async def api_exception_handler(
    request: Request, exc: BaseAPIExceptionError
) -> CustomORJSONResponse:
    return CustomORJSONResponse(status_code=exc.status_code, content=exc.content)


async def http_exception_handler(request: Request, exc: HTTPException) -> CustomORJSONResponse:
    content = {
        "type": "HTTPException",
        "title": "Erro HTTP",
        "status": exc.status_code,
        "detail": exc.detail,
        "instance": None,
    }
    return CustomORJSONResponse(status_code=exc.status_code, content=content)


def _detail_for_unique_violation(exc: asyncpg.UniqueViolationError) -> str:
    msg = str(exc)
    match = re.search(r'constraint "([^"]+)"', msg)
    if match:
        return UNIQUE_CONSTRAINT_MESSAGES.get(
            match.group(1), "Já existe um registro com este valor."
        )
    return "Já existe um registro com este valor."


async def unique_violation_handler(
    request: Request, exc: asyncpg.UniqueViolationError
) -> CustomORJSONResponse:
    content = {
        "type": "AlreadyExists",
        "title": "Já existe",
        "status": status.HTTP_400_BAD_REQUEST,
        "detail": _detail_for_unique_violation(exc),
        "instance": None,
    }
    return CustomORJSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=content)


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(BaseAPIExceptionError, api_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(asyncpg.UniqueViolationError, unique_violation_handler)
