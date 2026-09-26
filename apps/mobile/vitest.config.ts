import path from "node:path";

import { defineConfig } from "vitest/config";

// Testes de lógica pura (LWW, outbox, conversão decimal — sem RN/Expo runtime,
// então `environment: "node"` basta e roda bem mais rápido que jest-expo).
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
