-- migrate:up
-- Bloco 4C (docs/fontes-de-dados.md): de onde vem o preço de cada mercado — site próprio
-- (Mercafacil), grupo/lista de WhatsApp, Instagram ou tabloide em PDF. Um mercado pode ter
-- várias fontes ativas ao mesmo tempo (ex.: site + WhatsApp).
CREATE TABLE market_sources (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id       UUID          NOT NULL REFERENCES markets(id),
    kind            VARCHAR(20)   NOT NULL,
    identifier      VARCHAR(200)  NOT NULL,   -- URL do site | JID do grupo/lista | handle do Instagram
    is_active       BOOLEAN       NOT NULL DEFAULT true,
    last_success_at TIMESTAMPTZ,
    last_error_at   TIMESTAMPTZ,
    last_error      VARCHAR(500),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_market_sources_kind
        CHECK (kind IN ('site', 'whatsapp_group', 'whatsapp_broadcast', 'instagram', 'flyer_pdf')),
    CONSTRAINT uq_market_sources_market_id_kind_identifier UNIQUE (market_id, kind, identifier)
);

-- market_id já é leftmost do índice único acima — sem índice dedicado (evita write amplification).
-- Lookup do webhook do WhatsApp é por (kind, identifier) — remoteJid do grupo/contato chega
-- direto no payload, sem passar por market_id primeiro.
CREATE INDEX ix_market_sources_kind_identifier ON market_sources (kind, identifier)
    WHERE is_active;

-- Seed: site do Supermercado Catalão (loja Mercafacil, docs/fontes-de-dados.md). WhatsApp/Instagram
-- de Rio Vermelho e Pontal ficam pendentes de identificador real (chip dedicado, onda 4).
INSERT INTO market_sources (market_id, kind, identifier, is_active)
SELECT m.id, 'site', 'https://www.supercatalaoonline.com.br/loja', true
  FROM markets m
 WHERE m.trade_name = 'Supermercado Catalão';

-- migrate:down
DROP TABLE market_sources;
