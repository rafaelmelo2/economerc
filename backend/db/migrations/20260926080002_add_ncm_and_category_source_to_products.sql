-- migrate:up
-- Bloco 4B: categorização (docs/roadmap-fase1.md > Etapa 8). `ncm` alimenta a regra
-- (a) NCM → categoria (category_repository.find_by_ncm); `category_source` registra
-- qual camada decidiu — correção manual (`user`) sempre vence e nunca é sobrescrita
-- pelo job em lote (que só processa produtos com `category_id IS NULL`).
ALTER TABLE products
    ADD COLUMN ncm CHAR(8),
    ADD COLUMN category_source VARCHAR(10),
    ADD CONSTRAINT ck_products_category_source
        CHECK (category_source IN ('ncm', 'rule', 'ai', 'user'));

-- migrate:down
ALTER TABLE products
    DROP CONSTRAINT ck_products_category_source,
    DROP COLUMN ncm,
    DROP COLUMN category_source;
