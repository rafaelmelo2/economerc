# NFC-e — leitura pelo QR Code (começando por Goiás)

> Pesquisa de set/2026. Os pontos marcados **[validar]** precisam de teste com notas reais de
> mercados de Catalão antes de codar o adaptador.

## Por que a NFC-e é a fonte principal

A nota do consumidor traz **preço real pago**, **data**, **CNPJ do mercado** e a lista de itens.
É o dado de maior confiança da base (`prices.source = 'nfce'`, confiança 0,95) e resolve boa parte do
cold start: cada compra de cada usuário alimenta o catálogo e os preços da cidade.

## O QR Code

Desde a **NT 2025.001** o QR da NFC-e está na **versão 3.00** (obrigatória desde 01/09/2025). Formato
do parâmetro `p`:

| Emissão | Conteúdo de `p` |
|---|---|
| On-line (o caso normal) | `<chave_acesso>\|<versao_qrcode>\|<tp_amb>` → ex.: `5225…6422\|3\|1` |
| Contingência off-line | `<chave>\|3\|<tp_amb>\|<dia_emissao>\|<valor_total>\|<tp_idDest>…\|<assinatura>` **[validar campos exatos]** |

Notas antigas (QR versão 2, com hash do CSC) ainda podem aparecer em cupons guardados — o parser
aceita as duas versões, e a chave é sempre o primeiro campo.

**Chave de acesso (44 dígitos)** — dá para extrair sem consultar nada:

| Posição | Campo | Uso |
|---|---|---|
| 1–2 | cUF (código IBGE da UF) | **52 = GO** → escolhe o adaptador |
| 3–6 | AAMM da emissão | data aproximada |
| 7–20 | **CNPJ do emitente** | identifica o mercado (`markets.cnpj`) |
| 21–22 | modelo | **65 = NFC-e** (55 = NF-e → rejeitar) |
| 23–25 | série | — |
| 26–34 | número da nota | — |
| 35 | tpEmis | 1 = normal, 9 = contingência off-line |
| 36–43 | código numérico | — |
| 44 | dígito verificador (módulo 11) | validar no app antes de enviar |

O app valida a chave (tamanho, modelo 65, DV) e manda só a URL. **Todo o resto é no backend.**

## Portal de consulta de Goiás

| Ambiente | URL |
|---|---|
| Produção | `https://nfeweb.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe?p=...` |
| Homologação | `https://nfewebhomolog.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe?p=...` |

- A URL antiga (`http://nfe.sefaz.go.gov.br/...`) deixou de valer em 30/08/2025 (Informe Técnico
  2025.003). O adaptador **reescreve** host antigo → novo, porque cupons velhos continuam com o QR antigo.
- A página inicial é uma "casca" com os botões *Visualizar NFC-e detalhada*, *Imprimir DANFE* e
  *Nova Consulta*; **os dados da nota carregam depois** (outra requisição/iframe) **[validar: qual
  endpoint devolve o HTML dos itens e se exige cookie de sessão da primeira página]**.
- Existe uma **consulta completa** (`/nfeweb/sites/nfe/consulta-completa`) com emitente, itens,
  pagamentos e tributos. **[validar se exige captcha]**.

### O que se espera extrair (padrão do DANFE NFC-e)

| Dado | Destino |
|---|---|
| Emitente: razão social, CNPJ, endereço | `markets` (cria/atualiza pelo CNPJ) |
| Data/hora de emissão | `receipts.issued_at`, `prices.observed_at` |
| Itens: código no mercado, descrição, quantidade, unidade, valor unitário, valor total | `receipt_items`, `product_aliases` |
| **EAN (cEAN/GTIN)** e **NCM** | normalmente só na consulta completa/XML **[validar]** — são o que liga item → produto e produto → categoria |
| Descontos, total, forma de pagamento | `receipts` |
| CPF do consumidor (se informado) | **descartar** — nunca persistir em claro |

**Risco central:** se o DANFE resumido não trouxer EAN, o casamento item → produto cai para
`product_aliases` (CNPJ + código interno do mercado) e o EAN vem do scan do próprio usuário
(o carrinho escaneado tem o EAN; a nota tem o preço — a conciliação carrinho × nota amarra os dois).

## Arquitetura do adaptador

```
backend/src/api/services/nfce/
  qr.py                 ← parse do QR (v2 e v3), validação da chave, UF, CNPJ, modelo
  adapters/base.py      ← Protocol: fetch(qr_url) -> RawReceipt ; parse(RawReceipt) -> ReceiptDraft
  adapters/go.py        ← Goiás (primeiro)
  registry.py           ← cUF -> adaptador ; UF sem adaptador = status 'failed' + motivo "UF ainda não suportada"
  worker.py             ← consumidor NATS `receipts.ingest`
```

- HTTP com **curl_cffi** (skill `http-client`), timeout curto, retry com backoff pelo JetStream,
  máx. N tentativas → dead-letter + alerta.
- **Rate limit por host** (Valkey) — não martelar o portal da SEFAZ; fila absorve picos.
- Bruto (HTML/XML) salvo em storage **privado** antes do parse → dá para re-parsear tudo quando o
  layout mudar, sem consultar de novo.
- Parser com **testes de fixture** (HTML reais anonimizados em `backend/tests/fixtures/nfce/go/`).
  Mudança de layout = teste quebra = alerta, não dado corrompido.
- Nota duplicada (mesma chave enviada por duas pessoas) conta uma vez para preços.

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| **Captcha** na consulta detalhada | Bloqueia ingestão automática | 1) usar só o DANFE resumido; 2) API paga de consulta (ex.: Infosimples tem SEFAZ/GO/NFC-e) como plano B; 3) em último caso, WebView no app abre a página e o usuário "vê" a nota (o app extrai o HTML localmente) |
| **Mudança de layout** do portal | Parser quebra | Bruto guardado, fixtures, alerta na primeira falha, parser por versão |
| **Bloqueio por volume/IP** | Fila para | Rate limit por host, cache por chave (nunca consultar a mesma nota 2×), backoff |
| **Portal fora do ar** | Atraso | Fila durável; o carrinho do usuário não depende disso |
| **EAN ausente no resumo** | Casamento de produto mais fraco | Aliases por CNPJ + código; conciliação com o carrinho escaneado |
| **LGPD** | CPF do consumidor na nota | Descartar no parse; bruto em storage privado com retenção definida (proposta: 90 dias) e apagado com a conta |
| **Termos de uso** | Consulta automatizada de portal público | Consulta é da nota **do próprio usuário**, iniciada por ele; volume baixo e cacheado. **[validar juridicamente antes de escalar]** |

## Próximos estados

Depois de GO, adaptadores por demanda (MG, SP, DF…) — cada UF tem portal próprio. A tabela de
URLs de consulta por UF está no Portal Nacional da NF-e (`nfe.fazenda.gov.br`).

## Referências

- Informe Técnico 2025.003 (nova URL de GO): goias.gov.br/economia/alteracao-na-url-de-consulta-nfc-e/
- NT 2025.001 (QR Code v3): blog.tecnospeed.com.br/nota-tecnica-2025-001-nfc-e-qr-code/
- Infosimples — API SEFAZ/GO/NFC-e (plano B pago): infosimples.com/consultas/sefaz-go-nfce/
