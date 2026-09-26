# Notas da investigação real — portal SEFAZ-GO (set/2026)

Feito com requisições reais (`curl`/`curl_cffi`) ao `nfeweb.sefaz.go.gov.br` usando uma chave
de acesso fictícia (formato válido — 44 dígitos, modelo 65, DV módulo 11 correto — mas
inexistente na base da SEFAZ). Sem nota real disponível ainda; isto documenta o que dá para
confirmar sem uma chave verdadeira, e o que continua **[validar com nota real]**.

## 1. `GET /nfeweb/sites/nfce/danfeNFCe?p=...` — a consulta que o QR aponta

- Responde **200 OK** numa única requisição, **sem captcha**, mesmo para chave inexistente.
- A resposta é uma "casca" Bootstrap/jQuery que injeta `new ShowDanfeNFCe('#danfe-nfce-container',
  '/nfeweb/imagens/', null, null, null)` no `<head>`. Para a chave fictícia, os 3 últimos
  argumentos vieram `null` e a página trouxe direto uma mensagem de erro server-side:
  `_message = {'ERROR': ['Não foi possível encontrar o XML da nota']}` — ou seja, **a
  resolução da chave é síncrona, na mesma requisição**, não precisa de segunda chamada
  para descobrir que a chave não existe.
- **[validar com nota real]**: não deu para confirmar se, para uma chave que EXISTE, o
  conteúdo (tabela de itens) vem embutido no mesmo HTML (via `DanfeNFCe(container_id,
  images_dir, danfe_html)` — o construtor recebe o HTML pronto como 3º argumento, o que
  sugere SSR/inline, não AJAX) ou se `ShowDanfeNFCe` dispara uma 2ª requisição
  (`danfe_render_url`) quando os 3 últimos argumentos não são `null`. O código-fonte de
  `danfeNFCe.js` (`DanfeNFCe.prototype.load` → `set_danfe_html_to_container_div`) e de
  `showDanfeNFCe.js` (`load_ajax` só é chamado no clique de "Imprimir", não no load inicial)
  aponta para **conteúdo inline no HTML de resposta** — favorável: um único `fetch` deve
  bastar, sem iframe. **Escreva um teste com nota real assim que houver uma para confirmar.**
- **Nenhum endpoint de captcha na consulta resumida.** Isso valida o Plano A do risco
  "Captcha" da doc (`docs/nfce-sefaz-go.md`): usar só o DANFE resumido.

## 2. `GET /nfeweb/sites/nfe/consulta-completa` — a que traria EAN/NCM com certeza

- **Exige Cloudflare Turnstile** (`<script src="https://challenges.cloudflare.com/turnstile/
  v0/api.js">` + `data-sitekey="0x4AAAAAABWl9df-N8s5C_f1"` + campo oculto
  `g-recaptcha-response`) antes mesmo de submeter a chave de acesso.
- **Não usar este endpoint em automação** — confirma o risco já mapeado na doc. Fica como
  plano B manual/API paga (Infosimples) se o resumido não trouxer EAN suficiente.
- Consequência direta: **[validar com nota real] se EAN/NCM aparecem no DANFE resumido.**
  Se não aparecerem (bem provável — a maioria dos DANFEs resumidos de outras UFs omite
  GTIN/NCM), o casamento item→produto cai para `product_aliases` (CNPJ + código interno),
  exatamente como a doc já previa como plano de contingência.

## 3. WAF na frente dos assets estáticos (achado não documentado antes)

- Requisição direta a `/nfeweb/static/js/...` **sem** os cookies da página inicial e **sem**
  `Referer` apontando pra ela é bloqueada por um WAF com página "Acesso Negado" (política de
  segurança, e-mail de contato `atendimento.sti@goias.gov.br`, código de bloqueio na resposta).
  Com o cookie de sessão (`JSESSIONID`, `TS...`) da requisição inicial + `Referer` da própria
  página, o asset carrega normalmente (200).
- **Não afeta o adaptador**: só precisamos do HTML da página de consulta (uma requisição),
  nunca dos assets estáticos (JS/CSS) — o parser lê o HTML puro. Mas é um sinal de que o
  portal tem WAF ativo por padrão de tráfego/anomalias; manter rate limit conservador
  (`RATE_LIMIT_MAX_REQUESTS`/`RATE_LIMIT_WINDOW_SECONDS` em `go.py`) e um `impersonate="chrome"`
  de TLS fingerprint (curl_cffi) — requisição "crua" sem fingerprint de navegador é candidata
  a bloqueio mais cedo.

## 4. Host antigo (`http://nfe.sefaz.go.gov.br`) ainda responde

- Ao contrário do que a NT 2025.003 sugere ("deixou de valer em 30/08/2025"), o host antigo
  **ainda respondeu 200 OK** no teste (set/2026), servindo a mesma casca. Pode ser
  descomissionado a qualquer momento — o adaptador **reescreve o host de qualquer forma**
  (`qr.rewrite_old_go_host`), então isso é só uma nota de que não há redirect HTTP automático
  observado; se o host cair amanhã, o rewrite já cobre.

## 5. O que ficou sem confirmar (depende das notas reais do dono do projeto)

- Estrutura exata do HTML quando a chave **existe** (nomes de classe/id reais da tabela de
  itens, se tem `cEAN`/`NCM`, se quantidade/unidade vêm formatadas como esperado).
- Se o `tpAmb` de homologação (`nfewebhomolog.sefaz.go.gov.br`) tem o mesmo comportamento.
- Se há algum rate limit/bloqueio explícito por volume (não testado — só uma requisição feita).

**Enquanto isso, o parser (`go.py > parse_danfe_html`) implementa o layout padrão descrito em
`docs/nfce-sefaz-go.md`** (tabela `table.itens` com colunas Código/Descrição/Qtde/UN/Vl. Unit/
Vl. Total, bloco `.cnpj`/`.nome`/`.endereco` do emitente, `.valor-total`/`.valor-desconto`,
`.emissao`), testado contra fixtures sintéticas (`tests/fixtures/nfce/go/synthetic_*.html`,
claramente marcadas). Quando as notas reais chegarem: (1) salvar o HTML anonimizado como nova
fixture `real_*.html`, (2) ajustar os seletores em `go.py` para o layout de verdade, (3) o
teste de fixture aponta exatamente o que quebrou — o bruto já fica salvo no banco
(`receipts.raw_html`), então dá pra reprocessar sem consultar a SEFAZ de novo.
