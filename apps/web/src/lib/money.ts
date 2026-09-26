/**
 * Formatação de dinheiro pt-BR — ver docs/brand/voz.md (regra 3: "Dinheiro sempre formatado").
 * Nunca usar float para cálculo (regra do projeto); este util é só apresentação.
 */

const BRL_CURRENCY_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const BRL_NUMBER_FORMATTER = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type PriceUnit = "kg" | "L" | "un";

/** "R$ 1.234,56" */
export function formatMoneyBRL(value: number): string {
  return BRL_CURRENCY_FORMATTER.format(value);
}

/** "1.234,56" (sem símbolo, para composições próprias) */
export function formatDecimalBRL(value: number): string {
  return BRL_NUMBER_FORMATTER.format(value);
}

/** "R$ 8,90/kg" */
export function formatMoneyPerUnit(value: number, unit: PriceUnit): string {
  return `${formatMoneyBRL(value)}/${unit}`;
}
