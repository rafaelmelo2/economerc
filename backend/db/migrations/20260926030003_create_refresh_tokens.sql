-- migrate:up
-- Bloco 2A (auth): refresh opaco (skill `auth` > auth-hardened.md). Nunca JWT
-- aqui — só o hash SHA-256 (hex, 64 chars) do token cru entregue ao cliente.
-- `family` sobrevive à rotação (herdada pelo sucessor); `family_created_at`
-- ancora o teto absoluto de vida da família (não desliza a cada refresh).
CREATE TABLE refresh_tokens (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family             UUID        NOT NULL DEFAULT gen_random_uuid(),
    family_created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    used               BOOLEAN     NOT NULL DEFAULT false,
    token_hash         CHAR(64)    NOT NULL,
    revoked_at         TIMESTAMPTZ,
    expires_at         TIMESTAMPTZ NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ux_refresh_tokens_token_hash ON refresh_tokens (token_hash);
CREATE INDEX ix_refresh_tokens_family_active ON refresh_tokens (family) WHERE revoked_at IS NULL;
CREATE INDEX ix_refresh_tokens_user_id ON refresh_tokens (user_id);

-- migrate:down
DROP TABLE refresh_tokens;
