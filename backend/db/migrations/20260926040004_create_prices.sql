-- migrate:up
-- Bloco 2B: coração da base proprietária — toda observação de preço (scan, NFC-e, site do
-- mercado, WhatsApp, comunidade) cai aqui e fica visível pra cidade inteira. Sem partição
-- ainda (docs/modelagem.md > Decisões em aberto); `city_id` denormalizado prepara pra depois.
CREATE TABLE prices (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id   UUID          NOT NULL REFERENCES products(id),
    market_id    UUID          NOT NULL REFERENCES markets(id),
    city_id      UUID          NOT NULL REFERENCES cities(id),
    amount       NUMERIC(12,2) NOT NULL,
    source       VARCHAR(10)   NOT NULL,
    confidence   NUMERIC(3,2)  NOT NULL,          -- default por fonte fica no service (não é estático)
    reported_by  UUID          REFERENCES users(id),
    client_id    UUID,                             -- idempotência do "modo coletor"/comunidade (POST /prices)
    observed_at  TIMESTAMPTZ   NOT NULL,
    promo_until  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_prices_amount CHECK (amount > 0),
    CONSTRAINT ck_prices_confidence CHECK (confidence BETWEEN 0 AND 1),
    CONSTRAINT ck_prices_source CHECK (source IN ('nfce', 'community', 'flyer', 'manual', 'partner', 'scraper'))
);

-- Lookup principal: "último preço por produto por mercado na cidade" — DISTINCT ON (market_id)
-- filtrando (product_id, city_id), ORDER BY market_id, observed_at DESC, id DESC (desempate).
CREATE INDEX ix_prices_product_id_city_id_market_id_observed_at
    ON prices (product_id, city_id, market_id, observed_at DESC, id DESC);

CREATE INDEX ix_prices_market_id ON prices (market_id);
CREATE INDEX ix_prices_city_id ON prices (city_id);
CREATE INDEX ix_prices_reported_by ON prices (reported_by);

-- Idempotência do POST /prices autenticado: reenviar o mesmo client_id devolve a linha já criada.
CREATE UNIQUE INDEX ux_prices_reported_by_client_id
    ON prices (reported_by, client_id) WHERE client_id IS NOT NULL;

-- migrate:down
DROP TABLE prices;
