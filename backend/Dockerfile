# =============================================================================
# Stage 1 — builder: instala deps (incl. dev, para hot reload local) via uv
# =============================================================================
FROM python:3.13.13-slim-trixie AS builder

WORKDIR /app

# Venv no MESMO path absoluto em build e runtime (/app/.venv) — uv grava shebang
# absoluto nos scripts (granian, uvicorn); path diferente quebraria o exec.
ENV UV_PROJECT_ENVIRONMENT=/app/.venv \
    UV_PYTHON_DOWNLOADS=never \
    UV_PYTHON_PREFERENCE=only-system \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

COPY --from=ghcr.io/astral-sh/uv:0.11.18 /uv /uvx /bin/

COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-install-project

# =============================================================================
# Stage 2 — runtime: non-root, venv pronto no PATH
# =============================================================================
FROM python:3.13.13-slim-trixie AS runtime

ARG APP_UID=1000
RUN groupadd --system --gid 1000 app \
 && useradd  --system --uid ${APP_UID} --gid app --no-create-home --shell /sbin/nologin app

WORKDIR /app

COPY --from=builder --chown=app:app /app/.venv /app/.venv
COPY --chown=app:app . /app/

RUN install -d -o app -g app -m 0750 /app/uploads

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH=/app/src:/app \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

USER app:app

# Prod: Granian multi-worker (GRANIAN_* vem do compose.prod override). Local sobrescreve
# `command:` inteiro com uvicorn --reload (ver config/docker/compose.local.yaml).
CMD ["sh", "-c", "exec granian --interface ${GRANIAN_INTERFACE:-asgi} \
     --host ${GRANIAN_HOST:-0.0.0.0} \
     --port ${GRANIAN_PORT:-8000} \
     --workers ${GRANIAN_WORKERS:-1} \
     --runtime-threads ${GRANIAN_RUNTIME_THREADS:-1} \
     --loop ${GRANIAN_LOOP:-uvloop} \
     --http ${GRANIAN_HTTP:-auto} \
     --backlog ${GRANIAN_BACKLOG:-1024} \
     api.main:app"]
