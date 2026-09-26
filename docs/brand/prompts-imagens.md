# Prompts de imagem

Todas as imagens que o EconoMerc precisa até o lançamento da Fase 1, mais o que já dá pra adiantar das Fases 2 e 3. Os prompts estão em **inglês**, que rende mais nos modelos de imagem (Gemini/Imagen, GPT Image, Flux, Midjourney).

**Como usar**
1. Cole o **bloco de estilo** da categoria antes do prompt específico.
2. **Nunca peça texto dentro da imagem**: a IA erra letra. Nome, preço e botão entram depois, por código ou no Figma.
3. Gere 4 variações, escolha uma e **mantenha a semente/referência** para as próximas da mesma família.
4. O logo que sair da IA é **referência de conceito**: a versão final é redesenhada em vetor (SVG) antes de ir pro app.
5. Salve em `docs/brand/assets/<pasta>/` com o nome da coluna **Arquivo**.

---

## Blocos de estilo (cole antes de cada prompt)

**[ESTILO-LOGO]**
```
Flat vector logo, geometric, minimal, bold shapes, no gradients, no shadows, no 3D, no text, centered on plain background, crisp edges, scalable, works at 24px. Brand colors only: deep savings green #0E6B47, price-tag yellow #FFC83D, graphite #10231A, off-white #F7F6F1.
```

**[ESTILO-ILUSTRA]**
```
Flat vector illustration, friendly and warm, rounded shapes, thick consistent outlines 2px in graphite #10231A, limited palette: deep green #0E6B47, light green #CDEBDA, price-tag yellow #FFC83D used only as a small accent, off-white #F7F6F1 background, soft coral #E0604F sparingly. No gradients, no 3D, no text, no letters, no numbers, generous empty space, Brazilian neighborhood supermarket context, simple and readable at small size.
```

**[ESTILO-FOTO]**
```
Candid documentary photography, natural daylight, real Brazilian neighborhood supermarket in a mid-sized interior town, authentic diverse Brazilian people, not looking at camera, shallow depth of field, warm neutral color grade with subtle green tones, no visible brand logos, no readable text on packaging, 35mm lens look.
```

---

## 1. Logo e ícone do app (prioridade máxima)

| # | Arquivo | Formato | Prompt |
|---|---|---|---|
| 1.1 | `logo/simbolo-conceito-a.png` | 1:1 · 2048 px | [ESTILO-LOGO] A supermarket shelf price tag shape, tilted -8 degrees, pointing left, solid deep green, with a round punched hole filled in price-tag yellow on the pointed side, and inside the tag a bold white descending line chart arrow going down to the right, symbolizing prices dropping and spending under control. Friendly rounded corners. |
| 1.2 | `logo/simbolo-conceito-b.png` | 1:1 · 2048 px | [ESTILO-LOGO] Monogram combining a price tag silhouette and a bold letter shape "E" formed only by negative space, solid deep green tag, yellow circular hole, minimal and iconic, like a fintech app icon but warmer. |
| 1.3 | `logo/simbolo-conceito-c.png` | 1:1 · 2048 px | [ESTILO-LOGO] A shopping basket whose handle forms a downward check mark, integrated with a small yellow price tag hanging from it, solid deep green, extremely simple, geometric. |
| 1.4 | `app-icon/icon-1024.png` | 1:1 · 1024 px, **sem transparência** | [ESTILO-LOGO] App icon: the chosen symbol (price tag with yellow hole and white descending arrow) centered at 60% of the canvas, on a solid deep green #0E6B47 background, the tag itself in off-white #F7F6F1, arrow in deep green, hole in yellow. Full-bleed square, no rounded corners (the OS applies them), no border. |
| 1.5 | `app-icon/android-foreground.png` | 1:1 · 1024 px, **fundo transparente** | Same symbol as 1.4, only the tag, centered inside the inner 66% safe zone (adaptive icon), transparent background. |
| 1.6 | `app-icon/android-monochrome.png` | 1:1 · 1024 px | Same symbol as 1.5, single flat white silhouette on transparent background (Android 13+ themed icon). |
| 1.7 | `app-icon/android-background.png` | 1:1 · 1024 px | Solid flat deep green #0E6B47, no texture. *(Dispensa IA: é só preencher a cor.)* |

## 2. Splash e abertura

| # | Arquivo | Formato | Prompt |
|---|---|---|---|
| 2.1 | `splash/splash-symbol.png` | 1:1 · 1242 px, transparente | *(Usa o símbolo final em off-white. O fundo `#0E6B47` vem do `app.json` do Expo.)* |

## 3. Onboarding (3 telas, um pilar cada)

