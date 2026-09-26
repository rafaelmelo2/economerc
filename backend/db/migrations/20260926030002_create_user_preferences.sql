-- migrate:up
-- Bloco 2A (auth): onboarding (cidade, tamanho da família, orçamento mensal).
-- 1:1 com `users` — PK é a própria FK.
CREATE TABLE user_preferences (
    user_id              UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    city_id              UUID        REFERENCES cities(id),
    household_size       SMALLINT    CHECK (household_size BETWEEN 1 AND 20),
    monthly_budget       NUMERIC(12, 2) CHECK (monthly_budget >= 0),
    budget_alert_percent SMALLINT    NOT NULL DEFAULT 80
                         CHECK (budget_alert_percent BETWEEN 50 AND 100),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_user_preferences_city_id ON user_preferences (city_id);

-- migrate:down
DROP TABLE user_preferences;
