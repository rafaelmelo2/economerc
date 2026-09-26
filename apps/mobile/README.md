# apps/mobile — App EconoMerc (Expo / React Native)

O produto. **O app manda em tudo**: scan (EAN-13/UPC-A e QR da NFC-e), carrinho com orçamento em
tempo real, categorização, histórico e, nas próximas fases, promoções, comunidade e lista inteligente.

- Stack e invariantes: `.claude/rules/mobile.md` + skill `mobile-expo`
- Offline-first: SQLite no aparelho + fila de sync com a API
- Builds: EAS Build (iOS compila na nuvem, sem Mac) · atualizações: EAS Update

Ainda sem scaffold — ver `docs/roadmap-fase1.md`.
