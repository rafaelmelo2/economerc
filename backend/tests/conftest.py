# ruff: noqa: E402
"""Setup de teste — settings resolvidas ANTES de qualquer import de `api`/`config`.

Banco de teste real (skill `database` / `tests.md`): schema bootstrapado via
dbmate contra `economerc_test`, isolado do banco de dev (`economerc_local`).
Cada teste ganha uma conexão própria, dentro de uma transação com rollback —
FIRST (Independent/Repeatable) sem precisar recriar o schema por teste.

Valkey/NATS não entram no lifespan aqui: `ASGITransport` (como no padrão
nexarena) não dispara `startup`/`shutdown`, então `init_valkey()`/
`nats_client.connect()` nunca rodam nos testes — a suíte cobre `/api/health`
sem depender de infra além do Postgres.
"""

import os
import subprocess
from pathlib import Path

import dotenv

_TESTS_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _TESTS_DIR.parent
_REPO_ROOT = _BACKEND_DIR.parent

# Fakes sempre vencem (assignment direto, não `setdefault`) — o `.env` raiz tem
# `OPENROUTER_API_KEY=` vazia, e `setdefault` não sobrescreve uma chave já
# presente mesmo vazia. `test_ai_client.py` mocka a sessão HTTP inteira; esta
# chave só existe para `settings.openrouter_api_key` não ficar `None`.
os.environ["JWT_SECRET_KEY"] = "test_secret_key_for_unit_tests_only_padded_to_32_bytes_min"
os.environ["VALKEY_PASSWORD"] = ""
os.environ["OPENROUTER_API_KEY"] = "sk-test-fake-key-never-sent"

# O Postgres de teste é o MESMO container do `docker compose up` local (porta
# publicada, banco `economerc_test` à parte) — a senha real é a do `.env` raiz,
# não uma inventada. `override=False`: as fakes acima (já presentes) vencem.
dotenv.load_dotenv(_REPO_ROOT / ".env", override=False)

os.environ.setdefault("APP_YAML_PATH", str(_TESTS_DIR / "app.test.yaml"))

# Porta publicada do Postgres local (docs/fases-construcao.md). `dbmate up` cria
# o banco sozinho — o usuário `economerc` do container tem CREATEDB (default do
# POSTGRES_USER da imagem oficial). Cada worktree/agente da Onda 2 roda contra
# o PRÓPRIO banco (`economerc_test_2a`/`_2b`/`_2c`, nunca `economerc_test`
# compartilhado) — por isso um `TEST_DATABASE_URL` já setado no ambiente
# (docs/fases-construcao.md > regras críticas) vence o default abaixo.
_TEST_DB_PORT = os.environ.get("ECONOMERC_TEST_DB_PORT", "5442")
_TEST_DB_PASSWORD = os.environ["POSTGRES_PASSWORD"]
_DEFAULT_TEST_DATABASE_URL = (
    f"postgres://economerc:{_TEST_DB_PASSWORD}@localhost:{_TEST_DB_PORT}"
    "/economerc_test?sslmode=disable"
)
os.environ.setdefault("TEST_DATABASE_URL", _DEFAULT_TEST_DATABASE_URL)
os.environ.setdefault("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
TEST_DATABASE_URL = os.environ["TEST_DATABASE_URL"]

import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient

from api.main import app
from config.database import get_conn, init_connection


@pytest.fixture(scope="session", autouse=True)
def _db_schema():
    """Bootstrap do schema de teste via dbmate, uma vez por sessão de pytest."""
    subprocess.run(
        ["dbmate", "-e", "TEST_DATABASE_URL", "drop"],
        cwd=_BACKEND_DIR,
        check=False,
        capture_output=True,
    )
    result = subprocess.run(
        ["dbmate", "-e", "TEST_DATABASE_URL", "--no-dump-schema", "up"],
        cwd=_BACKEND_DIR,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            "dbmate up falhou para o banco de teste — Postgres está de pé em "
            f"localhost:{_TEST_DB_PORT} (docker compose up)? stdout={result.stdout} "
            f"stderr={result.stderr}"
        )
    yield
    subprocess.run(
        ["dbmate", "-e", "TEST_DATABASE_URL", "drop"],
        cwd=_BACKEND_DIR,
        check=False,
        capture_output=True,
    )


@pytest.fixture
async def db_conn():
    """Conexão isolada por teste — transação com rollback ao final (F.I.R.S.T)."""
    conn = await asyncpg.connect(dsn=TEST_DATABASE_URL)
    await init_connection(conn)
    tr = conn.transaction()
    await tr.start()
    try:
        yield conn
    finally:
        await tr.rollback()
        await conn.close()


@pytest.fixture
async def client(db_conn):
    """HTTP client com override de `get_conn` apontando pra conexão do teste."""

    async def _override_get_conn():
        yield db_conn

    app.dependency_overrides[get_conn] = _override_get_conn
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
