import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Porta fixa da web no EconoMerc (ver docs/fases-construcao.md > Portas locais).
const DEV_SERVER_PORT = 5180;
const BACKEND_URL = "http://localhost:8010";

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
});
