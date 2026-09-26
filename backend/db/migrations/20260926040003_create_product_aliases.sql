-- migrate:up
-- Bloco 2B: como cada mercado chama o item na NFC-e/site — a ponte entre nota/crawler e o
-- produto canônico. `product_id` é OPCIONAL: o crawler do Supermercado Catalão (sem EAN na
-- página, docs/fontes-de-dados.md) cria o alias antes de qualquer casamento; a ligação some
-- confirmada quando alguém escaneia o mesmo item ou lê uma nota desse mercado.
CREATE TABLE product_aliases (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID          REFERENCES products(id),
    market_id   UUID          NOT NULL REFERENCES markets(id),
    market_code VARCHAR(60),                       -- código interno do item no mercado (cProd da NFC-e)
    raw_name    VARCHAR(200)  NOT NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_product_aliases_market_id_market_code UNIQUE (market_id, market_code)
);

-- market_id já é leftmost do índice único acima — sem índice dedicado (evita write amplification).
CREATE INDEX ix_product_aliases_product_id ON product_aliases (product_id);

-- migrate:down
DROP TABLE product_aliases;
