// Instância única do TanStack Query (rules/mobile.md: "toda chamada à API via
// TanStack Query"). `retry: false` em rede ruim dentro do mercado é melhor UX
// que ficar tentando em silêncio — quem precisa de retry manual usa
// `refetch()`.

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
  },
});
