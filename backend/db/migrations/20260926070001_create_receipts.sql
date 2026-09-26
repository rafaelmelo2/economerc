-- migrate:up
-- Bloco 4A (docs/fases-construcao.md > Onda 4): NFC-e lida pelo QR. `status` reconcilia o
-- enum do roadmap ('pending'/'processing'/'done'/'failed') com o de docs/modelagem.md
-- (que também usa 'duplicate' para a nota repetida) — os dois cabem juntos sem perda.
-- A MESMA nota enviada por 2 usuários vira 2 linhas (cada um vê a sua no histórico), mas só a
-- primeira (status <> 'duplicate') é processada pelo worker — dedupe de preço é o índice
-- parcial único abaixo, não uma trava de aplicação.
-- `raw_html`: sem sistema de uploads nesta fase — o HTML bruto (comprimido+base64, ver
-- `receipt_repository.py`) fica no próprio Postgres, em `TEXT`; `raw_purged_at` marca quando
-- a retenção de 90 dias apagar o conteúdo (job de retenção fica para a Onda 5/admin).
CREATE TABLE receipts (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID          NOT NULL REFERENCES users(id),
    client_id       UUID          NOT NULL,
    cart_id         UUID          REFERENCES carts(id),
    access_key      CHAR(44)      NOT NULL,
    state_code      CHAR(2)       NOT NULL REFERENCES states(code),
    qr_url          TEXT          NOT NULL,
    status          VARCHAR(12)   NOT NULL DEFAULT 'pending',
    failure_reason  VARCHAR(200),
    attempts        SMALLINT      NOT NULL DEFAULT 0,
    market_id       UUID          REFERENCES markets(id),
    issued_at       TIMESTAMPTZ,
    total_amount    NUMERIC(12,2),
    discount_amount NUMERIC(12,2),
    raw_html        TEXT,
    raw_purged_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_receipts_user_id_client_id UNIQUE (user_id, client_id),
    CONSTRAINT ck_receipts_status
        CHECK (status IN ('pending', 'processing', 'done', 'failed', 'duplicate')),
    CONSTRAINT ck_receipts_attempts CHECK (attempts >= 0),
    CONSTRAINT ck_receipts_total_amount CHECK (total_amount IS NULL OR total_amount >= 0),
    CONSTRAINT ck_receipts_discount_amount CHECK (discount_amount IS NULL OR discount_amount >= 0)
);

-- Uma única chave "viva" (não-duplicada) por vez — a segunda pessoa a enviar a mesma nota
-- ganha uma linha própria com status='duplicate' em vez de violar a constraint.
CREATE UNIQUE INDEX ux_receipts_access_key_active ON receipts (access_key)
    WHERE status <> 'duplicate';

-- Histórico do usuário: user_id já é leftmost (FK indexada) e cobre a paginação por data.
CREATE INDEX ix_receipts_user_id_created_at ON receipts (user_id, created_at DESC, id);
CREATE INDEX ix_receipts_cart_id ON receipts (cart_id) WHERE cart_id IS NOT NULL;
CREATE INDEX ix_receipts_market_id ON receipts (market_id) WHERE market_id IS NOT NULL;
CREATE INDEX ix_receipts_state_code ON receipts (state_code);

-- migrate:down
DROP TABLE receipts;
