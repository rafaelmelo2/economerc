---
name: mobile-expo
description: PORTÃO obrigatório do app EconoMerc (Expo / React Native em `apps/mobile`). INVOCAR ANTES de criar/editar QUALQUER tela, componente, hook, navegação, acesso a câmera/scan, persistência local (SQLite), fila de sync, login Google/Apple, build EAS ou config `app.config.ts`. Carrega as invariantes de stack, offline-first, scan, layout mobile (safe-area, teclado, alvos de toque) e publicação nas lojas.
---

# Mobile (Expo) — O Portão

O app é o produto: **tudo** acontece aqui (scan, carrinho, orçamento, histórico, promoções,
comunidade, lista inteligente). A web é só resumo. Uso típico: **dentro do mercado, uma mão no
celular, a outra no produto, sinal ruim**. Toda decisão de UI/dados parte disso.

## Stack (versões verificadas em 2026-09)

| Camada | Escolha | Nota |
|---|---|---|
| Runtime | **Expo SDK 57** (React Native 0.86, React 19.2, New Architecture) | `bunx expo install --fix` para alinhar deps ao SDK. Nunca fixar versão de pacote `expo-*` na mão. |
| Pkg manager | **bun** (workspace do monorepo) | NUNCA npm/yarn/pnpm. |
| Navegação | **Expo Router** (file-based, `app/`) | Grupos `(auth)` / `(app)`; guard no `_layout` do grupo, síncrono, lendo o auth store. |
| Estilo | **NativeWind 5** (Tailwind 4) — ou 4.x se o 5 ainda não estiver `latest` no scaffold | Tokens vêm de `packages/design-tokens` (frente de marca). Nunca cor hex solta em componente. |
| Componentes | **react-native-reusables** (port do shadcn, RN Primitives) | Copia pro repo em `components/ui/` — mesma filosofia do shadcn na web. |
| Server state | **TanStack Query 5** | Toda chamada à API. `useEffect + fetch` PROIBIDO. `onlineManager` ligado ao NetInfo. |
| Forms | **TanStack Form + Zod 4** | Schemas vêm de `packages/shared`. |
| Local DB | **expo-sqlite** (+ Drizzle ORM opcional só no app) | Fonte da verdade offline. Ver "Offline-first". |
| Câmera/scan | **expo-camera** (`CameraView` + `barcodeScannerSettings`) | Trocar para `react-native-vision-camera` só se medir latência > 2s (requisito do escopo). |
| Animação | **Reanimated 4** + Gesture Handler | Nada de `Animated` legado. |
| Ícones | `lucide-react-native` | Mesmo set visual da web. |
| Auth | **expo-apple-authentication** + Google (`@react-native-google-signin/google-signin`) | Ver "Login". |
| Segredos locais | **expo-secure-store** | Refresh token só aqui. NUNCA AsyncStorage para token. |
| Build/Release | **EAS Build** (iOS na nuvem, sem Mac) + **EAS Update** (OTA) + **EAS Submit** | Perfis `development` / `preview` / `production` em `eas.json`. |

> Antes de cravar uma versão nova, confira o changelog do Expo — o SDK dita as versões de RN,
> Reanimated e dos módulos `expo-*`.

## Checklist (em ordem, marque o que a tarefa toca)

- [ ] **1. Onde mora o estado?** local (useState) · servidor (Query) · **offline durável (SQLite)** ·
  sessão (secure-store). Carrinho, itens escaneados e cache de preços são SQLite — nunca só memória.
- [ ] **2. Funciona sem rede?** Todo fluxo do carrinho tem que completar em modo avião. Se a tela
  depende da API, ela mostra o último cache + selo "offline", nunca spinner infinito.
