// Cache local dos mercados da cidade (rules/mobile.md > offline-first) — alimenta o seletor
// "Em qual mercado você está?" (`components/cart/market-picker-sheet.tsx`) quando a rede falha.
// Orquestração com a API mora em `lib/api/markets.ts`; este arquivo só cobre a ponta SQLite.

import type { SQLiteDatabase } from "expo-sqlite";

import type { MarketCacheRow } from "./types";

export interface CacheableMarket {
  id: string;
  tradeName: string;
  address: string | null;
  isPartner: boolean;
}

export function upsertCachedMarkets(
  db: SQLiteDatabase,
  cityId: string,
  markets: readonly CacheableMarket[],
): void {
  const fetchedAt = new Date().toISOString();
  db.withTransactionSync(() => {
    for (const market of markets) {
      db.runSync(
        `INSERT INTO markets_cache (id, city_id, trade_name, address, is_partner, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           city_id = excluded.city_id,
           trade_name = excluded.trade_name,
           address = excluded.address,
           is_partner = excluded.is_partner,
           fetched_at = excluded.fetched_at`,
        market.id,
        cityId,
        market.tradeName,
        market.address,
        market.isPartner ? 1 : 0,
        fetchedAt,
      );
    }
  });
}

export function listCachedMarketsByCity(db: SQLiteDatabase, cityId: string): MarketCacheRow[] {
  return db.getAllSync<MarketCacheRow>(
    "SELECT * FROM markets_cache WHERE city_id = ? ORDER BY trade_name ASC",
    cityId,
  );
}
