// Datas em pt-BR via `Intl` — nunca strings de mês/dia na mão (ver `.claude/rules/mobile.md`).
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", { month: "long" });
const MONTH_YEAR_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const DAY_MONTH_FORMATTER = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/** "Setembro" — cabeçalho do histórico por mês. */
export function formatMonthLabel(date: Date): string {
  const label = MONTH_LABEL_FORMATTER.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "Setembro de 2026" — seletor de mês do histórico (precisa do ano ao navegar entre anos). */
export function formatMonthYearLabel(date: Date): string {
  const label = MONTH_YEAR_LABEL_FORMATTER.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "23 set" — data curta de uma compra na lista do histórico. */
export function formatDayMonth(date: Date): string {
  return DAY_MONTH_FORMATTER.format(date).replace(".", "");
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "visto há 2 dias" — fonte e data em todo preço da comunidade (`docs/brand/voz.md`). */
export function formatObservedAgo(isoDate: string): string {
  const observedAtMs = new Date(isoDate).getTime();
  const diffDays = Math.max(0, Math.floor((Date.now() - observedAtMs) / DAY_MS));

  if (diffDays === 0) return "visto hoje";
  if (diffDays === 1) return "visto ontem";
  return `visto há ${diffDays} dias`;
}
