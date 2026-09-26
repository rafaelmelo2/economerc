-- migrate:up
-- Ledger append-only da correção manual de categoria (docs/roadmap-fase1.md > Etapa 8:
-- "correção manual... realimenta o dicionário/estatística"). A curadoria do dicionário
-- de termos (`services/categorization/category_terms.json`) é manual — este ledger é
-- o dado bruto que uma futura análise (ou o próprio time) usa pra decidir o que entra
-- no dicionário. Sem UPDATE/DELETE: cada correção é uma linha nova.
CREATE TABLE category_corrections (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id            UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    previous_category_id  UUID        REFERENCES categories(id),
    category_id           UUID        NOT NULL REFERENCES categories(id),
    corrected_by          UUID        NOT NULL REFERENCES users(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_category_corrections_product_id ON category_corrections (product_id);
CREATE INDEX ix_category_corrections_category_id ON category_corrections (category_id);
CREATE INDEX ix_category_corrections_corrected_by ON category_corrections (corrected_by);

-- migrate:down
DROP TABLE category_corrections;
