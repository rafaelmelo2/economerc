# Identidade visual

> Os valores moram em [`packages/design-tokens/tokens.json`](../../packages/design-tokens/tokens.json). Este documento explica **quando usar** cada coisa. Mudou cor, fonte ou espaçamento? Edite o JSON e rode `bun run build`. Nunca escreva hex solto em componente.

## Logo

| Arquivo | Uso |
|---|---|
| `logo/simbolo.svg` | Ícone do app, favicon, avatar de rede social, marca d'água |
| `logo/horizontal.svg` | Header da web, splash, materiais |

> ⚠️ Os SVGs atuais são **rascunho** para validar o conceito. A versão final sai dos prompts em [`prompts-imagens.md`](prompts-imagens.md) e é redesenhada em vetor.

**Regras**
- **Área de respiro:** o diâmetro do furo da etiqueta × 2, em volta de tudo.
- **Tamanho mínimo:** símbolo com 24 px; horizontal com 120 px de largura.
- **Fundos permitidos:** off-white, branco, verde-900 (versão com a etiqueta em verde-400) e foto escurecida pelo menos 50%.
- **Nunca:** girar além dos −8° originais, trocar o amarelo do furo, aplicar sombra ou gradiente, esticar, nem pôr sobre o amarelo da etiqueta.
- **Wordmark:** "Econo" em peso 500 e "Merc" em 800 verde. Sempre "EconoMerc" (E e M maiúsculos, sem espaço).

## Cores

| Papel | Claro | Escuro | Quando usar |
|---|---|---|---|
| `primary` (verde-economia) | `#0E6B47` | `#3DBB82` | Botão principal, botão de scan, economia, links |
| `accent` (amarelo-etiqueta) | `#FFC83D` | `#FFC83D` | **Só oferta/promoção** e o furo do logo. Texto sobre ele é sempre `accent-foreground` (grafite). |
| `background` | `#F7F6F1` | `#0F1511` | Fundo das telas: off-white quente, nunca branco puro |
| `surface` | `#FFFFFF` | `#172019` | Cards, sheets, itens do carrinho |
| `foreground` / `-muted` | `#10231A` / `#5B6159` | `#E9EEE9` / `#9AA59C` | Texto principal / secundário |
| `danger` (coral) | `#C7372F` | `#F07A6E` | Orçamento estourado, excluir |
| `warning` | `#8A5A00` | `#FFC83D` | Orçamento em 80%, preço desatualizado (>15 dias) |
| `info` | `#2F6FDB` | `#7FA6F0` | Dica, informação neutra |

**Regras de cor**
- **O amarelo é um sinal, não uma decoração.** Se tudo for amarelo, nada é oferta. No máximo 1 elemento amarelo por tela, fora do mural de ofertas.
- **Verde é "a seu favor"** (economia, abaixo do orçamento). **Coral é "atenção ao dinheiro"**. Os dois sempre vêm com ícone e texto, nunca só com a cor.
- **Contraste verificado (WCAG AA):** primary em branco 6,5:1 · texto em off-white 15:1 · grafite no amarelo 10,6:1 · primary escuro no fundo escuro 7,6:1.
- **Modo escuro é desenhado, não invertido.** Os valores próprios estão no `tokens.json`.

## Gráficos

- **Gasto por categoria:** barras horizontais em **uma cor só** (`primary`), com o nome da categoria no eixo. Não precisa de cor por categoria.
- **Evolução mensal:** barras verticais ou linha em `primary`. O mês atual é destacado e os demais ficam em `primary` com 40% de opacidade.
- **Empilhado por categoria:** paleta categórica de 6 cores (`--chart-1…6`), nesta ordem, e **o resto vira "Outros"** (`--chart-other`). A cor segue a categoria, nunca a posição no ranking. A paleta foi validada para daltonismo e contraste nos dois modos.
- Números do gráfico ficam em cor de texto, nunca na cor da série. Os gráficos têm legenda e uma visão em tabela.

## Tipografia

| Família | Uso |
|---|---|
| **Bricolage Grotesque** (800/700) | Títulos, total do carrinho (`price-hero`), números de destaque. Tem personalidade, com um toque de letreiro de mercado. |
| **Inter** (400–600) | Todo o resto da interface. Nos preços, **sempre `tabular-nums`**, para os valores não pularem enquanto o total muda. |

Escala (mobile, px): `price-hero 44` · `display 34` · `title-1 28` · `title-2 22` · `title-3 18` · `body 16` · `callout 15` · `price 17` · `footnote 13` · `caption 12`. Nada de texto de interface abaixo de 12 px. Campo de formulário tem no mínimo 16 px (evita o zoom do iOS). As duas fontes estão no Google Fonts e no `@expo-google-fonts`.

## Forma, espaço e movimento

- **Grade de 4 pt.** Espaçamentos: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- **Raios:** 8 (chips, inputs), 12 (botões, itens), 16 (cards), 24 (sheets) e pill (badges e o botão de scan).
- **Toque:** mínimo de 44×44 pt. O **botão de scan tem 72 pt**, é redondo, verde e fica sempre no mesmo lugar (centro da tab bar).
- **Sombra:** 3 níveis, suaves e esverdeadas, nunca preto puro. No modo escuro, a elevação vira superfície mais clara, não sombra.
- **Movimento:** 150/220/320 ms, com spring nos gestos. Cada animação tem motivo. O total do carrinho **conta** até o novo valor (ticker de 220 ms) e o item escaneado entra de baixo. Ao escanear, uma vibração curta (haptic) confirma. Respeite o "reduzir movimento" do sistema.

## Ícones

**Lucide** (`lucide-react-native` no app, `lucide-react` / `react-icons/lu` na web), com traço 2 px e tamanhos 16/24/32. Um estilo só, outline. O preenchido fica reservado para o estado ativo da tab bar.

Ícones de categoria (Lucide): Hortifruti `Carrot` · Laticínios `Milk` · Mercearia `Wheat` · Bebidas `CupSoda` · Carnes `Beef` · Padaria `Croissant` · Congelados `Snowflake` · Limpeza `SprayCan` · Higiene `Bath` · Outros `Package`.

## Imagem e ilustração

- **Foto:** mercado brasileiro real, com luz natural, gôndolas de bairro e mãos segurando o celular e o produto. Pessoas diversas e reais. **Nada** de banco de imagem americano, de modelo sorrindo pra câmera nem de carrinho gigante vazio.
- **Ilustração** (vazios, onboarding, conquistas): traço chapado, formas arredondadas, paleta da marca com o amarelo só como acento e objetos de mercado (etiqueta, sacola, nota). Sem gradiente e sem 3D.
- Prompts prontos: [`prompts-imagens.md`](prompts-imagens.md).
