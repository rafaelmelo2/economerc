// Dinheiro sempre em centavos inteiros — nunca float. Formatação pt-BR num único lugar.
const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCentsToBRL(cents: number): string {
  return BRL_FORMATTER.format(cents / 100);
}

export type PriceUnit = "kg" | "L";

export function formatUnitPriceToBRL(cents: number, unit: PriceUnit): string {
  return `${formatCentsToBRL(cents)}/${unit}`;
}

export function sumCents(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function parseBRLInputToCents(rawText: string): number {
  const digitsOnly = rawText.replace(/\D/g, "");
  if (digitsOnly.length === 0) return 0;
  return Number.parseInt(digitsOnly, 10);
}

export function formatCentsAsBRLInput(cents: number): string {
  return formatCentsToBRL(cents).replace("R$ ", "R$ ");
}
