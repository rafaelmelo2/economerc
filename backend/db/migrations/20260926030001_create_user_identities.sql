-- migrate:up
-- Bloco 2A (auth): 1 usuário, N provedores (google/apple). `subject` = claim
-- "sub" do id_token verificado via JWKS (skill `auth`).
CREATE TABLE user_identities (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider   VARCHAR(10) NOT NULL,
    subject    VARCHAR(255) NOT NULL,
    email      VARCHAR(320),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_user_identities_provider CHECK (provider IN ('google', 'apple'))
);

CREATE UNIQUE INDEX ux_user_identities_provider_subject ON user_identities (provider, subject);
CREATE INDEX ix_user_identities_user_id ON user_identities (user_id);

-- migrate:down
DROP TABLE user_identities;
