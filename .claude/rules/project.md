# EconoMerc — Este Projeto

App de controle de compras de supermercado: escaneia produtos, soma o carrinho em tempo real
contra o orçamento, categoriza automaticamente e guarda o histórico (Fase 1). Evolui para mural
de promoções com crowdsourcing (Fase 2) e lista de compras mais barata por IA (Fase 3).
Visão completa: `docs/produto.md`. Arquitetura: `docs/arquitetura.md`.

## Monorepo

| Pasta | Papel | Regra |
|---|---|---|
| `apps/mobile` | **O produto** (Expo). Manda em tudo. | `mobile.md` + skill `mobile-expo` |
| `apps/web` | Resumo: landing, histórico/gráficos, mural (leitura), admin | `web.md` + skill `frontend` |
| `backend` | API FastAPI + workers | `backend.md` + skills `database`/`auth`/`infra` |
| `packages/shared` | Tipos, Zod, cliente da API (TS puro) | — |
| `packages/design-tokens` / `docs/brand/` | Identidade visual (fonte única de cor/fonte/raio) | — |

## Domínios principais

| Domínio | Papel |
|---|---|
| `auth` + `users` | Google + Apple, OAuth-only (id_token validado via JWKS). Preferências: cidade, tamanho da família, orçamento mensal. |
| `catalog` | `products` com **EAN como chave natural**, unidade/medida para preço unitário (R$/kg, R$/L), `categories`, `product_aliases` (nome do produto em cada mercado). |
| `markets` + `regions` | Mercados por cidade (começa em Catalão-GO). CNPJ do emitente da NFC-e identifica o mercado. |
| `prices` | Observação de preço: produto × mercado × valor × `observed_at` × `source` (`nfce`, `community`, `flyer`, `manual`, `partner`) × `confidence`. Particionável por região. |
| `carts` | Sessão de compra do app (offline-first, `client_id`), itens, orçamento, alertas. |
| `receipts` | NFC-e lida pelo QR: chave de acesso única, bruto em storage privado, itens normalizados. |

## Particularidades

- **Sync offline**: toda entidade criada no app tem `client_id` (UUID do cliente) com
  `UNIQUE (user_id, client_id)`; endpoints de escrita do app são upsert idempotente.
  `GET /sync?since=` com cursor opaco. Conflito last-write-wins por campo.
- **NFC-e por UF**: `services/nfce/adapters/<uf>.py` com interface única (`parse(qr_url) →
  ReceiptDraft`). Começa por **GO** (`docs/nfce-sefaz-go.md`). Ingestão assíncrona via NATS
  JetStream (subject `receipts.ingest`), nunca no request do app.
- **IA configurável por tarefa**: `config/app/{env}.yaml > ai.tasks.<tarefa> = {model,
  timeout, max_tokens}`. Provider único: **OpenRouter** (`OPENROUTER_API_KEY`); Gemini entra pelo slug (`google/gemini-…`). Nunca chamar a API do Google direto.
  Tarefas iniciais: `price_tag_ocr` (visão), `categorize_product` (texto). Trocar modelo = só config.
- **Categorização**: regra primeiro (NCM da NFC-e → categoria, dicionário de termos), LLM só
  como fallback, resultado cacheado por EAN. Nunca chamar LLM duas vezes pro mesmo EAN.
- **Catálogo**: base própria + NFC-e + Open Food Facts. Nada de API paga (Cosmos) por enquanto.
- **Preço desatualizado**: > 15 dias sem confirmação = sinalizado (requisito do escopo).
- **LGPD**: CPF do consumidor que aparecer na NFC-e **nunca** é persistido em claro; dados de
  inteligência de mercado são agregados/anonimizados. Excluir conta apaga dados pessoais.
- **Dinheiro**: `NUMERIC(12,2)` no banco, `Decimal` no Python, string decimal no JSON. Nunca float.
- **Fuso**: armazenar UTC; exibir `America/Sao_Paulo`.

## Setup local

Ainda não existe código. Quando existir, segue o padrão nexarena:

```bash
docker compose up -d postgres valkey nats migrate
cd backend && uv sync && uv run python -m api.main
cd apps/web && bun dev
cd apps/mobile && bunx expo start
```
