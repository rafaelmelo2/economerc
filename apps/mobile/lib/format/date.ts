const RELATIVE_DAY_FORMATTER = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });

export function formatDayMonth(date: Date): string {
  return RELATIVE_DAY_FORMATTER.format(date);
}

export function formatMonthLabel(date: Date): string {
  const formatter = new Intl.DateTimeFormat("pt-BR", { month: "long" });
  const label = formatter.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
