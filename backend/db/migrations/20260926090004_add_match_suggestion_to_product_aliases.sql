-- migrate:up
-- Bloco 4C: o crawler do Supermercado Catalão não tem EAN (docs/fontes-de-dados.md) — todo alias
-- novo roda RapidFuzz contra `products.name` e grava a MELHOR sugestão aqui, mesmo quando o score
-- fica abaixo do limiar de auto-link (`product_id` permanece NULL até um admin confirmar).
ALTER TABLE product_aliases
    ADD COLUMN suggested_product_id UUID REFERENCES products(id),
    ADD COLUMN suggested_match_score NUMERIC(5,2);

CREATE INDEX ix_product_aliases_suggested_product_id ON product_aliases (suggested_product_id);

-- migrate:down
ALTER TABLE product_aliases
    DROP COLUMN suggested_product_id,
    DROP COLUMN suggested_match_score;
