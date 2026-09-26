// Leitura de carrinhos FECHADOS para o histórico (Onda 5) — só consome `lib/cart/contract.ts`
// (`closeActiveCart`) e o SQLite que ele já mantém; nunca escreve. Mora em `lib/cart/` (não em
// `lib/db/`) porque é específico do domínio de histórico, não um CRUD genérico de carrinho —
// ver o combinado da Onda 5 no topo deste arquivo/tarefa.

import { listActiveCartItems } from "@/lib/db/cart-repository";
import { getDb } from "@/lib/db/client";
import type { CartRow } from "@/lib/db/types";
import type { CategoryKey } from "@/lib/types";

export interface ClosedCartItemSummary {
  clientId: string;
  ean: string | null;
  productName: string;
  category: CategoryKey;
  unit: string;
  unitPriceCents: number;
  quantityMilli: number;
  totalCents: number;
}

export interface ClosedCartSummary {
  clientId: string;
  marketId: string | null;
  marketName: string | null;
  closedAt: string; // ISO 8601 UTC
  totalCents: number;
  items: readonly ClosedCartItemSummary[];
}

function toItemSummary(row: ReturnType<typeof listActiveCartItems>[number]): ClosedCartItemSummary {
  return {
    clientId: row.client_id,
    ean: row.ean,
    productName: row.product_name,
    category: row.category as CategoryKey,
    unit: row.unit,
    unitPriceCents: row.unit_price_cents,
    quantityMilli: row.quantity_milli,
    totalCents: row.total_cents,
  };
}

function toClosedCartSummary(row: CartRow): ClosedCartSummary {
  const items = listActiveCartItems(getDb(), row.client_id).map(toItemSummary);
  return {
    clientId: row.client_id,
    marketId: row.market_id,
    marketName: row.market_name,
    closedAt: row.closed_at ?? row.updated_at,
    totalCents: items.reduce((sum, item) => sum + item.totalCents, 0),
    items,
  };
}

/** Todos os carrinhos fechados (status='closed', não-apagados) — base do histórico local. */
export function listClosedCarts(): ClosedCartSummary[] {
  const db = getDb();
  const rows = db.getAllSync<CartRow>(
    "SELECT * FROM carts WHERE status = 'closed' AND deleted_at IS NULL ORDER BY closed_at DESC",
  );
  return rows.map(toClosedCartSummary);
}

export function findClosedCartByClientId(clientId: string): ClosedCartSummary | null {
  const db = getDb();
  const row = db.getFirstSync<CartRow>(
    "SELECT * FROM carts WHERE client_id = ? AND status = 'closed' AND deleted_at IS NULL",
    clientId,
  );
  return row ? toClosedCartSummary(row) : null;
}
