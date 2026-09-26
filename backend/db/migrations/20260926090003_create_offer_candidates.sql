-- migrate:up
-- Bloco 4C: fila de revisão. Nada vindo de WhatsApp/tabloide vira `prices` direto — cai aqui como
-- `pending` até um admin aprovar (docs/fontes-de-dados.md > WhatsApp). O crawler do site (fonte
-- estruturada, sem ambiguidade) NÃO passa por aqui — grava `prices` direto (`services/collectors`).
CREATE TABLE offer_candidates (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id        UUID          NOT NULL REFERENCES markets(id),
    market_source_id UUID          NOT NULL REFERENCES market_sources(id),
    product_name     VARCHAR(200)  NOT NULL,        -- melhor palpite do texto/IA
    ean              VARCHAR(14),                    -- quando a IA/regex consegue ler um código
    price_amount     NUMERIC(12,2) NOT NULL CHECK (price_amount > 0),
    unit             VARCHAR(40),                     -- 'kg', 'un', 'leve 3 pague 2', texto livre curto
    valid_until      TIMESTAMPTZ,
    raw_text         TEXT,                            -- mensagem/legenda original (auditoria)
    raw_payload      JSONB         NOT NULL DEFAULT '{}',
    source           VARCHAR(20)   NOT NULL,
    status           VARCHAR(10)   NOT NULL DEFAULT 'pending',
    reviewed_by      UUID          REFERENCES users(id),
    reviewed_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_offer_candidates_source
        CHECK (source IN ('whatsapp_group', 'whatsapp_broadcast', 'flyer_pdf', 'instagram')),
    CONSTRAINT ck_offer_candidates_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX ix_offer_candidates_market_id ON offer_candidates (market_id);
CREATE INDEX ix_offer_candidates_market_source_id ON offer_candidates (market_source_id);
CREATE INDEX ix_offer_candidates_reviewed_by ON offer_candidates (reviewed_by);
-- Fila do admin: "pendentes mais recentes primeiro" — desempate por id.
CREATE INDEX ix_offer_candidates_status_created_at_id
    ON offer_candidates (status, created_at DESC, id DESC);

-- migrate:down
DROP TABLE offer_candidates;
