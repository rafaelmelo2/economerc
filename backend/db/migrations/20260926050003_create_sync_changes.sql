-- migrate:up
-- Log append-only por usuário (docs/modelagem.md > Sync). O cursor do pull
-- é o próprio `id` (BIGSERIAL, monotônico) — codificado opaco (base64) na
-- borda da rota, nunca exposto cru.
CREATE TABLE sync_changes (
    id         BIGSERIAL     PRIMARY KEY,
    user_id    UUID          NOT NULL REFERENCES users(id),
    entity     VARCHAR(10)   NOT NULL,
    entity_id  UUID          NOT NULL,      -- client_id da entidade (cart/cart_item)
    op         VARCHAR(10)   NOT NULL,
    -- Snapshot já em formato JSON-safe (Decimal/UUID/datetime -> str) do
    -- estado do registro após o merge LWW; pull devolve isso sem reconsultar
    -- carts/cart_items. Vazio ({}) em tombstones (op='delete').
    payload    JSONB         NOT NULL DEFAULT '{}'::jsonb,
    changed_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_sync_changes_entity CHECK (entity IN ('cart', 'cart_item')),
    CONSTRAINT ck_sync_changes_op CHECK (op IN ('upsert', 'delete'))
);

-- (user_id, id) cobre o filtro do pull E a ordem — sem esse composto o pull
-- faria seq scan por usuário a cada página (id sozinho não filtra por dono).
CREATE INDEX ix_sync_changes_user_id_id ON sync_changes (user_id, id);

-- migrate:down
DROP TABLE sync_changes;
