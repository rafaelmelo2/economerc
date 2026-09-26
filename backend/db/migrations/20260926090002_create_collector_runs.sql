-- migrate:up
-- Bloco 4C: histórico de execução de cada coletor (crawler do Supermercado Catalão, worker de
-- WhatsApp, ...) — observabilidade de quantos itens/preços saíram e o que deu erro.
CREATE TABLE collector_runs (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    market_source_id UUID          REFERENCES market_sources(id),
    collector        VARCHAR(40)   NOT NULL,   -- 'supercatalao', 'whatsapp', ...
    status           VARCHAR(12)   NOT NULL DEFAULT 'running',
    items_found      INTEGER       NOT NULL DEFAULT 0,
    aliases_created  INTEGER       NOT NULL DEFAULT 0,
    prices_created   INTEGER       NOT NULL DEFAULT 0,
    error_message    VARCHAR(500),
    started_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    finished_at      TIMESTAMPTZ,
    CONSTRAINT ck_collector_runs_status CHECK (status IN ('running', 'success', 'failed'))
);

CREATE INDEX ix_collector_runs_market_source_id ON collector_runs (market_source_id);
-- Histórico "últimas execuções do coletor X" — desempate por id (bloco 4C > backend.md > Listagem).
CREATE INDEX ix_collector_runs_collector_started_at_id
    ON collector_runs (collector, started_at DESC, id DESC);

-- migrate:down
DROP TABLE collector_runs;
