// Quantidade do carrinho sempre em milésimos (1 un = 1000, 1,4 kg = 1400) — nunca float,
// ver `lib/cart/contract.ts`. Formatação pt-BR (vírgula decimal) num único lugar.
import type { ProductUnit } from "@/lib/cart/contract";

const MILLI_PER_UNIT = 1000;

const UNIT_DISPLAY_LABEL: Record<ProductUnit, string> = {
  un: "un",
  kg: "kg",
  g: "g",
  l: "L",
  ml: "mL",
};

/** `true` para unidades vendidas fracionadas (peso/volume) — mostram casas decimais. */
export function isFractionalUnit(unit: ProductUnit): boolean {
  return unit !== "un";
}

export function unitDisplayLabel(unit: ProductUnit): string {
  return UNIT_DISPLAY_LABEL[unit];
}

/** Texto digitado (com vírgula ou ponto) → milésimos inteiros. Negativo/lixo vira 0. */
export function parseQuantityInputToMilli(rawText: string, unit: ProductUnit): number {
  const normalized = rawText.replace(",", ".").replace(/[^\d.]/g, "");
  if (normalized.length === 0) return 0;

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) return 0;

  const milli = Math.round(value * MILLI_PER_UNIT);
  return isFractionalUnit(unit) ? milli : Math.round(milli / MILLI_PER_UNIT) * MILLI_PER_UNIT;
}

/** Milésimos → texto de edição (vírgula decimal, sem zeros à direita). */
export function formatMilliToQuantityInput(milli: number, unit: ProductUnit): string {
  const value = milli / MILLI_PER_UNIT;
  if (!isFractionalUnit(unit)) return String(Math.round(value));

  const fixed = value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return fixed.replace(".", ",");
}

/** Milésimos → rótulo de exibição ("1 un", "1,4 kg", "500 g"). */
export function formatQuantityLabel(milli: number, unit: ProductUnit): string {
  return `${formatMilliToQuantityInput(milli, unit)} ${unitDisplayLabel(unit)}`;
}

/** Quantidade decimal CRUA da nota fiscal ("2.000", "0.500" — texto livre do DANFE, não
 * milésimos do carrinho) → rótulo pt-BR ("2 un", "0,5 kg"). Só exibição — nunca vira número
 * pra cálculo (o total já vem pronto do backend). */
export function formatReceiptQuantityLabel(quantity: string, unit: string | null): string {
  const trimmed = quantity.includes(".") ? quantity.replace(/0+$/, "").replace(/\.$/, "") : quantity;
  const label = trimmed.replace(".", ",");
  return unit ? `${label} ${unit.toLowerCase()}` : label;
}
