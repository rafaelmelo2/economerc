import path from "node:path";

import { defineConfig } from "vitest/config";

// Só lógica pura (sem React Native), ver `.claude/rules/tests.md` → Scope. `gtin.ts` e
// `budget.ts` não importam nada nativo, então `node` puro basta — sem jsdom, sem mocks de RN.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
