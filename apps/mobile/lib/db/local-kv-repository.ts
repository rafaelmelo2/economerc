// Par chave/valor local genérico — onboarding e preferências que precisam
// sobreviver a um restart do app sem depender de rede (rules/mobile.md > SQLite
// é a fonte da verdade local). Nunca para token (isso é sempre expo-secure-store,
// ver lib/auth/token-store.ts).

import type { SQLiteDatabase } from "expo-sqlite";

interface LocalKvRow {
  key: string;
  value: string;
}

export function getLocalKv<T>(db: SQLiteDatabase, key: string): T | null {
  const row = db.getFirstSync<LocalKvRow>("SELECT * FROM local_kv WHERE key = ?", key);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export function setLocalKv<T>(db: SQLiteDatabase, key: string, value: T): void {
  db.runSync(
    `INSERT INTO local_kv (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    key,
    JSON.stringify(value),
  );
}

export function deleteLocalKv(db: SQLiteDatabase, key: string): void {
  db.runSync("DELETE FROM local_kv WHERE key = ?", key);
}
