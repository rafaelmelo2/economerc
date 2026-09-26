import { describe, expect, it } from "vitest";

import { computeBudgetStatus } from "@/lib/budget";

describe("computeBudgetStatus", () => {
  it("is 'ok' below 80%", () => {
    const status = computeBudgetStatus(5000, 10000);
    expect(status.state).toBe("ok");
    expect(status.percentage).toBe(50);
    expect(status.remainingCents).toBe(5000);
  });

  it("switches to 'warning' exactly at 80%", () => {
    expect(computeBudgetStatus(8000, 10000).state).toBe("warning");
  });

  it("stays 'ok' just below the 80% boundary (percentage rounds down, not up, across it)", () => {
    expect(computeBudgetStatus(7940, 10000).state).toBe("ok"); // 79.4% → arredonda pra 79%
  });

  it("switches to 'over' exactly at 100%", () => {
    expect(computeBudgetStatus(10000, 10000).state).toBe("over");
  });

  it("stays 'warning' just below the 100% boundary (percentage rounds down, not up, across it)", () => {
    expect(computeBudgetStatus(9940, 10000).state).toBe("warning"); // 99.4% → arredonda pra 99%
  });

  it("reports a negative remainingCents when the budget is exceeded", () => {
    const status = computeBudgetStatus(11830, 11650);
    expect(status.state).toBe("over");
    expect(status.remainingCents).toBe(-180);
  });

  it("treats a zero/absent budget as 'ok' with 0% instead of dividing by zero", () => {
    const status = computeBudgetStatus(5000, 0);
    expect(status.percentage).toBe(0);
    expect(status.state).toBe("ok");
    expect(Number.isFinite(status.remainingCents)).toBe(true);
  });

  it("rounds the percentage to the nearest integer", () => {
    expect(computeBudgetStatus(1, 3).percentage).toBe(33);
  });
});
