import { createRootRoute, Outlet } from "@tanstack/react-router";

// Raiz pura — rotas públicas (landing, /entrar) renderizam full-screen; a casca autenticada
// vive em _authenticated.tsx (ver skill app-scaffold > split de rota).
export const Route = createRootRoute({
  component: () => <Outlet />,
});
