import { afterEach, describe, expect, it, vi } from "vitest";

import { withRefreshLock } from "@/lib/auth/refresh-lock";

/** jsdom NÃO implementa a Web Locks API (`.claude/rules/tests.md` > Sessão) — sem isto, o
 * fallback de `withRefreshLock` roda direto e o teste de concorrência passa por acidente
 * (sem exercitar serialização nenhuma). Mock mínimo: fila FIFO por nome de lock. */
function mockWebLocks() {
  const queues = new Map<string, Promise<unknown>>();
  const locks: Partial<LockManager> = {
    request: (async (name: string, ...rest: unknown[]) => {
      const callback = (rest.length > 1 ? rest[1] : rest[0]) as (lock: unknown) => Promise<unknown>;
      const previous = queues.get(name) ?? Promise.resolve();
      const next = previous.then(() => callback(null));
      queues.set(
        name,
        next.catch(() => undefined),
      );
      return next;
    }) as LockManager["request"],
  };
  Object.defineProperty(navigator, "locks", { value: locks, configurable: true });
}

const originalLocks = navigator.locks;

afterEach(() => {
  Object.defineProperty(navigator, "locks", { value: originalLocks, configurable: true });
});

describe("withRefreshLock", () => {
  it("serializa chamadas concorrentes atrás do MESMO lock (skill auth §11)", async () => {
    mockWebLocks();
    const order: string[] = [];
    let releaseFirst: (() => void) | undefined;

    const first = withRefreshLock(async () => {
      order.push("first-start");
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      order.push("first-end");
      return "first";
    });

    await Promise.resolve();
    await Promise.resolve();

    const second = withRefreshLock(async () => {
      order.push("second-start");
      return "second";
    });

    // `second` não pode começar antes de `first` liberar o lock.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(order).toEqual(["first-start"]);

    releaseFirst?.();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toBe("first");
    expect(secondResult).toBe("second");
    expect(order).toEqual(["first-start", "first-end", "second-start"]);
  });

  it("sem Web Locks API (fallback), roda direto — sem quebrar", async () => {
    // @ts-expect-error -- simula ambiente sem Web Locks API.
    delete navigator.locks;

    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRefreshLock(fn);

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledOnce();
  });
});
