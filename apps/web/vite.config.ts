import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// Porta fixa da web no EconoMerc (ver docs/fases-construcao.md > Portas locais). Override via
// `VITE_BACKEND_PROXY_URL` (ambiente compartilhado — cada agente roda o próprio backend numa
// porta própria pra não colidir com a stack do main em 8010).
const DEV_SERVER_PORT = 5180;
const BACKEND_URL = process.env.VITE_BACKEND_PROXY_URL || "http://localhost:8010";

export default defineConfig({
  plugins: [
    // O plugin do TanStack Router tem que vir ANTES do plugin do React.
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routeFileIgnorePattern: "__tests__",
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: DEV_SERVER_PORT,
    strictPort: true,
    proxy: {
      "/api": {
        target: BACKEND_URL,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: DEV_SERVER_PORT,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
