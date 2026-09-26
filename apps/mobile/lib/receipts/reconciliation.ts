// Junção carrinho × nota do histórico (Onda 5, item 4 do escopo) — lógica PURA, sem SQLite/API,
// pra ser testável isolada (mesmo espírito de `lib/sync/pull-reducer.ts`). O adapter que lê o
// SQLite de verdade e chama isto mora em `lib/history/data.ts`.
//
// Regra de junção (documentada — combine com o resto do time antes de mudar):
//   1. Mesmo dia civil (fuso America/Sao_Paulo) é pré-requisito sempre.
//   2. Nesse dia, casa por `marketId` igual (quando os dois têm) — o sinal mais forte.
//   3. Senão, casa por nome do mercado igual (trim + case-insensitive) — quando os dois têm nome.
//   4. Senão, se sobrou EXATAMENTE 1 carrinho e 1 nota sem par nesse dia, casa os dois (heurística:
//      hoje o carrinho quase nunca tem mercado definido — não há seletor de mercado nesta onda —
//      então "só uma compra e só uma nota no mesmo dia" already é um sinal forte o bastante).
//   5. O que sobra vira uma compra "solo" (só carrinho ou só nota).
// Quando casa, o total e a contagem de itens exibidos vêm da NOTA (mais confiável que a soma do
// carrinho, que pode ter preço editado à mão) — só a comparação lado a lado é feita depois, no
// componente de conciliação (`components/receipts/reconciliation-card.tsx`), sem alterar dado.

const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";
const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: SAO_PAULO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export interface CartForReconciliation {
  clientId: string;
  marketId: string | null;
  marketName: string | null;
  closedAt: string; // ISO 8601 UTC
  totalCents: number;
  itemCount: number;
}

export interface ReceiptForReconciliation {
  clientId: string;
  marketId: string | null;
  marketName: string | null;
  issuedAt: string; // ISO 8601 UTC — só notas `done`/`duplicate` entram aqui
  totalAmountCents: number;
  itemCount: number;
}

export type PurchaseSource = "cart" | "receipt" | "matched";

export interface Purchase {
  id: string;
  source: PurchaseSource;
  /** Data civil (America/Sao_Paulo) usada pra agrupar por mês/exibir. */
  date: string; // ISO 8601 UTC do instante de referência (issuedAt quando casada, closedAt senão)
  marketName: string | null;
  itemCount: number;
  totalCents: number;
  cartClientId: string | null;
  receiptClientId: string | null;
}

/** "YYYY-MM-DD" no fuso de exibição do app — só pra agrupar, nunca pra cálculo de dinheiro. */
export function toSaoPauloDateKey(isoDate: string): string {
  return DATE_KEY_FORMATTER.format(new Date(isoDate));
}

