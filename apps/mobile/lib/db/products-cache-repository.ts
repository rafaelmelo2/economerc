// Cache local de catálogo por EAN (rules/mobile.md > "Preços de referência...
// ficam em cache SQLite com `fetched_at`"). Resolução de EAN é SQLite → API →
// manual — este arquivo só cobre a ponta SQLite; a orquestração com a API mora
// em `lib/api/products.ts`.

import type { SQLiteDatabase } from "expo-sqlite";

import type { ProductCacheRow } from "./types";

/** Preço/produto com mais de 15 dias sem confirmação é "desatualizado"
 * (docs/roadmap-fase1.md > Etapa 3). */
export const PRODUCT_CACHE_STALE_AFTER_MS = 15 * 24 * 60 * 60 * 1000;

export function findCachedProductByEan(db: SQLiteDatabase, ean: string): ProductCacheRow | null {
  return db.getFirstSync<ProductCacheRow>("SELECT * FROM products_cache WHERE ean = ?", ean);
}

export function isProductCacheStale(row: ProductCacheRow, now: Date = new Date()): boolean {
  const fetchedAtMs = Date.parse(row.fetched_at);
  return now.getTime() - fetchedAtMs > PRODUCT_CACHE_STALE_AFTER_MS;
}

export function upsertCachedProduct(db: SQLiteDatabase, row: ProductCacheRow): void {
  db.runSync(
    `INSERT INTO products_cache (ean, product_id, name, brand, category_id, unit, net_quantity, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (ean) DO UPDATE SET
       product_id = excluded.product_id,
       name = excluded.name,
       brand = excluded.brand,
       category_id = excluded.category_id,
       unit = excluded.unit,
       net_quantity = excluded.net_quantity,
       fetched_at = excluded.fetched_at`,
    row.ean,
    row.product_id,
    row.name,
    row.brand,
    row.category_id,
    row.unit,
    row.net_quantity,
    row.fetched_at,
  );
}
