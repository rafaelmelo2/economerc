"""Configuração centralizada — YAML versionado + segredos no `.env`.

Layout (skill `python-config-bootstrap`):
- `config/app/{local,staging,prod}.yaml` (versionado) — config não-secreta.
- `.env` (raiz, gitignored) — segredos + `ENVIRONMENT=local|staging|prod`.

Resolução do yaml:
- Docker: compose monta `config/app/${ENVIRONMENT}.yaml` em `/app/app.yaml`.
- Host-puro: lê `ENVIRONMENT` do `.env` e resolve `<repo>/config/app/{env}.yaml`.

`settings` é instanciado em import time → fail-fast se o yaml ou uma secret
obrigatória faltar. Nunca leia env var direto em business code — sempre via
`settings.*`.
"""

from __future__ import annotations

import os
from pathlib import Path

import yaml
from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator

from config.tools import getenv_or_raise_exception

JWT_SECRET_MIN_LENGTH = 32


def _resolve_app_yaml_path() -> Path:
    explicit = os.getenv("APP_YAML_PATH")
    if explicit:
        return Path(explicit)
    docker_path = Path("/app/app.yaml")
    if docker_path.is_file():
        return docker_path
    env = os.getenv("ENVIRONMENT", "local")
    repo_root = Path(__file__).resolve().parents[2]
    return repo_root / "config" / "app" / f"{env}.yaml"


APP_YAML_PATH = _resolve_app_yaml_path()


class PostgresPoolSettings(BaseModel):
    min_size: int
    max_size: int
    max_queries: int
    max_inactive_connection_lifetime: float
    command_timeout: float
    timeout: float


class PostgresSettings(BaseModel):
    """Kwargs do pool asyncpg. DSN vem de `DATABASE_URL` (env, nunca do yaml)."""

    pool: PostgresPoolSettings


class ValkeySettings(BaseModel):
    sock_path: str
    cache_default_ttl: int


class NatsSettings(BaseModel):
    url: str
    name: str
    connect_timeout: float
    max_reconnect_attempts: int
    reconnect_time_wait: float


class CorsSettings(BaseModel):
    allow_origins: list[str]
    allow_credentials: bool
    allow_methods: list[str]
    allow_headers: list[str]
    expose_headers: list[str]
    max_age: int


class LoggingSettings(BaseModel):
    service_name: str
    app_env: str
    level: str
    format: str = "auto"


class AiTaskSettings(BaseModel):
    """Uma tarefa de IA: modelo + parâmetros. Trocar modelo = mudar o yaml."""

    model: str
    temperature: float = 0.0
    max_tokens: int = 1024
    timeout_s: float = 10.0


class AiSettings(BaseModel):
    """Único provider: OpenRouter (API OpenAI-compatible). Modelos Gemini/etc.

    seguem disponíveis, só que servidos por lá — nunca hardcode modelo no
    código, sempre `ai.tasks.<tarefa>.model`.
    """

    base_url: str = "https://openrouter.ai/api/v1"
    tasks: dict[str, AiTaskSettings]


class Settings(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    postgres: PostgresSettings
    valkey: ValkeySettings
    nats: NatsSettings
    cors: CorsSettings
    logging: LoggingSettings
    ai: AiSettings

    postgres_password: SecretStr = Field(
        default_factory=lambda: SecretStr(getenv_or_raise_exception("POSTGRES_PASSWORD"))
    )
    jwt_secret_key: SecretStr = Field(
        default_factory=lambda: SecretStr(getenv_or_raise_exception("JWT_SECRET_KEY")),
        validate_default=True,
    )
    valkey_password: SecretStr | None = Field(default_factory=lambda: _opt("VALKEY_PASSWORD"))
    # Opcional: a app sobe sem chave (dev sem IA configurada); a chamada real
    # falha explicitamente no client (ver `services/ai/ai_client.py`).
    openrouter_api_key: SecretStr | None = Field(default_factory=lambda: _opt("OPENROUTER_API_KEY"))

    @field_validator("jwt_secret_key")
    @classmethod
    def _validate_jwt_secret_length(cls, v: SecretStr) -> SecretStr:
        if len(v.get_secret_value()) < JWT_SECRET_MIN_LENGTH:
            raise ValueError(f"JWT_SECRET_KEY precisa ter no mínimo {JWT_SECRET_MIN_LENGTH} chars")
        return v


def _opt(key: str) -> SecretStr | None:
    value = os.getenv(key)
    return SecretStr(value) if value else None


def _load() -> Settings:
    if not APP_YAML_PATH.is_file():
        env = os.getenv("ENVIRONMENT", "local")
        raise RuntimeError(
            f"app yaml não encontrado em {APP_YAML_PATH} (ENVIRONMENT={env}). "
            "Confira que config/app/{ENVIRONMENT}.yaml existe e ENVIRONMENT no .env é local/staging/prod."
        )
    with APP_YAML_PATH.open("rb") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise RuntimeError(f"app.yaml em {APP_YAML_PATH} não é um mapping na raiz")
    return Settings(**data)


settings = _load()