function normalizedMarketName(name: string | null): string | null {
  const trimmed = name?.trim().toLowerCase() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function toMatchedPurchase(cart: CartForReconciliation, receipt: ReceiptForReconciliation): Purchase {
  return {
    id: `m:${cart.clientId}:${receipt.clientId}`,
    source: "matched",
    date: receipt.issuedAt,
    marketName: receipt.marketName ?? cart.marketName,
    itemCount: receipt.itemCount,
    totalCents: receipt.totalAmountCents,
    cartClientId: cart.clientId,
    receiptClientId: receipt.clientId,
  };
}

function toCartOnlyPurchase(cart: CartForReconciliation): Purchase {
  return {
    id: `c:${cart.clientId}`,
    source: "cart",
    date: cart.closedAt,
    marketName: cart.marketName,
    itemCount: cart.itemCount,
    totalCents: cart.totalCents,
    cartClientId: cart.clientId,
    receiptClientId: null,
  };
}

function toReceiptOnlyPurchase(receipt: ReceiptForReconciliation): Purchase {
  return {
    id: `r:${receipt.clientId}`,
    source: "receipt",
    date: receipt.issuedAt,
    marketName: receipt.marketName,
    itemCount: receipt.itemCount,
    totalCents: receipt.totalAmountCents,
    cartClientId: null,
    receiptClientId: receipt.clientId,
  };
}

export function joinCartsAndReceipts(
  carts: readonly CartForReconciliation[],
  receipts: readonly ReceiptForReconciliation[],
): Purchase[] {
  const cartsByDay = new Map<string, CartForReconciliation[]>();
  for (const cart of carts) {
    const key = toSaoPauloDateKey(cart.closedAt);
    const bucket = cartsByDay.get(key) ?? [];
    bucket.push(cart);
    cartsByDay.set(key, bucket);
  }

  const receiptsByDay = new Map<string, ReceiptForReconciliation[]>();
  for (const receipt of receipts) {
    const key = toSaoPauloDateKey(receipt.issuedAt);
    const bucket = receiptsByDay.get(key) ?? [];
    bucket.push(receipt);
    receiptsByDay.set(key, bucket);
  }

  const purchases: Purchase[] = [];
  const allDayKeys = new Set([...cartsByDay.keys(), ...receiptsByDay.keys()]);

  for (const dayKey of allDayKeys) {
    const dayCarts = [...(cartsByDay.get(dayKey) ?? [])];
    const dayReceipts = [...(receiptsByDay.get(dayKey) ?? [])];
    const matchedCartIds = new Set<string>();
    const matchedReceiptIds = new Set<string>();

    // Passo 1: mesmo `marketId`.
    for (const cart of dayCarts) {
      if (!cart.marketId) continue;
      const receipt = dayReceipts.find(
        (candidate) => !matchedReceiptIds.has(candidate.clientId) && candidate.marketId === cart.marketId,
      );
      if (!receipt) continue;
      purchases.push(toMatchedPurchase(cart, receipt));
      matchedCartIds.add(cart.clientId);
      matchedReceiptIds.add(receipt.clientId);
    }

    // Passo 2: mesmo nome de mercado (normalizado).
    for (const cart of dayCarts) {
      if (matchedCartIds.has(cart.clientId)) continue;
      const cartName = normalizedMarketName(cart.marketName);
      if (!cartName) continue;
      const receipt = dayReceipts.find(
        (candidate) =>
          !matchedReceiptIds.has(candidate.clientId) && normalizedMarketName(candidate.marketName) === cartName,
      );
      if (!receipt) continue;
      purchases.push(toMatchedPurchase(cart, receipt));
      matchedCartIds.add(cart.clientId);
      matchedReceiptIds.add(receipt.clientId);
    }

    // Passo 3: heurística "sobrou 1 e 1" no mesmo dia.
    const remainingCarts = dayCarts.filter((cart) => !matchedCartIds.has(cart.clientId));
    const remainingReceipts = dayReceipts.filter((receipt) => !matchedReceiptIds.has(receipt.clientId));
    if (remainingCarts.length === 1 && remainingReceipts.length === 1) {
      const [cart] = remainingCarts;
      const [receipt] = remainingReceipts;
      purchases.push(toMatchedPurchase(cart!, receipt!));
      matchedCartIds.add(cart!.clientId);
      matchedReceiptIds.add(receipt!.clientId);
    }

    for (const cart of dayCarts) {
      if (!matchedCartIds.has(cart.clientId)) purchases.push(toCartOnlyPurchase(cart));
    }
    for (const receipt of dayReceipts) {
      if (!matchedReceiptIds.has(receipt.clientId)) purchases.push(toReceiptOnlyPurchase(receipt));
    }
  }

  return purchases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ---------------------------------------------------------------------------
// Comparação item a item (carrinho × nota) — só exibição, nunca altera dado
// (item 3 do escopo). Chave de casamento: EAN quando os dois lados têm; senão
// nome normalizado (trim + minúsculas) — a mesma tolerância que o restante do
// catálogo usa entre alias de mercado e nome escaneado.
// ---------------------------------------------------------------------------

export interface CartItemForComparison {
  ean: string | null;
  productName: string;
}

export interface ReceiptItemForComparison {
  ean: string | null;
  rawName: string;
}

export interface ItemComparisonResult {
  /** Itens escaneados no carrinho que a nota não trouxe (ou trouxe sob outro nome/EAN). */
  onlyInCart: readonly string[];
  /** Itens da nota que o carrinho não tinha escaneado. */
  onlyInReceipt: readonly string[];
}

function normalizedName(name: string): string {
  return name.trim().toLowerCase();
}

function itemKey(ean: string | null, name: string): string {
  return ean && ean.length > 0 ? `ean:${ean}` : `name:${normalizedName(name)}`;
}

export function compareCartAndReceiptItems(
  cartItems: readonly CartItemForComparison[],
  receiptItems: readonly ReceiptItemForComparison[],
): ItemComparisonResult {
  const receiptKeys = new Set(receiptItems.map((item) => itemKey(item.ean, item.rawName)));
  const cartKeys = new Set(cartItems.map((item) => itemKey(item.ean, item.productName)));

  return {
    onlyInCart: cartItems
      .filter((item) => !receiptKeys.has(itemKey(item.ean, item.productName)))
      .map((item) => item.productName),
    onlyInReceipt: receiptItems
      .filter((item) => !cartKeys.has(itemKey(item.ean, item.rawName)))
      .map((item) => item.rawName),
  };
}
