// Conversão centavos ↔ string decimal (dinheiro) e milésimos ↔ string decimal
// (quantidade) — SÓ na borda do sync (rules/project.md > Dinheiro nunca em
// float). O app inteiro usa inteiros (`unitPriceCents`, `quantityMilli`); só
// aqui viram string decimal pro payload de `POST /sync/push`.

/** `1990` → `"19.90"`. Sempre 2 casas — mesmo formato que o backend aceita
 * (`Decimal`, `MoneyDecimal` em `schemas/sync/push.py`). */
export function centsToDecimalString(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const reais = Math.floor(abs / 100);
  const centavos = String(abs % 100).padStart(2, "0");
  return `${sign}${reais}.${centavos}`;
}

/** `"19.90"` → `1990`. Concatenação de string (nunca `parseFloat`) — ponto
 * flutuante nunca toca um valor em reais. */
export function decimalStringToCents(value: string): number {
  const [wholePart, fractionalPart = ""] = value.split(".");
  const whole = wholePart === "" || wholePart === "-" ? `${wholePart}0` : wholePart;
  const cents = fractionalPart.padEnd(2, "0").slice(0, 2);
  return Number(`${whole}${cents}`);
}

/** `1000` (1 un) → `"1"`; `1400` (1,4 kg) → `"1.4"`. Quantidade em milésimos,
 * sem zeros à direita supérfluos (a API valida `Decimal > 0`, formato livre). */
export function milliToDecimalString(milli: number): string {
  const sign = milli < 0 ? "-" : "";
  const abs = Math.abs(Math.round(milli));
  const whole = Math.floor(abs / 1000);
  const fractional = String(abs % 1000)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return fractional.length > 0 ? `${sign}${whole}.${fractional}` : `${sign}${whole}`;
}

/** `"1.4"` → `1400`. Mesma regra de concatenação de string do `centsToDecimalString`. */
export function decimalStringToMilli(value: string): number {
  const [wholePart, fractionalPart = ""] = value.split(".");
  const whole = wholePart === "" || wholePart === "-" ? `${wholePart}0` : wholePart;
  const milli = fractionalPart.padEnd(3, "0").slice(0, 3);
  return Number(`${whole}${milli}`);
}
