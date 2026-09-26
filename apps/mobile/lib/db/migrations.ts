// Migrations locais do SQLite (rules/mobile.md > Offline-first). Versionadas via
// `PRAGMA user_version` — cada entrada roda uma vez, em ordem, dentro de uma
// transação (`client.ts`). NUNCA edite uma migration já publicada: adicione uma
// nova com o próximo número.

import type { SQLiteDatabase } from "expo-sqlite";

export interface Migration {
  version: number;
  up: (db: SQLiteDatabase) => void;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    up: (db) => {
      // "carts"/"cart_items": campos que o backend sincroniza (rules/mobile.md >
      // contrato de sync/push) + colunas locais-only ("market_name", "category")
      // que nunca entram no outbox. "field_versions" é JSON {campo: updated_at} —
      // LWW por campo (mesmo mecanismo do backend, sync_service.field_versions).
      db.execSync(`
        CREATE TABLE IF NOT EXISTS carts (
          client_id TEXT PRIMARY KEY NOT NULL,
          market_id TEXT,
          market_name TEXT,
          status TEXT NOT NULL DEFAULT 'open',
          budget_cents INTEGER,
          started_at TEXT NOT NULL,
          closed_at TEXT,
          updated_at TEXT NOT NULL,
          field_versions TEXT NOT NULL DEFAULT '{}',
          deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS cart_items (
          client_id TEXT PRIMARY KEY NOT NULL,
          cart_client_id TEXT NOT NULL,
          product_id TEXT,
          ean TEXT,
          product_name TEXT NOT NULL,
          category TEXT NOT NULL,
          unit TEXT NOT NULL,
          unit_price_cents INTEGER NOT NULL,
          quantity_milli INTEGER NOT NULL,
          is_offer INTEGER NOT NULL DEFAULT 0,
          total_cents INTEGER NOT NULL,
          added_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          field_versions TEXT NOT NULL DEFAULT '{}',
          deleted_at TEXT
        );
        CREATE INDEX IF NOT EXISTS ix_cart_items_cart_client_id ON cart_items (cart_client_id);

        -- Fila de mutações pendentes (rules/mobile.md > outbox). Um outbox row = uma
        -- chamada de mutação do contrato (addCartItem/updateCartItem/...) — os
        -- campos fields/updated_at já vêm no formato que POST /sync/push espera.
        CREATE TABLE IF NOT EXISTS outbox (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity TEXT NOT NULL,
          op TEXT NOT NULL,
          client_id TEXT NOT NULL,
          fields TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          next_attempt_at TEXT
        );
        CREATE INDEX IF NOT EXISTS ix_outbox_created_at ON outbox (created_at);

        -- Cursor opaco do GET /sync/pull — linha única (id fixo).
        CREATE TABLE IF NOT EXISTS sync_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          cursor TEXT,
          last_synced_at TEXT
        );
        INSERT OR IGNORE INTO sync_state (id, cursor, last_synced_at) VALUES (1, NULL, NULL);

        -- Catálogo por EAN em cache local (rules/mobile.md > preço > 15 dias =
        -- desatualizado); fetched_at mede a idade.
        CREATE TABLE IF NOT EXISTS products_cache (
          ean TEXT PRIMARY KEY NOT NULL,
          product_id TEXT,
          name TEXT NOT NULL,
          brand TEXT,
          category_id TEXT,
          unit TEXT NOT NULL,
          net_quantity TEXT,
          fetched_at TEXT NOT NULL
        );

        -- Par chave/valor local genérico (onboarding cache, preferências ainda não
        -- sincronizadas) — evita AsyncStorage (proibido pra token; aqui nem é
        -- sensível, mas mantemos SQLite como única fonte local, rules/mobile.md).
        CREATE TABLE IF NOT EXISTS local_kv (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
    },
  },
  {
    version: 2,
    up: (db) => {
      // Fila de notas fiscais lidas por QR (Onda 5, docs/nfce-sefaz-go.md) — UMA linha cobre as
      // duas pontas: fila offline (status='queued' = ainda não chegou a mandar `POST /receipts`,
      // reenviada quando a rede volta, `lib/receipts/queue.ts`) E cache local do estado do
      // servidor (pending/processing/done/failed/duplicate, itens inclusos) pro histórico
      // funcionar offline (rules/mobile.md > "SQLite é a fonte da verdade do aparelho").
      // `client_id` (não um id de servidor) é a PK — nasce no app, único, e é a MESMA chave de
      // idempotência que `POST /receipts` espera, então reenviar depois de um retry nunca duplica.
      db.execSync(`
        CREATE TABLE IF NOT EXISTS receipts (
          client_id TEXT PRIMARY KEY NOT NULL,
          server_id TEXT,
          qr_text TEXT NOT NULL,
          access_key TEXT NOT NULL,
          cart_client_id TEXT,
          status TEXT NOT NULL DEFAULT 'queued',
          failure_reason TEXT,
          market_id TEXT,
          market_name TEXT,
          issued_at TEXT,
          total_amount_cents INTEGER,
          discount_amount_cents INTEGER,
          items_json TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_synced_at TEXT,
          attempts INTEGER NOT NULL DEFAULT 0,
          next_attempt_at TEXT
        );
        CREATE INDEX IF NOT EXISTS ix_receipts_status ON receipts (status);
        CREATE INDEX IF NOT EXISTS ix_receipts_cart_client_id ON receipts (cart_client_id);
      `);
    },
  },
];
