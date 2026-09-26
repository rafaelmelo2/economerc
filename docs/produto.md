# Produto — EconoMerc

> Fonte: `docs/origem/EconoMerc_Escopo.docx` e `EconoMerc_Roadmap.pptx` (Mateus Bonfim de Souza,
> set/2026) + `Oficina de Ideias Google Cloud Summit Brasil 2026.pdf` (conceito "Servicat").
> Este arquivo é o resumo operacional; em caso de dúvida de negócio, o escopo original manda.

## Visão

Reduzir o esforço e o custo da compra de mercado: o consumidor vê **quanto está gastando enquanto
compra**, encontra as **promoções da região** num só lugar e, no fim, recebe da **IA a lista mais
barata** considerando vários mercados. Ao mesmo tempo, o app constrói uma base proprietária de
preços e consumo com valor comercial.

**Foco de entrada:** cidades pequenas e médias (começa em **Catalão-GO**), onde agregadores
nacionais não chegam e os mercados são independentes — a comunidade é quem alimenta os preços.

## Problema

1. Sem visibilidade do total durante a compra → estouro de orçamento no caixa.
2. Promoções espalhadas em encartes, apps e redes sociais de dezenas de mercados.
3. Nenhuma ferramenta monta a lista mais barata cruzando vários mercados e promoções.

## Proposta de valor

| Para quem | Valor |
|---|---|
| Consumidor | Economia mensurável, orçamento em tempo real, menos tempo comparando |
| Mercado/varejo | Canal de divulgação de promoções, dados agregados de consumo |
| Negócio | Base proprietária de preços/consumo, monetizável |

## Personas

| Persona | Perfil | Necessidade principal | Fase que atende |
|---|---|---|---|
| **Ana**, a Controladora de Orçamento | 32, mãe de dois, compra mensal | Ver o total somado em tempo real enquanto escaneia | 1 |
| **Carlos**, o Caçador de Promoções | 45, visita vários mercados por semana | Lista consolidada de promoções da região | 2 |
| **Júlia**, a Otimizadora Digital | 27, usuária avançada de apps | IA que monta a lista mais barata sozinha | 3 |

## Canais

- **App (Expo, iOS + Android)** — o produto. Tudo acontece aqui.
- **Web (resumo)** — landing, histórico/gráficos (leitura), mural de promoções (leitura), painel admin.

## Fases

### Fase 1 — MVP: Controle de Compras (meses 1–4)
- Cadastro: **Google + Apple** (decisão: sem e-mail/senha e sem SMS por enquanto); cidade; tamanho
  da família, orçamento mensal, categorias de interesse.
- Scan: EAN-13/UPC-A pela câmera · OCR de etiqueta de gôndola (IA) quando o EAN não traz preço ·
  QR da NFC-e no fim da compra (preço real) · cadastro manual como último recurso.
- Carrinho: soma automática, alerta configurável perto do limite, edição de quantidade/preço.
  **Funciona offline.**
- Categorização automática (Laticínios, Hortifruti, Mercearia, Bebidas, Limpeza, Higiene, Carnes,
  Padaria, Congelados…) por NCM/regra, IA como fallback.
- Histórico por data e mercado, gráfico mensal e por categoria, preço por unidade (R$/kg, R$/L).

### Fase 2 — Comunidade e Promoções (meses 5–8)
- Mural de promoções semanais da região, filtros por categoria/distância/validade.
- Crowdsourcing: reportar preço com foto; reputação e gamificação (pontos, níveis, emblemas);
  filtro estatístico de outliers; alertas de queda de preço e oferta relâmpago.
- Mercados favoritos, geolocalização, rota entre mercados. Cupons/cashback (complementar).

### Fase 3 — Inteligência Artificial (meses 9–14)
- Lista inteligente: onde comprar cada item para minimizar o custo total (inclusive dividindo
  entre mercados), substitutos mais baratos.
- Previsão de preço, melhor momento de compra, alerta de reabastecimento.
- Relatório de economia: com o app vs. sem o app.

## Fora de escopo (nesta versão)

Checkout/pagamento no app · delivery · integração com o PDV dos mercados (só via NFC-e) ·
fora do Brasil · farmácia, combustível e outras categorias.

## Requisitos não funcionais

| Categoria | Requisito |
|---|---|
| Desempenho | Scan/OCR responde em ≤ 2s em rede normal |
| Escala | Dados particionáveis por cidade/região |
| Disponibilidade | SLA 99,5% no backend |
| Privacidade | LGPD; anonimização dos dados agregados |
| Usabilidade | Scan + soma sem precisar de tutorial |
| Dados | Preço > 15 dias sem confirmação = sinalizado como desatualizado |
| Plataforma | iOS e Android; câmera obrigatória. **Offline no carrinho** (decisão). |

## Métricas (12 meses pós-lançamento)

| Indicador | Meta |
|---|---|
| MAU | 50.000+ |
| Economia média reportada / usuário / mês | R$ 80–150 |
| Preços/notas contribuídos | 1 milhão+ |
| Cidades com cobertura de promoções | 10+ (3 ao fim da Fase 2) |
| Retenção M1 | ≥ 35% |
| Redução de custo pela IA vs. 1 mercado | ≥ 10% |

## Monetização

Freemium (IA e histórico ilimitado no pago) · destaque pago de promoções para mercados ·
afiliados de cupons/cashback · dados agregados e anonimizados para indústria e varejo.
(Conceito "Servicat": relatórios de pricing analytics para supermercados independentes.)

## Riscos

| Risco | Mitigação |
|---|---|
| Cold start de dados | Parcerias com mercados locais, scraping de encartes públicos, NFC-e como fonte primária |
| Qualidade dos dados | Outliers estatísticos, sinalização de preço antigo, reputação |
| Correspondência de produtos | EAN como identificador; `product_aliases` por mercado |
| Concorrência (PoupApp, ComparaSuper, ClickSuper) | IA prescritiva + foco hiperlocal em cidades pequenas |
| LGPD / dados fiscais | CPF nunca em claro, agregação anonimizada, política clara |
