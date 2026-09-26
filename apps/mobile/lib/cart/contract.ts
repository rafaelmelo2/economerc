// Contrato do carrinho entre os blocos da onda 3 (docs/fases-construcao.md).
//
// - 3B (scan + carrinho) CONSOME só o que está exportado aqui: tipos + hooks/ações.
// - 3A (dados + sync) SUBSTITUI a implementação em memória abaixo por SQLite + outbox,
//   mantendo exatamente os mesmos nomes e assinaturas. Nenhum dos dois muda este
//   contrato sem combinar — mudança de assinatura quebra o outro bloco no merge.
//
// Dinheiro sempre em centavos inteiros; quantidade em milésimos (1 un = 1000,
// 1,4 kg = 1400) para nunca somar float.

import { create } from "zustand";

import type { CategoryKey } from "@/lib/types";

export type ProductUnit = "un" | "kg" | "g" | "l" | "ml";

/** O que o scan/lookup entrega para virar item do carrinho. */
export interface NewCartItemInput {
  ean: string | null; // null = item digitado sem código de barras
  productName: string;
  category: CategoryKey;
  unit: ProductUnit;
  unitPriceCents: number;
  quantityMilli: number;
  isOffer: boolean;
  productId: string | null; // id do servidor, quando o lookup encontrou
}

export interface CartItemRecord extends NewCartItemInput {
  clientId: string; // UUID v4 gerado no aparelho — chave do sync idempotente
  totalCents: number; // round(unitPriceCents * quantityMilli / 1000)
  addedAt: string; // ISO 8601 UTC
}

export interface ActiveCart {
  clientId: string;
  marketId: string | null;
  marketName: string | null;
  budgetCents: number | null;
  items: readonly CartItemRecord[];
  totalCents: number;
}

export interface CartItemPatch {
  unitPriceCents?: number;
  quantityMilli?: number;
  isOffer?: boolean;
}

export function computeItemTotalCents(unitPriceCents: number, quantityMilli: number): number {
  return Math.round((unitPriceCents * quantityMilli) / 1000);
}

// ---------------------------------------------------------------------------
// Implementação em memória (provisória). O bloco 3A troca TUDO daqui pra baixo
// por SQLite + outbox, preservando: useActiveCart, addCartItem, updateCartItem,
// removeCartItem, setCartMarket, setCartBudget, closeActiveCart.
// ---------------------------------------------------------------------------

interface CartMemoryState {
  cart: ActiveCart;
}

function newClientId(): string {
  return globalThis.crypto.randomUUID();
}

function emptyCart(): ActiveCart {
  return {
    clientId: newClientId(),
    marketId: null,
    marketName: null,
    budgetCents: null,
    items: [],
    totalCents: 0,
  };
}

function withTotals(cart: ActiveCart, items: readonly CartItemRecord[]): ActiveCart {
  const totalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
  return { ...cart, items, totalCents };
}

const useCartMemoryStore = create<CartMemoryState>(() => ({ cart: emptyCart() }));

export function useActiveCart(): ActiveCart {
  return useCartMemoryStore((state) => state.cart);
}

export async function addCartItem(input: NewCartItemInput): Promise<CartItemRecord> {
  const record: CartItemRecord = {
    ...input,
    clientId: newClientId(),
    totalCents: computeItemTotalCents(input.unitPriceCents, input.quantityMilli),
    addedAt: new Date().toISOString(),
  };
  const { cart } = useCartMemoryStore.getState();
  useCartMemoryStore.setState({ cart: withTotals(cart, [record, ...cart.items]) });
  return record;
}

export async function updateCartItem(clientId: string, patch: CartItemPatch): Promise<void> {
  const { cart } = useCartMemoryStore.getState();
  const items = cart.items.map((item) => {
    if (item.clientId !== clientId) return item;
    const next = { ...item, ...patch };
    return { ...next, totalCents: computeItemTotalCents(next.unitPriceCents, next.quantityMilli) };
  });
  useCartMemoryStore.setState({ cart: withTotals(cart, items) });
}

export async function removeCartItem(clientId: string): Promise<void> {
  const { cart } = useCartMemoryStore.getState();
  const items = cart.items.filter((item) => item.clientId !== clientId);
  useCartMemoryStore.setState({ cart: withTotals(cart, items) });
}

export async function setCartMarket(marketId: string | null, marketName: string | null) {
  const { cart } = useCartMemoryStore.getState();
  useCartMemoryStore.setState({ cart: { ...cart, marketId, marketName } });
}

export async function setCartBudget(budgetCents: number | null): Promise<void> {
  const { cart } = useCartMemoryStore.getState();
  useCartMemoryStore.setState({ cart: { ...cart, budgetCents } });
}

/** Fecha a compra atual (vai pro histórico) e abre um carrinho vazio. */
export async function closeActiveCart(): Promise<void> {
  useCartMemoryStore.setState({ cart: emptyCart() });
}
