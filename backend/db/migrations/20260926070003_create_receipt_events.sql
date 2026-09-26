-- migrate:up
-- Bloco 4A: log append-only das transições de status do worker — auditoria/debug de por que
-- uma nota falhou ou demorou, sem depender só do último `failure_reason` sobrescrito.
CREATE TABLE receipt_events (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id  UUID          NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    from_status VARCHAR(12),
    to_status   VARCHAR(12)   NOT NULL,
    detail      VARCHAR(300),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_receipt_events_to_status
        CHECK (to_status IN ('pending', 'processing', 'done', 'failed', 'duplicate'))
);

CREATE INDEX ix_receipt_events_receipt_id_created_at ON receipt_events (receipt_id, created_at);

-- migrate:down
DROP TABLE receipt_events;
