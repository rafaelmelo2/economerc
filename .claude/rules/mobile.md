# Mobile (`apps/mobile`) — Expo / React Native

> **MANDATÓRIO — invocar a skill `mobile-expo` ANTES de codar qualquer coisa do app.** Esta rule é
> só o resumo das invariantes; a implementação e o checklist estão na skill.

O app **manda em tudo**. A web é só resumo (`web.md`).

## Stack

Expo SDK 57 (RN 0.86, React 19.2) · Expo Router · NativeWind (Tailwind) · react-native-reusables ·
TanStack Query + Form · Zod 4 (de `packages/shared`) · expo-sqlite · expo-camera · Reanimated 4 ·
expo-secure-store · EAS Build/Update/Submit · bun.

## Invariantes não negociáveis

- **Offline-first**: SQLite é a fonte da verdade do aparelho. Carrinho completa em modo avião.
  Registro criado no app nasce com `client_id` UUID v4; mutação local grava entidade + `outbox`
  na mesma transação; backend faz upsert idempotente por `(user_id, client_id)`.
- **Conflito**: last-write-wins **por campo** com `updated_at` UTC. Pull incremental por cursor
  opaco do servidor; deleção vira tombstone.
- **Scan**: só `ean13`, `upc_a`, `qr`. Validar dígito verificador. Debounce do mesmo código
  (1,5s). Feedback haptic + visual imediato. QR de NFC-e → fluxo de nota. Meta ≤ 2s.
- **Layout**: safe-area em todo shell · teclado nunca cobre o campo focado · alvo de toque ≥ 44pt ·
  ações primárias na metade inferior · total e orçamento sempre visíveis · `FlashList` para listas.
- **Auth**: Google + Apple, OAuth-only. Refresh token só em `expo-secure-store`; access token em
  memória. Excluir conta dentro do app (App Store + LGPD).
- **Marca**: cor, fonte, raio, ícone só via `packages/design-tokens` / `docs/brand/`.
- **Idioma**: UI pt-BR, moeda/data via `Intl` pt-BR, código em inglês.

## Estrutura (alvo)

```
apps/mobile/
  app/                 ← Expo Router: (auth)/, (app)/(tabs)/, _layout.tsx
  components/ui/       ← react-native-reusables (copiados)
  components/<dom>/    ← cart/, scan/, history/ ...
  db/                  ← schema SQLite, migrations locais, outbox, sync engine
  hooks/ lib/          ← api (reusa packages/shared), auth, formatters
  app.config.ts  eas.json
```

## Proibido

`useEffect + fetch` · token em AsyncStorage · estado do carrinho só em memória · `ScrollView` com
lista dinâmica · cor/fonte fora dos tokens · `alert()` nativo · bloquear UI esperando rede ·
commitar `ios/`/`android/`.
