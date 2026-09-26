# backend — API EconoMerc (FastAPI)

Padrão nexarena: Python 3.13 · FastAPI + Pydantic V2 · asyncpg + SQL puro · dbmate · Postgres ·
Valkey · NATS (JetStream para ingestão de NFC-e em lote) · Granian · uv.

Responsável por: auth (Google + Apple), catálogo de produtos/EAN, preços, sync do app offline,
ingestão de NFC-e (adaptador por UF, começando por GO), OCR de etiqueta e categorização via IA
(Gemini / OpenRouter, modelo configurável por tarefa).

Regras: `.claude/rules/backend.md` + `project.md` + skills `database`, `auth`, `infra`.

Ainda sem scaffold — ver `docs/roadmap-fase1.md`.
