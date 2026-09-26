// Adapter de I/O do histórico — lê o SQLite (carrinhos fechados + notas em cache) e monta os
// dados que `app/(tabs)/history.tsx` e `app/history/[purchaseId].tsx` consomem. Toda decisão
// (junção, agregação) é das funções puras de `lib/receipts/reconciliation.ts` e
// `lib/history/aggregate.ts` — aqui só busca e converte formato.

import { findClosedCartByClientId, listClosedCarts } from "@/lib/cart/history-repository";
import { getDb } from "@/lib/db/client";
import { findReceiptByClientId, listDoneReceipts } from "@/lib/db/receipts-repository";
import type { ReceiptItemCache, ReceiptRow } from "@/lib/db/types";
import {
  type CartForReconciliation,
  compareCartAndReceiptItems,
  type ItemComparisonResult,
  joinCartsAndReceipts,
  type Purchase,
  type ReceiptForReconciliation,
} from "@/lib/receipts/reconciliation";
import type { CategoryKey } from "@/lib/types";

import type { CartItemForCategoryAggregate } from "./aggregate";

export interface HistoryData {
  purchases: readonly Purchase[];
  cartItemsForCategory: readonly CartItemForCategoryAggregate[];
}

function parseReceiptItems(row: ReceiptRow): ReceiptItemCache[] {
  try {
    return JSON.parse(row.items_json) as ReceiptItemCache[];
  } catch {
    return [];
  }
}

function toReceiptForJoin(row: ReceiptRow): ReceiptForReconciliation | null {
  if (!row.issued_at) return null; // só notas com data de emissão entram na junção
  return {
    clientId: row.client_id,
    marketId: row.market_id,
    marketName: row.market_name,
    issuedAt: row.issued_at,
    totalAmountCents: row.total_amount_cents ?? 0,
    itemCount: parseReceiptItems(row).length,
  };
}

/** Todo o histórico local — carrinhos fechados + notas prontas, já casados. Funciona 100%
 * offline: notas são as que já chegaram no cache (`receipts.status IN ('done','duplicate')`). */
export function loadHistoryData(): HistoryData {
  const closedCarts = listClosedCarts();
  const doneReceipts = listDoneReceipts(getDb());

  const cartsForJoin: CartForReconciliation[] = closedCarts.map((cart) => ({
    clientId: cart.clientId,
    marketId: cart.marketId,
    marketName: cart.marketName,
    closedAt: cart.closedAt,
    totalCents: cart.totalCents,
    itemCount: cart.items.length,
  }));

  const receiptsForJoin = doneReceipts
    .map(toReceiptForJoin)
    .filter((receipt): receipt is ReceiptForReconciliation => receipt !== null);

  const purchases = joinCartsAndReceipts(cartsForJoin, receiptsForJoin);

  const cartItemsForCategory: CartItemForCategoryAggregate[] = closedCarts.flatMap((cart) =>
    cart.items.map((item) => ({
      cartClientId: cart.clientId,
      category: item.category,
      totalCents: item.totalCents,
    })),
  );

  return { purchases, cartItemsForCategory };
}

export interface PurchaseDetailCartItem {
  clientId: string;
  ean: string | null;
  productName: string;
  category: CategoryKey;
  unit: string;
  unitPriceCents: number;
  quantityMilli: number;
  totalCents: number;
}

export interface PurchaseDetailReceipt {
  marketName: string | null;
  issuedAt: string | null;
  totalAmountCents: number | null;
  discountAmountCents: number | null;
  items: readonly ReceiptItemCache[];
}

export interface PurchaseDetail {
  purchase: Purchase;
  cartItems: readonly PurchaseDetailCartItem[];
  receipt: PurchaseDetailReceipt | null;
  /** Só presente quando a compra casou carrinho × nota (`purchase.source === "matched"`). */
  comparison: ItemComparisonResult | null;
}

function findReceiptRowByClientId(clientId: string): ReceiptRow | null {
  return findReceiptByClientId(getDb(), clientId);
}

/** Reconstrói o detalhe de UMA compra a partir do `Purchase.id` (`c:`/`r:`/`m:` — ver
 * `lib/receipts/reconciliation.ts`). Devolve `null` só se o dado local sumiu (não deveria
 * acontecer — histórico nunca apaga). */
export function getPurchaseDetail(purchaseId: string): PurchaseDetail | null {
  const { purchases } = loadHistoryData();
  const purchase = purchases.find((candidate) => candidate.id === purchaseId);
  if (!purchase) return null;

  const cart = purchase.cartClientId ? findClosedCartByClientId(purchase.cartClientId) : null;
  const receiptRow = purchase.receiptClientId ? findReceiptRowByClientId(purchase.receiptClientId) : null;

  const cartItems: PurchaseDetailCartItem[] = (cart?.items ?? []).map((item) => ({
    clientId: item.clientId,
    ean: item.ean,
    productName: item.productName,
    category: item.category,
    unit: item.unit,
    unitPriceCents: item.unitPriceCents,
    quantityMilli: item.quantityMilli,
    totalCents: item.totalCents,
  }));

  const receiptItems = receiptRow ? parseReceiptItems(receiptRow) : [];
  const receipt: PurchaseDetailReceipt | null = receiptRow
    ? {
        marketName: receiptRow.market_name,
        issuedAt: receiptRow.issued_at,
        totalAmountCents: receiptRow.total_amount_cents,
        discountAmountCents: receiptRow.discount_amount_cents,
        items: receiptItems,
      }
    : null;

  const comparison =
    purchase.source === "matched" && cart && receiptRow
      ? compareCartAndReceiptItems(
          cartItems.map((item) => ({ ean: item.ean, productName: item.productName })),
          receiptItems.map((item) => ({ ean: item.ean, rawName: item.rawName })),
        )
      : null;

  return { purchase, cartItems, receipt, comparison };
}
