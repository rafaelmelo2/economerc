# Fontes de dados de preço: cold start em Catalão

> Pesquisa de 26/09/2026, feita com acesso real aos sites. A ideia central do produto: **uma base única de preços por mercado, aberta a todos os usuários.** Cada fonte abaixo alimenta a mesma tabela `prices` (produto × mercado × valor × data × fonte × confiança). Veja `modelagem.md`.

## Resumo

| Fonte | Mercado(s) | Como | Dificuldade | Confiança | Estrutura |
|---|---|---|---|---|---|
| **Loja online (Mercafacil)** | Supermercado Catalão | HTML renderizado no servidor. Nome, preço, preço cheio e % de desconto já vêm na página. | 🟢 Fácil | alta (preço de vitrine) | nome + preço, **sem EAN** |
| **Loja online (Instabuy/ibecom)** | Pontal Atacado e Varejo | Catálogo completo, mas os itens vêm de uma API atrás do Cloudflare. Com curl_cffi a página passa; a API responde 403. O navegador automatizado padrão é bloqueado. | 🟡 Média | alta | a confirmar (provável EAN no item) |
| **Tabloide em PDF/JPG** | Rio Vermelho Atacadista | `carregaTabloides.php?pegaUnidade=CATALAO` lista PDFs e imagens. **O último tabloide no site é antigo (07/03 a 12/03)**: o site está abandonado, e as ofertas vivas estão no Instagram e no WhatsApp. | 🟢 Fácil de baixar, 🟡 extrair exige IA de visão | média | imagem → Gemini extrai nome/preço/validade |
| **WhatsApp** (grupos e listas de transmissão) | Rio Vermelho, Pontal e a maioria dos mercados locais | Um número dedicado entra nos grupos/listas; mensagens (texto e imagem de encarte) chegam por webhook | 🟡 Média (risco de banimento) | média | texto/imagem → IA |
| **Scan de campo** (equipe na loja) | Todos | App em "modo coletor": escaneia o código de barras e digita/fotografa o preço da gôndola | 🟢 Técnico fácil, 🔴 braçal | alta | **EAN + preço** (a melhor combinação) |
| **NFC-e do usuário** | Todos | QR da nota → portal SEFAZ-GO (ver `nfce-sefaz-go.md`) | 🟡 Média | muito alta (preço pago) | itens + preço (+ EAN a validar) |
| **Comunidade** | Todos | Usuário informa preço com foto (Fase 2) | 🟢 | variável (reputação) | EAN + preço |

## Detalhes por fonte

### Supermercado Catalão: `supercatalaoonline.com.br/loja` (Mercafacil)
- A página da loja já traz cerca de 50 produtos com link `/loja/produto/m/<slug>-<id>` (ex.: `acem-bovino-pecapedaco-KG-5944`).
- O preço aparece no HTML, com promoção: `SABONETE LUX ROSAS FRANCESAS 85G R$ 2,29 -30% R$ 3,28`.
- **Sem EAN** na página. O casamento com o produto vai por `product_aliases` (mercado + id interno + nome normalizado) e é confirmado quando alguém escaneia o mesmo item ou lê uma nota desse mercado.
- Plano: crawler diário por departamento com curl_cffi, respeitando rate limit.

### Pontal Atacado e Varejo: `pontalatacado.com.br` (plataforma Instabuy/ibecom)
- Loja Next.js; subdomínio da plataforma `pontalatacadoevarejo`, store id `68f124a834234d99622a5ae4`.
- Endpoints mapeados no JS: `/api_ecommerce/v5/items`, `/search`, `/offers`, `/offers/categories/{id}`, `/mercadological/departments`.
- Chamados direto, respondem **403** (Cloudflare mais token de sessão da loja). Próximo passo: abrir a loja num **Chrome real** (Claude no Chrome) e capturar os headers/token que o front usa; ou usar Playwright com navegador não-headless.
- Promoções também saem pelo WhatsApp e pelo Instagram `@pontalvarejo`.

### Rio Vermelho Atacadista: `riovermelhoatacadista.com.br`
- Tabloides em `admin/images/<hash>.pdf|.jpg`, listados por `carregaTabloides.php?pegaUnidade=CATALAO`.
- **O conteúdo do site está desatualizado.** Ofertas vivas: Instagram `@riovermelhoatacadistacatalao` e lista de transmissão no WhatsApp `+55 62 99627-9188`.

## WhatsApp: como ler grupos e listas de ofertas

**A API oficial (Cloud API) não serve**: ela não lê grupos em que você é só participante. O caminho é o **WhatsApp Web não-oficial**, via **Evolution API** (já roda na VPS, ao lado do Ponto do Lanche e do duocash) ou Baileys direto.

```
Chip dedicado "EconoMerc Ofertas"  →  entra nos grupos/listas dos mercados
        │  (Evolution API, sessão WhatsApp Web)
        ▼  webhook: messages.upsert
backend  POST /webhooks/whatsapp  →  NATS  offers.ingest
        ▼
worker:  texto → regex de preço + LLM   |   imagem de encarte → Gemini visão via OpenRouter (JSON: produto, preço, unidade, validade)
        ▼
prices (source = 'flyer', confidence 0,8)  +  promotions (validade)  →  revisão no painel admin antes de publicar (no começo)
```

- **Grupo × lista de transmissão:** a lista chega como mensagem privada. É o mesmo webhook, mas o número precisa estar salvo nos contatos do mercado.
- **Mapear remetente → mercado:** tabela `market_sources` (mercado, tipo `whatsapp_group|whatsapp_broadcast|site|instagram`, identificador).
- **Riscos:**
  - O WhatsApp pode **banir o número**, porque a integração é não-oficial. Mitigar com chip dedicado, só leitura (nunca enviar em massa), aquecer o número antes e deixar outro chip reserva.
  - Os termos de uso do WhatsApp proíbem automação não-oficial, então isso é risco de conta, não de lei.
  - Pedir aos mercados parceiros que **adicionem o número** (vira parceria e reduz o risco).
- **Instagram** (encartes postados): fica pra depois. O scraping é frágil; o melhor é parceria ou colar o link manualmente no painel admin.

## Ordem sugerida para o cold start

1. **Scan de campo + NFC-e** (Fase 1 do produto): o app já faz isso. A equipe vai aos mercados com o "modo coletor". É o único dado com **EAN + preço + mercado** garantidos, e é ele que ancora o casamento das outras fontes.
2. **Crawler do Supermercado Catalão** (fácil, catálogo inteiro diário).
3. **WhatsApp via Evolution** (Rio Vermelho, Pontal e os demais): maior cobertura de ofertas da semana.
4. **Pontal via API** (depois de capturar a sessão num navegador real).
5. Tabloide do site do Rio Vermelho: só se voltarem a atualizar.

## Pendências
- [ ] Capturar a chamada `/api_ecommerce/v5/items` do Pontal num Chrome real (Claude no Chrome).
- [ ] Levantar a lista de mercados de Catalão com grupo/lista de WhatsApp e Instagram de ofertas.
- [ ] Chip dedicado para o coletor de WhatsApp.
- [ ] 10 a 20 NFC-e reais de Catalão (fixtures do parser; ver `nfce-sefaz-go.md`).
