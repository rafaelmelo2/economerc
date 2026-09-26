-- migrate:up
-- Contrato compartilhado da Onda 2 (docs/fases-construcao.md): só `users`.
-- Identidades, preferências e refresh tokens pertencem ao bloco 2A (auth).
CREATE TABLE users (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(320),                -- Apple pode ocultar (relay); NULL permitido
    display_name  VARCHAR(120),
    role          VARCHAR(20)  NOT NULL DEFAULT 'user',
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ,
    CONSTRAINT ck_users_role CHECK (role IN ('user', 'moderator', 'admin'))
);

CREATE UNIQUE INDEX ux_users_email ON users (lower(email)) WHERE deleted_at IS NULL AND email IS NOT NULL;

-- migrate:down
DROP TABLE users;