- [ ] **3. Layout mobile** (safe-area, teclado, toque — seção abaixo).
- [ ] **4. Scan** (se tocar câmera — seção abaixo).
- [ ] **5. Contrato** — tipos e Zod de `packages/shared`; nada de tipo duplicado no app.
- [ ] **6. Texto** — UI em pt-BR, valores com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`,
  datas com `Intl.DateTimeFormat('pt-BR')`. Código em inglês.
- [ ] **7. Marca** — cores, tipografia, raio e ícones SÓ via tokens de `packages/design-tokens` /
  `docs/brand/`.

## Offline-first (invariantes)

- **SQLite é a fonte da verdade do aparelho.** A UI lê do SQLite (live query / Query com
  `queryFn` local); a rede só alimenta e drena.
- **Todo registro criado no aparelho nasce com `client_id` UUID v4** gerado no cliente. O backend
  faz upsert idempotente por `(user_id, client_id)` — reenviar a mesma mutação N vezes = 1 efeito.
- **Fila de sync (outbox)**: tabela `outbox(id, entity, client_id, op, payload, created_at,
  attempts, last_error)`. Mutação local = escreve entidade + outbox **na mesma transação**.
  Drenagem em ordem de `created_at`, backoff exponencial, dispara em: volta da rede (NetInfo),
  app volta ao foreground, e manual (pull-to-refresh).
- **Conflito: last-write-wins por campo**, com `updated_at` (UTC, do relógio do cliente,
  corrigido pelo offset servidor↔cliente medido no último sync). O servidor guarda
  `updated_at` por campo mutável relevante (quantidade, preço, nome) — nunca LWW do registro inteiro.
- **Pull incremental**: `GET /sync?since=<cursor>` devolve mudanças do servidor desde o cursor
  (cursor opaco do servidor, não timestamp do cliente). Tombstones para deleções (`deleted_at`).
- **Preços de referência** (catálogo por EAN da região do usuário) ficam em cache SQLite com
  `fetched_at`; preço com mais de 15 dias é exibido como "desatualizado" (requisito do escopo).
- Nunca bloquear o carrinho esperando a API. Resolução de EAN: SQLite → API → manual.

## Scan

- Tipos: **`ean13`, `upc_a`** (produtos) e **`qr`** (NFC-e). Restringir `barcodeTypes` a esses —
  cada tipo extra custa latência e falso positivo.
- **Debounce por código**: o mesmo código lido em < 1,5s é ignorado (a câmera dispara dezenas de
  eventos). Feedback imediato: haptic (`expo-haptics`) + som curto + item aparece no topo da lista.
- Validar dígito verificador do EAN-13/UPC-A antes de qualquer lookup.
- QR que casa com URL de consulta de NFC-e (`?p=<chave>|...`) → fluxo de nota, não de produto.
  Extrair a chave de acesso (44 dígitos) no app; o parse do conteúdo da nota é do backend.
- Permissão de câmera: pedir no primeiro uso com explicação em pt-BR; negado → tela com botão
  para Configurações + entrada manual. Nunca travar o fluxo.
- Lanterna acessível na tela de scan (mercado costuma ter reflexo/luz ruim).
- Meta de desempenho do escopo: resultado em **≤ 2s** em rede normal. Medir antes de otimizar.

## Layout mobile

- **Safe-area** sempre: `react-native-safe-area-context` (`SafeAreaView`/`useSafeAreaInsets`) no
  shell; nenhuma tela assume notch/home indicator.
- **Teclado**: `react-native-keyboard-controller` (`KeyboardAwareScrollView`) em formulários;
  campo focado sempre visível; botão primário fica acima do teclado.
- **Alvos de toque ≥ 44pt** (iOS HIG) / 48dp (Android). Ícone pequeno → `hitSlop`.
- **Uma mão**: ações primárias (escanear, adicionar, finalizar) na metade de baixo da tela.
  Total do carrinho e orçamento sempre visíveis (barra fixa).
- Fonte mínima 16 no corpo; respeitar Dynamic Type/escala de fonte do sistema (não travar
  `allowFontScaling`).
- Listas longas: `FlashList` (Shopify), nunca `ScrollView` + `map`.
- Dark mode via tokens desde o início.

## Login

- **Google + Apple, OAuth-only** (sem senha). A App Store exige "Entrar com Apple" quando há
  login social — os dois aparecem juntos no iOS; no Android, Apple é opcional (pode ficar só Google).
- O app obtém o `id_token` do provedor e troca no backend (`POST /auth/google`, `POST /auth/apple`),
  que valida via JWKS e devolve access (memória) + refresh (opaco, **secure-store**). Detalhes do
  backend: skill `auth`.
- Apple só devolve nome/e-mail no **primeiro** login — o backend tem que persistir nessa hora.
- Excluir conta dentro do app é obrigatório na App Store (e LGPD) — tela em Perfil desde a Fase 1.

## Build e publicação

- `app.config.ts` (não `app.json`) lendo env por perfil; `bundleIdentifier`/`package` definidos
  uma vez e nunca mudados.
- EAS Update com `runtimeVersion` policy `fingerprint`: mudança nativa exige build novo, JS vai por OTA.
- Nunca commitar `ios/`/`android/` (prebuild/CNG gera). Credenciais ficam no EAS, não no repo.

## Proibido

- `useEffect + fetch` · token em AsyncStorage · estado do carrinho só em memória ·
  `ScrollView` com lista dinâmica · cor/fonte fora dos tokens · texto de UI em inglês ·
  `alert()` nativo para erro (usar toast) · bloquear UI esperando rede.
