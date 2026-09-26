-- migrate:up
-- Bloco 2B (docs/fases-construcao.md > Onda 2): mercados por cidade. CNPJ do emitente
-- da NFC-e identifica o mercado quando a nota chegar (Etapa 7); cadastro manual até lá.
CREATE TABLE markets (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id     UUID          NOT NULL REFERENCES cities(id),
    cnpj        CHAR(14),                       -- NULL até casar com a NFC-e ou cadastro manual
    legal_name  VARCHAR(200),
    trade_name  VARCHAR(200)  NOT NULL,
    address     VARCHAR(300),
    latitude    NUMERIC(9,6),
    longitude   NUMERIC(9,6),
    is_partner  BOOLEAN       NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX ix_markets_city_id ON markets (city_id);

-- Nome exato do índice ("markets_cnpj_uq") é contrato com `api/core/exceptions.py`
-- (UNIQUE_CONSTRAINT_MESSAGES), já cadastrado no bloco 1A.
CREATE UNIQUE INDEX markets_cnpj_uq ON markets (cnpj) WHERE deleted_at IS NULL AND cnpj IS NOT NULL;

-- Seed: mercados de Catalão-GO já identificados (docs/fontes-de-dados.md). Nenhuma das fontes
-- pesquisadas trazia CNPJ — fica NULL até confirmação (NFC-e ou cadastro manual do admin).
INSERT INTO markets (city_id, trade_name, is_partner)
SELECT cities.id, m.trade_name, false
  FROM cities, (VALUES
      ('Supermercado Catalão'),
      ('Pontal Atacado e Varejo'),
      ('Rio Vermelho Atacadista')
  ) AS m(trade_name)
 WHERE cities.ibge_code = 5205109;

-- migrate:down
DROP TABLE markets;
