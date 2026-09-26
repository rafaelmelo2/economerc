-- migrate:up
-- Bloco 2B: catálogo. EAN/GTIN normalizado (13 ou 14 dígitos, skill `services/catalog/gtin.py`)
-- é a chave natural — granel sem código (hortifruti) fica com `ean IS NULL`.
CREATE TABLE products (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    ean             VARCHAR(14),
    name            VARCHAR(200)  NOT NULL,
    brand           VARCHAR(120),
    category_id     UUID          REFERENCES categories(id),
    unit            VARCHAR(4)    NOT NULL DEFAULT 'un',
    net_quantity    NUMERIC(10,3),                -- quantidade NA unidade de `unit` (500 g, 1 l, 6 un)
    image_upload_id UUID,                          -- FK futura p/ `user_uploads` (skill `uploads-storage`)
    source          VARCHAR(10)   NOT NULL DEFAULT 'manual',
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT ck_products_unit CHECK (unit IN ('un', 'kg', 'g', 'l', 'ml')),
    CONSTRAINT ck_products_source CHECK (source IN ('off', 'nfce', 'user', 'scraper', 'manual'))
);

-- Nome exato do índice ("products_ean_uq") é contrato com `api/core/exceptions.py`
-- (UNIQUE_CONSTRAINT_MESSAGES), já cadastrado no bloco 1A.
CREATE UNIQUE INDEX products_ean_uq ON products (ean) WHERE deleted_at IS NULL AND ean IS NOT NULL;
CREATE INDEX ix_products_category_id ON products (category_id);
CREATE INDEX ix_products_name ON products (name);

-- migrate:down
DROP TABLE products;
