# Marca EconoMerc

A marca é **código primeiro**. Os valores vivem num único arquivo e daí saem o tema do app, o da web e esta documentação.

```
packages/design-tokens/tokens.json   ← fonte única (cores, fontes, espaço, raio, sombra, movimento, gráficos)
        │  bun run build
        ├─► dist/web.css     → apps/web (CSS vars claro/escuro + @theme do Tailwind 4)
        └─► dist/native.ts   → apps/mobile (objetos tipados para NativeWind/StyleSheet)
```

| Arquivo | O que responde |
|---|---|
| [`plataforma.md`](plataforma.md) | Quem somos, promessa, posicionamento, personalidade, símbolo |
| [`voz.md`](voz.md) | Como a marca fala: regras, glossário, microcopy pronta (orçamento, scan, nota, vazios, push, lojas) |
| [`visual.md`](visual.md) | Quando usar cada cor, fonte, raio e movimento; logo; gráficos; ícones; foto e ilustração |
| [`prompts-imagens.md`](prompts-imagens.md) | Todas as imagens a gerar (logo, ícone, onboarding, vazios, selos, landing, lojas, social) |
| [`vitrine.html`](vitrine.html) | A marca aplicada nas telas do app, com os tokens reais e alternância claro/escuro. Abra no navegador. |
| `logo/` | Símbolo e logo horizontal (**rascunho**, até o final vetorizado) |

**Regras para quem codar**
- Nunca escreva hex, fonte ou px solto em componente: use o token.
- Texto de interface segue [`voz.md`](voz.md). Tela nova com estado vazio, erro ou alerta usa os padrões de lá.
- Mudou a identidade? Edite o `tokens.json`, rode o build e atualize o `visual.md` na mesma alteração.
