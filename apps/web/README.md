# apps/web — Web EconoMerc (resumo)

Complemento do app, **não** tem paridade com ele. Quatro superfícies:

1. **Landing** pública (links Play Store / App Store)
2. **Histórico e gráficos** do usuário (só leitura)
3. **Mural de promoções** (só leitura — Fase 2)
4. **Painel admin** (moderação de preços, produtos e mercados)

Stack padrão nexarena: React 19 · Vite · TanStack Router/Query/Form · Zod · shadcn · Tailwind 4 · bun.
Regras: `.claude/rules/web.md` + skill `frontend` (portão).

## Rodando local

```bash
bun install       # na raiz do monorepo
cd apps/web
bun dev           # http://localhost:5180, proxy /api -> http://localhost:8010
bun run build     # tsgo --noEmit + vite build
bun run preview   # serve o build em produção, mesma porta
```

## Estado (Onda 1, bloco 1C)

Scaffold + landing pública (`/`) + login mock (`/entrar`) + casca autenticada (sidebar com
Histórico, Ofertas e o grupo Admin) prontos, com páginas placeholder em estado vazio. Auth é
mock (`src/stores/auth.ts`, sem persist) até a onda 5. Histórico/gráficos, mural de ofertas e
admin de verdade (dados reais) entram no bloco 5B.