| # | Arquivo | Formato | Prompt |
|---|---|---|---|
| 3.1 | `onboarding/controle.png` | 4:5 · 1080×1350 | [ESTILO-ILUSTRA] A woman in her thirties in a supermarket aisle holding a smartphone in one hand and a coffee package in the other, the phone emits a soft green scanning line over the package barcode, a small floating shopping cart icon beside her shows a checkmark, calm and in control. |
| 3.2 | `onboarding/comunidade.png` | 4:5 · 1080×1350 | [ESTILO-ILUSTRA] Three neighbors of different ages in front of small local supermarkets on a street of a Brazilian interior town, each holding a phone, small yellow price tags float between the phones like shared messages, sense of community and helping each other. |
| 3.3 | `onboarding/inteligencia.png` | 4:5 · 1080×1350 | [ESTILO-ILUSTRA] A shopping list on a phone screen that splits into two paths leading to two different small supermarkets on a simple map, with a small green coin stack growing at the end, suggesting the smartest and cheapest route, clean and optimistic. |

## 4. Estados vazios e erros (app)

| # | Arquivo | Formato | Prompt |
|---|---|---|---|
| 4.1 | `empty/carrinho.png` | 1:1 · 800 px, transparente | [ESTILO-ILUSTRA] An empty supermarket shopping cart seen from the side, a phone floating above it with a green scan frame, inviting to start, lots of empty space. |
| 4.2 | `empty/historico.png` | 1:1 · 800 px, transparente | [ESTILO-ILUSTRA] A long paper supermarket receipt gently curling, beside a small simple bar chart with three short green bars, waiting to be filled. |
| 4.3 | `empty/mural.png` | 1:1 · 800 px, transparente | [ESTILO-ILUSTRA] A cork board with empty pins and one single yellow price tag pinned, a hand reaching to pin a second one. |
| 4.4 | `empty/offline.png` | 1:1 · 800 px, transparente | [ESTILO-ILUSTRA] A shopping cart with a small cloud above it that has a gentle pause symbol, calm reassuring mood, nothing broken, everything safe. |
| 4.5 | `empty/nota-lendo.png` | 1:1 · 800 px, transparente | [ESTILO-ILUSTRA] A supermarket receipt with a QR code-like abstract square pattern being read by a phone, small green sparkles, sense of progress. |
| 4.6 | `empty/nota-erro.png` | 1:1 · 800 px, transparente | [ESTILO-ILUSTRA] A supermarket receipt with a small coral clock icon beside it, meaning "we will try again later", friendly not alarming. |
| 4.7 | `empty/busca-vazia.png` | 1:1 · 800 px, transparente | [ESTILO-ILUSTRA] A magnifying glass over an empty supermarket shelf with one lonely product box, playful. |
| 4.8 | `empty/produto-novo.png` | 1:1 · 800 px, transparente | [ESTILO-ILUSTRA] A barcode with a small sparkle and a plus sign, a camera icon beside it, meaning "new product, take a photo". |

## 5. Pedidos de permissão (pré-prompt antes do diálogo do sistema)

| # | Arquivo | Formato | Prompt |
|---|---|---|---|
| 5.1 | `permissao/camera.png` | 1:1 · 800 px, transparente | [ESTILO-ILUSTRA] A friendly phone camera lens looking at a product barcode, green scan frame corners, simple. |
| 5.2 | `permissao/localizacao.png` | 1:1 · 800 px, transparente | [ESTILO-ILUSTRA] A simple town map with three small supermarket buildings and a green location pin, one supermarket marked with a tiny yellow tag. |
| 5.3 | `permissao/notificacoes.png` | 1:1 · 800 px, transparente | [ESTILO-ILUSTRA] A bell with a small yellow price tag attached, a green downward arrow beside it, meaning price-drop alerts. |

## 6. Placeholders de conteúdo

| # | Arquivo | Formato | Prompt |
|---|---|---|---|
| 6.1 | `placeholder/produto.png` | 1:1 · 512 px | [ESTILO-ILUSTRA] Generic neutral grocery product package silhouette (box and bottle), light green #CDEBDA on off-white, no details, used as image placeholder. |
| 6.2 | `placeholder/mercado.png` | 16:9 · 1280×720 | [ESTILO-ILUSTRA] Simple storefront of a small Brazilian neighborhood supermarket, awning in deep green, no signage text, used as placeholder for a market without photo. |
| 6.3 | `placeholder/avatar.png` | 1:1 · 512 px | [ESTILO-ILUSTRA] Neutral friendly person avatar silhouette, light green circle background. |

## 7. Gamificação (Fase 2, dá pra adiantar)

Selos redondos, com a mesma moldura e a mesma paleta para todos. Bloco adicional:
`Circular badge, 1:1, flat vector, thick graphite outline, deep green ring, single central icon, yellow accent star or tag, no text, consistent family style.`

