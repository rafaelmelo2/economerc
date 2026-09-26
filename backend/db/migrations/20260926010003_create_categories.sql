-- migrate:up
CREATE TABLE categories (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id    UUID        REFERENCES categories(id),
    slug         VARCHAR(60) NOT NULL,
    name         VARCHAR(80) NOT NULL,
    icon         VARCHAR(40) NOT NULL,             -- nome do ícone Lucide (docs/brand/visual.md)
    ncm_prefixes VARCHAR(8)[] NOT NULL DEFAULT '{}', -- regra de categorização por NCM (Etapa 8)
    position     SMALLINT    NOT NULL DEFAULT 0,
    CONSTRAINT uq_categories_slug UNIQUE (slug)
);

-- FK leftmost: parent_id precisa de índice dedicado (hierarquia rasa, sem composto útil).
CREATE INDEX ix_categories_parent_id ON categories (parent_id);

-- Seed: as 10 categorias da Fase 1 (docs/brand/visual.md > Ícones). `ncm_prefixes` é uma
-- primeira aproximação por capítulo NCM — dicionário de termos + IA refinam na Etapa 8.
INSERT INTO categories (slug, name, icon, ncm_prefixes, position) VALUES
    ('hortifruti', 'Hortifruti', 'Carrot',     ARRAY['07', '08'],  0),
    ('laticinios', 'Laticínios', 'Milk',       ARRAY['04'],        1),
    ('mercearia',  'Mercearia',  'Wheat',      ARRAY['10', '11', '15', '17', '19', '21'], 2),
    ('bebidas',    'Bebidas',    'CupSoda',    ARRAY['22'],        3),
    ('carnes',     'Carnes',     'Beef',       ARRAY['02', '03'],  4),
    ('padaria',    'Padaria',    'Croissant',  ARRAY['1905'],      5),
    ('congelados', 'Congelados', 'Snowflake',  ARRAY[]::VARCHAR(8)[], 6),
    ('limpeza',    'Limpeza',    'SprayCan',   ARRAY['34'],        7),
    ('higiene',    'Higiene',    'Bath',       ARRAY['33'],        8),
    ('outros',     'Outros',     'Package',    ARRAY[]::VARCHAR(8)[], 9);

-- migrate:down
DROP TABLE categories;
