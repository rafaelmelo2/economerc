-- migrate:up
CREATE TABLE cities (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    state_code CHAR(2)     NOT NULL REFERENCES states(code),
    ibge_code  INTEGER     NOT NULL,
    name       VARCHAR(120) NOT NULL,
    is_active  BOOLEAN     NOT NULL DEFAULT false,  -- cobertura do app ligada nesta cidade
    CONSTRAINT uq_cities_ibge_code UNIQUE (ibge_code)
);

-- FK leftmost: state_code precisa de índice dedicado (não é leftmost de nenhum composto).
CREATE INDEX ix_cities_state_code ON cities (state_code);

-- Seed: Catalão-GO é o piloto (docs/produto.md) — única cidade ativa na Fase 1.
INSERT INTO cities (state_code, ibge_code, name, is_active) VALUES
    ('GO', 5205109, 'Catalão', true);

-- migrate:down
DROP TABLE cities;
