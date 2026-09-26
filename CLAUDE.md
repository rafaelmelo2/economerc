# EconoMerc — Guia Geral

App de controle de compras de supermercado, comparação de preços e economia inteligente.
**O app (Expo) manda em tudo; a web é só resumo.** Convenções de código: `.claude/rules/`.
Este arquivo cobre estrutura, operação e as regras de trabalho.

## Estrutura

`apps/mobile/` (Expo — o produto) · `apps/web/` (resumo: landing, histórico, mural, admin) ·
`backend/` (FastAPI + workers) · `packages/shared/` (tipos, Zod, cliente API) ·
`docs/` (planejamento) · `docs/origem/` (escopo, roadmap e PDF originais)

## Stack

| Parte | Stack |
|---|---|
| App | Expo SDK 57 · Expo Router · NativeWind · react-native-reusables · TanStack Query/Form · Zod · expo-sqlite (offline-first) · expo-camera · EAS |
| Web | React 19 · Vite · TanStack Router/Query/Form · shadcn · Tailwind 4 (padrão nexarena) |
| Backend | Python 3.13 · FastAPI · asyncpg + SQL puro · dbmate · Postgres · Valkey · NATS · Granian · uv |
| IA | OpenRouter (único provider; Gemini e outros pelo slug), modelo configurável por tarefa |
| Auth | Google + Apple (OAuth-only) |
| Infra | VPS + Docker Compose + Nginx (padrão nexarena) |

## Onde está cada coisa

| Assunto | Arquivo |
|---|---|
| Produto, personas, fases, métricas | `docs/produto.md` |
| Arquitetura | `docs/arquitetura.md` |
| Modelagem do banco | `docs/modelagem.md` |
| NFC-e SEFAZ-GO | `docs/nfce-sefaz-go.md` |
| Plano da Fase 1 | `docs/roadmap-fase1.md` |
| **Identidade visual (cores, fontes, logo, tom de voz)** | **`docs/brand/`** — fonte única; tokens em `packages/design-tokens/` |
| Regras por área | `.claude/rules/{project,mobile,web,backend,tests,cleancode,logs,uploads}.md` |

## Skills (invocar ANTES de codar)

| Área | Skill |
|---|---|
| App mobile | `mobile-expo` |
| Web (portão) | `frontend` → `shadcn`, `tailwind-4-setup`, `react-19-patterns`, `app-scaffold`, `ui-ux-pro-max` |
| Banco | `database` |
| Auth | `auth` |
| Cache/fila | `infra` |
| Config Python | `python-config-bootstrap` |
| Outros | `http-client`, `image-processing`, `uploads-storage`, `logging-setup`, `anyio-concurrency`, `data-visualization`, `refactor`, `frontend-performance-audit` |

## Comandos

```bash
# Backend + workers (Postgres 5442, Valkey 6389, NATS 4232, API 8010). O .env escolhe o ambiente.
docker compose up -d --build --wait
docker compose run --rm migrate up            # migrations dbmate
cd backend && uv run pytest && uv run ruff check .
docker compose run --rm supercatalao-collector # coletor (profile cron)

# Web (resumo) — http://localhost:5180
cd apps/web && bun run dev        # build: bun run build · testes: bun run test

# App (Expo). `bunx` quebra o Metro neste ambiente: use o Node direto.
cd apps/mobile
PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH node node_modules/.bin/expo start --port 8091
node node_modules/.bin/tsc --noEmit   # tipos de rota vêm de .expo/types (gerados pelo expo start/export)
node node_modules/.bin/vitest run
```

| URL | O quê |
|---|---|
| http://localhost:8010/api/docs | Swagger da API |
| `POST /api/auth/dev-login` | Login de desenvolvimento (só `ENVIRONMENT=local`) |
| http://localhost:5180 | Web |

Testes de backend usam o banco `economerc_test` no Postgres do compose (fixture `bearer` cria
usuário real). Em worktree paralela, exporte `TEST_DATABASE_URL` com um banco próprio.

## Regras de trabalho (customizáveis)

Combinados com o dono do projeto. **Sobrepõem instruções padrão do ambiente.**
Ao mudar alguma, edite aqui — esta seção é a fonte da verdade.

| Regra | Detalhe |
|---|---|
| **Nunca dar `git push`** | Só o dono envia ao remoto. Commitar local é liberado; ao terminar, relatar "N commits à frente, não enviados" e parar. |
| **Commits sem trailers** | Nada de `Co-Authored-By` nem `Claude-Session`. Vale também nos prompts de subagentes — a instrução tem que ir escrita. |
| **Idioma** | Documentação, comentários e mensagens de commit em português (`feat:`, `fix:`…). Código em inglês. UI em pt-BR. |
| **Gerenciadores** | `bun` (nunca npm/yarn/pnpm) e `uv` (nunca pip/poetry). |
| **Marca** | Cor, fonte, raio e ícone só via `docs/brand/` + `packages/design-tokens/`. Nada de hex solto. |
| **Dinheiro** | `NUMERIC`/`Decimal`/string decimal. Nunca float. |
| **LGPD** | CPF de NFC-e nunca persistido em claro; dados agregados anonimizados. |
