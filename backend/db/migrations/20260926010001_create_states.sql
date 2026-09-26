-- migrate:up
CREATE TABLE states (
    code      CHAR(2)   PRIMARY KEY,        -- 'GO'
    ibge_code SMALLINT  NOT NULL,           -- 2 primeiros dígitos da chave de acesso da NFC-e
    name      VARCHAR(60) NOT NULL,
    CONSTRAINT uq_states_ibge_code UNIQUE (ibge_code)
);

-- Seed: só GO na Fase 1 (piloto em Catalão). Demais UFs entram quando o app expandir.
INSERT INTO states (code, ibge_code, name) VALUES
    ('GO', 52, 'Goiás');

-- migrate:down
DROP TABLE states;
