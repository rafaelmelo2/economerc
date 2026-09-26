# apps/mobile — App EconoMerc (Expo / React Native)

O produto. **O app manda em tudo**: scan (EAN-13/UPC-A e QR da NFC-e), carrinho com orçamento em
tempo real, categorização, histórico e, nas próximas fases, promoções, comunidade e lista inteligente.

- Stack e invariantes: `.claude/rules/mobile.md` + skill `mobile-expo`
- Offline-first: SQLite no aparelho + fila de sync com a API (onda 3)
- Builds: EAS Build (iOS compila na nuvem, sem Mac) · atualizações: EAS Update

## Estado atual (bloco 1B — casca)

Scaffold Expo Router + NativeWind + tema da marca, navegação (login/onboarding/tabs) e telas com
dados mock. Sem SQLite/sync/scan real ainda — isso é a onda 3 (`docs/fases-construcao.md`).

```bash
bun install
bun run dev          # Metro na porta 8091
bun run typecheck    # tsc --noEmit
```
