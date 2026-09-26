# Fases de construção

> **Estado (26/09/2026):** ondas 1–6 concluídas e mescladas no `main`. Backend 269 testes, app 68,
> web 8. Verificado ponta a ponta na API real: sync idempotente, scan → produto (Open Food Facts)
> → preço, carrinho fechado → preço `community` visível para a cidade, NFC-e inexistente falha na
> hora com mensagem amigável, OCR real de etiqueta via OpenRouter, coletor real do Supermercado
> Catalão (375 produtos). Pendências no fim deste arquivo.

Como o [roadmap da Fase 1](roadmap-fase1.md) vira código. As etapas do roadmap são agrupadas em **ondas**. Dentro de uma onda, os blocos rodam **em paralelo** (subagentes em worktrees separados, cada um dono de uma pasta). Uma onda só começa quando a anterior foi mesclada e verificada.

## Portas locais (fixas; não colidem com nexarena/dudamuck/ponto)

| Serviço | Porta no host |
|---|---|
| API (FastAPI) | `8010` |
| Postgres | `5442` |
| Valkey | `6389` |
| NATS | `4232` (monitor `8232`) |
| Web (Vite) | `5180` |
| Expo (Metro) | `8091` |

## Onda 1: fundações (paralelo)

| Bloco | Dono | Etapas | Pronto quando |
|---|---|---|---|
| **1A Backend base** | `backend/`, `compose.yaml`, `config/`, `packages/shared/` | 0 + 1 | `docker compose up -d --wait` saudável · `uv run pytest` verde · `GET /api/health` 200 · migrations de `states`/`cities`/`categories` com seed |
| **1B App: casca** | `apps/mobile/` | 4 (parte sem backend) | Expo + Router + NativeWind + tokens + fontes · tab bar com scan central · login (UI) · onboarding (UI) · `tsc` e `expo export` sem erro |
| **1C Web: casca e landing** | `apps/web/` | 10 (parte sem backend) | Vite + TanStack + Tailwind 4 + shadcn + tokens · landing · layout autenticado (placeholders) · `bun run build` sem erro |

## Onda 2: domínio no backend (paralelo)

| Bloco | Dono | Etapas |
|---|---|---|
| **2A Auth** | `backend/…/auth`, `users` | 2: Google + Apple via JWKS, refresh com rotação, `DELETE /me` |
| **2B Catálogo e preços** | `backend/…/products`, `markets`, `prices` | 3: EAN (Postgres → Valkey → Open Food Facts), GTIN, preço por unidade, último preço por mercado |
| **2C Sync** | `backend/…/sync` | 5 (backend): `POST /sync/push` idempotente, `GET /sync/pull?cursor=` |

## Onda 3: o coração do app (paralelo)

| Bloco | Dono | Etapas |
|---|---|---|
| **3A App: dados e sync** | `apps/mobile/src/db`, `src/sync`, `packages/shared` (cliente API) | 5 (app): SQLite, outbox, motor de sync, login real, onboarding persistido |
| **3B App: scan e carrinho** | `apps/mobile/app/(tabs)/scan`, `carrinho` | 5 (app): câmera EAN, entrada manual, carrinho, orçamento e alertas |

## Onda 4: nota, IA e fontes de preço (paralelo)

| Bloco | Dono | Etapas |
|---|---|---|
| **4A NFC-e** | `backend/…/nfce`, `receipts` | 7: QR v2/v3, adaptador GO, worker NATS, bruto privado, descarte de CPF |
| **4B IA: OCR e categorização** | `backend/…/ocr`, `categorization` | 6 + 8: OCR de etiqueta, NCM → categoria, fallback de IA |
| **4C Coletores** | `backend/…/collectors` | [fontes-de-dados](fontes-de-dados.md): crawler Supermercado Catalão, webhook WhatsApp (Evolution) → IA de visão (OpenRouter), modo coletor |

## Onda 5: histórico, web e fechamento (paralelo)

| Bloco | Dono | Etapas |
|---|---|---|
| **5A App: nota e histórico** | `apps/mobile` | 7 + 9 (app): ler QR da nota, conciliação, histórico, gráficos |
| **5B Web: histórico e admin** | `apps/web` | 10: login, histórico, admin (produtos, mercados, preços, notas com falha, fila de ofertas) |

## Depende de você (não dá pra agente fazer)

- Credenciais Google Cloud (client IDs iOS/Android/Web) e Apple Developer (Service ID, chave `.p8`), antes do login real (onda 3).
- Chave do OpenRouter no `.env` (`OPENROUTER_API_KEY`).
- 10 a 20 NFC-e reais de Catalão (onda 4).
- Build EAS e teste em aparelho físico.
- Chip dedicado e sessão da Evolution API para o coletor de WhatsApp.

## Regras para os agentes

- Ler `CLAUDE.md` e `.claude/rules/` da área e invocar as skills-portão antes de codar.
- Trabalhar **só na própria pasta**. Commit local em português, **sem trailers** (sem `Co-Authored-By`/`Claude-Session`). **Nunca `git push`.**
- `bun` e `uv` apenas. Dinheiro nunca em float.
- Terminar com a verificação da tabela **rodada de verdade**, e relatar o que passou, o que falhou e o que ficou pendente.

## Onda 6: preço compartilhado (fechamento)

Seletor "Em qual mercado você está?" no app, preço sugerido do mercado atual no scan, carrinho
fechado gera `prices` com `source='community'` (idempotente), NFC-e inexistente falha na hora e a
API devolve `failure_message` amigável.

## Pendências para o lançamento fechado (Etapa 11)

- Build EAS de desenvolvimento (Android) → SHA-1 → cliente OAuth Android no Google Cloud; iOS e Apple depois.
- Rede WSL2 → celular (modo espelhado ou túnel) para testar o app contra a API local; depois deploy na VPS.
- 10–20 NFC-e reais de Catalão: validar o parser de GO (EAN/NCM no resumo?) e virar fixtures reais.
- Coletor do Pontal (API atrás do Cloudflare — capturar sessão num Chrome real) e chip + Evolution para o WhatsApp.
- Casamento dos 375 aliases do Supermercado Catalão com produtos (revisão no admin).
- Screenshots do app na web não saem neste ambiente (expo-sqlite trava no Chromium sandboxado) — validar visual no aparelho.
- Política de privacidade e termos (LGPD), monitor do `/api/health`, backups.
