import type { BudgetStatus } from "@/lib/types";

const WARNING_THRESHOLD_PERCENTAGE = 80;

export function computeBudgetStatus(spentCents: number, budgetCents: number): BudgetStatus {
  const percentage = budgetCents > 0 ? Math.round((spentCents / budgetCents) * 100) : 0;
  const state = percentage >= 100 ? "over" : percentage >= WARNING_THRESHOLD_PERCENTAGE ? "warning" : "ok";

  return {
    state,
    spentCents,
    budgetCents,
    remainingCents: budgetCents - spentCents,
    percentage,
  };
}
