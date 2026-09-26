-- migrate:up
-- Bloco 4B: infra de uploads (skill `uploads-storage`). Fase 1 só usa `user_uploads`
-- (foto de etiqueta para OCR); `org_uploads` fica pra Fase 2 (mercado parceiro).
-- `kind` cresce por ALTER + CONSTRAINT novo no mesmo PR que introduzir o próximo uso
-- (ex.: `receipt_raw` no bloco de NFC-e, `avatar` no perfil do app).
CREATE TABLE user_uploads (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind          VARCHAR(30)  NOT NULL,
    entity_type   VARCHAR(60),
    entity_id     VARCHAR(60),
    url           TEXT         NOT NULL,
    storage_key   TEXT,
    filename      VARCHAR(160) NOT NULL,
    mime_type     VARCHAR(100),
    size_bytes    INTEGER      NOT NULL,
    width         INTEGER,
    height        INTEGER,
    visibility    VARCHAR(10)  NOT NULL DEFAULT 'private',
    metadata      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ,
    CONSTRAINT ck_user_uploads_kind CHECK (kind IN ('price_tag_photo')),
    CONSTRAINT ck_user_uploads_visibility CHECK (visibility IN ('public', 'tenant', 'private'))
);

CREATE INDEX ix_user_uploads_owner_user_id ON user_uploads (owner_user_id);

-- migrate:down
DROP TABLE user_uploads;