| # | Arquivo | Ícone central (prompt) |
|---|---|---|
| 7.1 | `badges/primeira-compra.png` | a shopping cart with a small check mark |
| 7.2 | `badges/primeiro-preco.png` | a price tag with a small plus sign |
| 7.3 | `badges/cacador-ofertas.png` | a magnifying glass over a yellow price tag |
| 7.4 | `badges/vizinho-confiavel.png` | two hands shaking over a small house |
| 7.5 | `badges/orcamento-em-dia.png` | a wallet with a green check |
| 7.6 | `badges/economia-100.png` | a stack of coins with an upward sparkle |
| 7.7 | `badges/leitor-de-notas.png` | a receipt with a QR-like square pattern |
| 7.8 | `badges/explorador.png` | a map pin over two small store buildings |

## 8. Landing page (web)

| # | Arquivo | Formato | Prompt |
|---|---|---|---|
| 8.1 | `web/hero.jpg` | 16:9 · 2400×1350 | [ESTILO-FOTO] Close-up over the shoulder of a Brazilian woman in her thirties in a neighborhood supermarket aisle, holding a smartphone pointed at a product on the shelf, the phone screen is blank bright off-white (to be replaced with a real app screenshot), shelves softly blurred with colorful products, warm daylight, composition leaves the left 45% of the frame calm and uncluttered for headline text. |
| 8.2 | `web/feature-scan.jpg` | 4:3 · 1600×1200 | [ESTILO-FOTO] Hands holding a smartphone scanning the barcode of a rice package inside a shopping cart, phone screen blank off-white, supermarket background blurred. |
| 8.3 | `web/feature-comunidade.jpg` | 4:3 · 1600×1200 | [ESTILO-FOTO] Two neighbors, a man in his forties and an older woman, chatting at the entrance of a small local supermarket, one showing something on his phone to the other, friendly small-town atmosphere. |
| 8.4 | `web/feature-economia.jpg` | 4:3 · 1600×1200 | [ESTILO-FOTO] A young woman at home at a kitchen table unpacking grocery bags, smiling while looking at her phone, receipt on the table, relaxed evening light. |
| 8.5 | `web/cidade.jpg` | 21:9 · 2520×1080 | [ESTILO-FOTO] Wide shot of a commercial street in a mid-sized town in the interior of Goiás, Brazil, small shops and a supermarket facade, late afternoon golden light, no readable signs. |

> Celulares com tela: use **mockup com screenshot real** do app (Figma/Rotato), e não a tela gerada por IA.

## 9. Lojas (App Store / Play Store)

| # | Arquivo | Formato | Prompt |
|---|---|---|---|
| 9.1 | `stores/fundo-1…5.png` | 1290×2796 (iPhone 6,9") e 1080×1920 (Android) | [ESTILO-ILUSTRA] Abstract background for app store screenshot: off-white #F7F6F1 with one large soft deep green organic shape entering from the bottom corner and a small yellow price-tag shape accent, empty center area for a phone mockup, no objects. *(Gere 5 variações mudando o canto da forma; o título e o print do app entram por cima.)* |
| 9.2 | `stores/play-feature.png` | 1024×500 | [ESTILO-ILUSTRA] Wide banner: a phone scanning a product on the left, a trail of small yellow price tags flowing to the right toward a shopping cart, deep green background, empty space in the center-right for the logo. |

## 10. Redes sociais e compartilhamento

| # | Arquivo | Formato | Prompt |
|---|---|---|---|
| 10.1 | `social/avatar.png` | 1:1 · 1080 px | *(Símbolo final em off-white sobre verde `#0E6B47`, centralizado a 60%.)* |
| 10.2 | `social/capa-instagram-destaques/*.png` | 1:1 · 1080 px | [ESTILO-ILUSTRA] Single simple line icon centered on deep green circle background: (a) barcode, (b) price tag, (c) shopping cart, (d) map pin, (e) question mark. Consistent stroke. |
| 10.3 | `social/og-image.png` | 1200×630 | [ESTILO-ILUSTRA] Deep green background, a large off-white price tag shape on the right with a yellow hole and a white descending arrow, a few small yellow tags scattered, empty left half for the headline added later. |
| 10.4 | `social/capa-linkedin.png` | 1584×396 | [ESTILO-ILUSTRA] Long horizontal row of simplified supermarket shelves in light green line art on off-white, with three yellow price tags standing out, empty left third. |

---

## Checklist depois de gerar

- [ ] Símbolo escolhido e redesenhado em SVG (`docs/brand/logo/`), com o texto do wordmark convertido em curvas
- [ ] O amarelo aparece só como acento em todas as ilustrações
- [ ] Nenhuma imagem com texto, número ou logo de marca real
- [ ] Ilustrações exportadas com fundo transparente (PNG) e comprimidas (WebP/AVIF na web)
- [ ] Ícone do app testado em 29 px (Ajustes do iOS) e no ícone adaptativo do Android (círculo e squircle)
- [ ] Fotos com pessoas: verificar se a ferramenta permite uso comercial
