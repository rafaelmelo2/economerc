-- migrate:up
-- Snapshot do que o app viu no momento do scan (ean/product_name/unit_price/
-- quantity/unit) — não confia em `products`/`prices` (bloco 2B, em paralelo)
-- pra reconstruir o carrinho antigo se o catálogo mudar depois.
CREATE TABLE cart_items (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id         UUID          NOT NULL REFERENCES carts(id),
    -- Espelha `carts.client_id` do pai. O app só conhece client_id (o UUID
    -- server-side do carrinho pode nem existir ainda no mesmo lote de push) —
    -- devolvido no pull pra religar o item ao carrinho certo sem JOIN.
    -- Imutável após a criação (repository nunca inclui no UPDATE).
    cart_client_id  UUID          NOT NULL,
    user_id         UUID          NOT NULL REFERENCES users(id),  -- escopo do upsert idempotente
    client_id       UUID          NOT NULL,
    product_id      UUID,                              -- FK adicionada no merge da onda 2
    ean             VARCHAR(14),
    product_name    VARCHAR(200)  NOT NULL,
    unit_price      NUMERIC(12,2) NOT NULL,
    quantity        NUMERIC(10,3) NOT NULL DEFAULT 1,
    unit            VARCHAR(4)    NOT NULL DEFAULT 'un',
    is_offer        BOOLEAN       NOT NULL DEFAULT false,
    field_versions  JSONB         NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT ck_cart_items_unit_price CHECK (unit_price >= 0),
    CONSTRAINT ck_cart_items_quantity CHECK (quantity > 0),
    CONSTRAINT ck_cart_items_unit CHECK (unit IN ('un', 'kg', 'g', 'l', 'ml'))
);

-- UNIQUE absoluto — mesmo motivo de `carts` (ver 20260926050001).
CREATE UNIQUE INDEX ux_cart_items_user_id_client_id ON cart_items (user_id, client_id);

CREATE INDEX ix_cart_items_cart_id ON cart_items (cart_id);
CREATE INDEX ix_cart_items_product_id ON cart_items (product_id);

-- migrate:down
DROP TABLE cart_items;
