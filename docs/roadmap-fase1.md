# Roadmap — Fase 1 (MVP: Controle de Compras)

Meta: **Ana consegue fazer a compra do mês escaneando, vendo o total contra o orçamento, mesmo sem
sinal, e no fim lê a NFC-e e tem o histórico categorizado.** Prazo de referência do escopo: 4 meses.

Cada etapa termina com algo **verificável** (teste passando, tela rodando no aparelho, endpoint
respondendo). Uma etapa não começa sem a anterior verificada. Marca (logo, cores, tokens) corre em
paralelo em `docs/brand/` e entra a partir da etapa 4.

## Etapa 0 — Fundação do repositório
- [ ] Workspace bun (`apps/*`, `packages/*`), `packages/shared` com tsconfig e Zod.
- [ ] `compose.yaml` + override por `ENVIRONMENT` (padrão nexarena): postgres, valkey, nats, migrate.
- **Verificação:** `docker compose up -d --wait` sobe tudo saudável.

## Etapa 1 — Backend base
- [ ] Scaffold FastAPI (skills `python-config-bootstrap`, `logging-setup`), `config/app/{local,staging,prod}.yaml`.
- [ ] dbmate + primeiras migrations: `states`, `cities` (seed GO + Catalão), `categories` (seed com NCM).
- [ ] `/api/health`, `CustomORJSONResponse`, `PagedResponse`, erros padrão.
- [ ] Bloco `ai.tasks` na config + cliente único (Gemini/OpenRouter) com log de custo.
- **Verificação:** `uv run pytest` verde; `curl /api/health` 200; chamada de teste a cada provider de IA.

## Etapa 2 — Auth Google + Apple
- [ ] `users`, `user_identities`, `user_preferences`, `refresh_tokens` (skill `auth`).
- [ ] `POST /auth/google`, `POST /auth/apple` (JWKS), refresh com rotação, logout, `DELETE /me`.
- [ ] Configurar projetos no Google Cloud (client IDs iOS/Android/Web) e Apple Developer (Service ID, chave).
- **Verificação:** testes de auth (token inválido, audience errada, reuso de refresh); login real
  pelo app de dev nas duas lojas de teste.

## Etapa 3 — Catálogo e EAN
- [ ] `products`, `product_aliases`, `markets`; `GET /products/by-ean/{ean}` (Postgres → Valkey → Open Food Facts).
- [ ] Validação de GTIN (DV), unidade/medida → preço por unidade.
- [ ] `prices` + `GET /prices?product&city` (último preço por mercado, flag de desatualizado > 15 dias).
- **Verificação:** EAN conhecido, EAN só no OFF, EAN inexistente e EAN inválido cobertos por teste.

## Etapa 4 — App: casca, login e perfil
- [ ] Scaffold Expo SDK 57 + Expo Router + NativeWind + react-native-reusables (skill `mobile-expo`).
- [ ] Tokens da marca (`packages/design-tokens`) aplicados; dark mode.
- [ ] Login Google/Apple, onboarding (cidade, família, orçamento mensal), perfil, excluir conta.
- [ ] EAS: perfis `development`/`preview`; build de dev instalada em Android e iPhone.
- **Verificação:** login → onboarding → perfil funcionando nos dois aparelhos físicos.

## Etapa 5 — App: scan + carrinho offline (o coração)
- [ ] SQLite local: `carts`, `cart_items`, `products_cache`, `outbox`.
- [ ] Tela de scan (EAN-13/UPC-A), debounce, haptic, lanterna; entrada manual.
- [ ] Carrinho: soma, quantidade, edição de preço, barra fixa com total × orçamento, alerta configurável.
- [ ] Backend: `POST /sync/push` (upsert idempotente por `client_id`), `GET /sync/pull?cursor=`, `sync_changes`.
- [ ] Motor de sync no app (NetInfo, foreground, pull-to-refresh, backoff).
- **Verificação:** compra completa em **modo avião** → liga a rede → tudo aparece no servidor
  uma única vez (teste de idempotência reenviando o mesmo lote). Scan ≤ 2s medido.

## Etapa 6 — OCR de etiqueta
- [ ] `POST /ocr/price-tag` (upload `user_uploads`, tarefa `price_tag_ocr`, saída estruturada: nome, preço, unidade, promo).
- [ ] App: "fotografar etiqueta" quando o EAN não tem preço; usuário confirma antes de entrar no carrinho.
- **Verificação:** conjunto de ~30 fotos reais de etiquetas de Catalão com acerto medido e anotado.

## Etapa 7 — NFC-e (GO)
- [ ] Amostras reais: juntar 10–20 notas de mercados diferentes de Catalão; responder os **[validar]** de `docs/nfce-sefaz-go.md`.
- [ ] `receipts`, `receipt_items`; `POST /receipts` (202) → NATS `receipts.ingest` → worker.
- [ ] `qr.py` (v2/v3) + `adapters/go.py` com fixtures; bruto em storage privado; descarte de CPF.
- [ ] Preços `source = nfce`, mercado pelo CNPJ, aliases; conciliação nota × carrinho no app.
- **Verificação:** todas as fixtures parseadas por teste; nota real lida pelo app aparece no histórico com itens e mercado.

## Etapa 8 — Categorização
- [ ] Regra: NCM → categoria (prefixos), dicionário de termos; IA (`categorize_product`) só como fallback, cache por EAN.
- [ ] Correção manual pelo usuário realimenta o produto.
- **Verificação:** ≥ 90% dos itens das notas de amostra categorizados sem IA ou com IA correta (medido).

## Etapa 9 — Histórico e relatórios (app)
- [ ] Lista de compras passadas (por data/mercado), detalhe, gráfico mensal e por categoria, preço por unidade.
- **Verificação:** números batem com as notas de amostra.

## Etapa 10 — Web resumo
- [ ] Scaffold padrão nexarena (skills `frontend`, `app-scaffold`, `shadcn`, `tailwind-4-setup`).
- [ ] Landing (links das lojas), login Google/Apple, histórico/gráficos (leitura), admin (produtos, mercados, preços, notas com falha).
- **Verificação:** fluxos E2E (Playwright) de login, histórico e admin.

## Etapa 11 — Lançamento fechado
- [ ] Deploy na VPS (Nginx, backups, monitor do `/api/health`), política de privacidade e termos (LGPD).
- [ ] TestFlight + teste interno da Play Store com usuários reais em Catalão.
- **Verificação:** 10+ pessoas fazendo compras reais; feedback coletado.

## Fora da Fase 1 (não fazer agora)

Mural de promoções, crowdsourcing, gamificação, mapa/rotas, cupons (Fase 2) · lista inteligente,
previsão, relatório de economia por IA (Fase 3).
