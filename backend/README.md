# backend — API EconoMerc (FastAPI)

Padrão nexarena: Python 3.13 · FastAPI + Pydantic V2 · asyncpg + SQL puro · dbmate · Postgres ·
Valkey · NATS (JetStream para ingestão de NFC-e em lote) · Granian · uv.

Responsável por: auth (Google + Apple), catálogo de produtos/EAN, preços, sync do app offline,
ingestão de NFC-e (adaptador por UF, começando por GO), OCR de etiqueta e categorização via IA
(Gemini / OpenRouter, modelo configurável por tarefa).

Regras: `.claude/rules/backend.md` + `project.md` + skills `database`, `auth`, `infra`.

## Comandos

```bash
docker compose up -d --build --wait   # sobe postgres, valkey, nats, migrate, backend
curl -s localhost:8010/api/health     # 200 com db/valkey/nats
uv run pytest                          # suíte (banco de teste real via dbmate)
uv run ruff check .                    # lint
uv run python scripts/ai_smoke.py     # chamada real de IA, só com OPENROUTER_API_KEY no .env
```
