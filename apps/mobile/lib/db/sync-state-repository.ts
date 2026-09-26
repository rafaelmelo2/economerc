// Cursor opaco do `GET /sync/pull` (rules/mobile.md > pull incremental) — uma
// linha só (`id = 1`), criada pela migration 1.

import type { SQLiteDatabase } from "expo-sqlite";

import type { SyncStateRow } from "./types";

export function getSyncCursor(db: SQLiteDatabase): string | null {
  return db.getFirstSync<SyncStateRow>("SELECT * FROM sync_state WHERE id = 1")?.cursor ?? null;
}

export function setSyncCursor(db: SQLiteDatabase, cursor: string): void {
  db.runSync(
    "UPDATE sync_state SET cursor = ?, last_synced_at = ? WHERE id = 1",
    cursor,
    new Date().toISOString(),
  );
}

export function getLastSyncedAt(db: SQLiteDatabase): string | null {
  return (
    db.getFirstSync<SyncStateRow>("SELECT * FROM sync_state WHERE id = 1")?.last_synced_at ?? null
  );
}
