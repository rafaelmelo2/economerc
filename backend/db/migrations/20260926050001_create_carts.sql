-- migrate:up
-- Bloco 2C (sync offline, docs/fases-construcao.md > Onda 2). Carrinho criado
-- no app, sincronizado depois — client_id nasce no celular (skill `mobile-expo`
-- / rules/mobile.md).
CREATE TABLE carts (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID          NOT NULL REFERENCES users(id),
    client_id      UUID          NOT NULL,
    market_id      UUID,                             -- FK em 20260926060001_link_carts_to_catalog.sql
    status         VARCHAR(10)   NOT NULL DEFAULT 'open',
    budget         NUMERIC(12,2),
    started_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    closed_at      TIMESTAMPTZ,
    -- LWW por campo (rules/mobile.md): {"status": "2026-...Z", "budget": "..."}.
    -- Chave ausente = campo nunca versionado (default de coluna, nunca editado).
    field_versions JSONB         NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ,
    CONSTRAINT ck_carts_status CHECK (status IN ('open', 'closed', 'cancelled')),
    CONSTRAINT ck_carts_budget CHECK (budget IS NULL OR budget >= 0)
);

-- UNIQUE absoluto (não parcial `WHERE deleted_at IS NULL`, ao contrário do
-- default da skill `database`): client_id é a chave estável do carrinho no
-- app pro upsert idempotente. Se fosse parcial, um upsert atrasado depois do
-- tombstone recriaria a linha em vez de cair em "já removido" — quebra a
-- garantia de que delete é terminal (ver sync_service.py).
CREATE UNIQUE INDEX ux_carts_user_id_client_id ON carts (user_id, client_id);

CREATE INDEX ix_carts_market_id ON carts (market_id);

-- migrate:down
DROP TABLE carts;
