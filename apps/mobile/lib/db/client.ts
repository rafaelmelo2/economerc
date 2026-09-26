// Abertura + migração do SQLite local (rules/mobile.md > offline-first: "SQLite
// é a fonte da verdade do aparelho"). API síncrona do expo-sqlite (execSync/
// runSync/getAllSync) — o volume de dados de um carrinho é pequeno (dezenas de
// itens), então síncrono não trava a UI e elimina o bootstrap assíncrono que
// atrasaria a 1ª leitura do carrinho em modo avião.

import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

import { MIGRATIONS } from "./migrations";

const DATABASE_NAME = "economerc.db";

let dbInstance: SQLiteDatabase | null = null;

function runPendingMigrations(db: SQLiteDatabase): void {
  const row = db.getFirstSync<{ user_version: number }>("PRAGMA user_version");
  const currentVersion = row?.user_version ?? 0;
  const pending = MIGRATIONS.filter((migration) => migration.version > currentVersion).sort(
    (a, b) => a.version - b.version,
  );
  for (const migration of pending) {
    db.withTransactionSync(() => {
      migration.up(db);
      db.execSync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}

/** Handle único memoizado do banco local — migra na primeira chamada. */
export function getDb(): SQLiteDatabase {
  if (dbInstance) return dbInstance;
  const db = openDatabaseSync(DATABASE_NAME);
  db.execSync("PRAGMA journal_mode = WAL;");
  db.execSync("PRAGMA foreign_keys = ON;");
  runPendingMigrations(db);
  dbInstance = db;
  return db;
}

/** Só para testes/dev tooling — força reabrir e re-migrar. */
export function resetDbHandleForTests(): void {
  dbInstance = null;
}
