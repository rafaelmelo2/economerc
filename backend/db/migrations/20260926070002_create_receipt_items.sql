-- migrate:up
-- Bloco 4A: itens da NFC-e, um por linha da nota. `product_id` é OPCIONAL — casa por EAN
-- quando a nota traz GTIN, senão fica para o alias (market_id + market_code) resolver depois.
CREATE TABLE receipt_items (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id   UUID          NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    line_number  SMALLINT      NOT NULL,
    market_code  VARCHAR(60),
    ean          VARCHAR(14),
    raw_name     VARCHAR(200)  NOT NULL,
    ncm          CHAR(8),
    quantity     NUMERIC(10,3) NOT NULL,
    unit         VARCHAR(6),
    unit_price   NUMERIC(12,2) NOT NULL,
    total_price  NUMERIC(12,2) NOT NULL,
    product_id   UUID          REFERENCES products(id),
    CONSTRAINT uq_receipt_items_receipt_id_line_number UNIQUE (receipt_id, line_number),
    CONSTRAINT ck_receipt_items_quantity CHECK (quantity > 0),
    CONSTRAINT ck_receipt_items_unit_price CHECK (unit_price >= 0),
    CONSTRAINT ck_receipt_items_total_price CHECK (total_price >= 0)
);

-- receipt_id já é leftmost do índice único acima — sem índice dedicado (evita write amplification).
CREATE INDEX ix_receipt_items_product_id ON receipt_items (product_id) WHERE product_id IS NOT NULL;

-- migrate:down
DROP TABLE receipt_items;
