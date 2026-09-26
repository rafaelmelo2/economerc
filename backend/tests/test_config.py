"""Config fail-fast (skill `python-config-bootstrap`).

`settings` já foi carregado com sucesso no import da suíte (senão o conftest
inteiro teria explodido) — este teste garante que continua explodindo alto e
claro quando falta segredo obrigatório ou o yaml não existe, em vez de
degradar silenciosamente.
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest

_BACKEND_DIR = Path(__file__).resolve().parent.parent


def _run_settings_load(env: dict[str, str], cwd: Path) -> subprocess.CompletedProcess:
    """Roda `import config.settings` num processo novo — `settings` é singleton

    de import time; testar fail-fast no MESMO processo não re-executaria `_load()`.
    `cwd` fica FORA do repo: `config/tools.py` chama `dotenv.load_dotenv()` sem
    path, que busca `.env` subindo diretórios a partir do cwd — dentro do repo
    ela encontraria o `.env` real e mascararia o segredo que o teste removeu.
    """
    return subprocess.run(
        [sys.executable, "-c", "import config.settings"],
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
    )


@pytest.fixture
def base_env(tmp_path: Path) -> dict[str, str]:
    env = os.environ.copy()
    env["APP_YAML_PATH"] = str(_BACKEND_DIR / "tests" / "app.test.yaml")
    env["POSTGRES_PASSWORD"] = "x" * 10
    env["JWT_SECRET_KEY"] = "x" * 40
    env.pop("VALKEY_PASSWORD", None)
    env.pop("OPENROUTER_API_KEY", None)
    src_dir = _BACKEND_DIR / "src"
    env["PYTHONPATH"] = f"{src_dir}:{_BACKEND_DIR}:{env.get('PYTHONPATH', '')}"
    return env


def test_settings_loads_with_required_secrets_present(base_env: dict[str, str], tmp_path: Path):
    result = _run_settings_load(base_env, tmp_path)
    assert result.returncode == 0, result.stderr


def test_settings_fails_fast_without_postgres_password(base_env: dict[str, str], tmp_path: Path):
    del base_env["POSTGRES_PASSWORD"]
    result = _run_settings_load(base_env, tmp_path)
    assert result.returncode != 0
    assert "POSTGRES_PASSWORD" in result.stderr


def test_settings_fails_fast_with_short_jwt_secret(base_env: dict[str, str], tmp_path: Path):
    base_env["JWT_SECRET_KEY"] = "short"
    result = _run_settings_load(base_env, tmp_path)
    assert result.returncode != 0
    assert "JWT_SECRET_KEY" in result.stderr


def test_settings_fails_fast_without_app_yaml(base_env: dict[str, str], tmp_path: Path):
    base_env["APP_YAML_PATH"] = str(_BACKEND_DIR / "tests" / "does_not_exist.yaml")
    result = _run_settings_load(base_env, tmp_path)
    assert result.returncode != 0
    assert "app yaml não encontrado" in result.stderr
