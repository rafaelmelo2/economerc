import type { PagedResponse } from "@economerc/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { apiClient } from "@/lib/api/client";

/** 10 por vez — com `ORDER BY` indexado e sentinela `LIMIT+1` no backend, cada degrau é barato
 * (`.claude/rules/web.md` > Listas). */
export const LIST_PAGE_SIZE = 10;

/** ~4 cards de distância do fim — busca antes do usuário chegar lá, sem pré-carregar página
 * que ele nunca veria. */
const SENTINEL_ROOT_MARGIN = "400px 0px";

export type InfiniteListParams = Record<string, string | number | boolean | undefined>;

/**
 * Lista infinita sobre o `apiClient` — MESMO `GET` paginado do resto da app. A query key mantém
 * o prefixo `[endpoint, "list"]` de propósito: é o que as mutations invalidam por prefixo.
 */
export function useInfiniteList<T>(
  endpoint: string,
  params: InfiniteListParams = {},
  options?: { enabled?: boolean; pageSize?: number },
) {
  const pageSize = options?.pageSize ?? LIST_PAGE_SIZE;

  const query = useInfiniteQuery({
    queryKey: [endpoint, "list", "infinite", { ...params, limit: pageSize }],
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.get<PagedResponse<T>>(endpoint, {
        ...params,
        skip: pageParam,
        limit: pageSize,
      });
      return res.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextSkip = lastPage.skip + lastPage.items.length;
      const more = lastPage.hasMore ?? nextSkip < lastPage.total;
      return more ? nextSkip : undefined;
    },
    enabled: options?.enabled ?? true,
    // Frescor pós-mutation vem da invalidação, não do staleTime — com 0 a navegação lista →
    // detalhe → voltar refaria todas as páginas já carregadas em sequência.
    staleTime: 30_000,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  return { ...query, items, total };
}

/**
 * Sentinela de scroll infinito — devolve um callback ref. Ref-espelho do estado é obrigatório:
 * `observe()` dispara com o alvo AINDA visível, então qualquer valor que muda por render viraria
 * dep e recriaria o observer a cada render.
 */
export function useInfiniteScrollSentinel({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const state = useRef({ hasNextPage, isFetchingNextPage, fetchNextPage });
  state.current = { hasNextPage, isFetchingNextPage, fetchNextPage };

  useEffect(() => {
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        const current = state.current;
        if (!current.hasNextPage || current.isFetchingNextPage) return;
        current.fetchNextPage();
      },
      { rootMargin: SENTINEL_ROOT_MARGIN },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ver ref-espelho acima
  }, [node]);

  return setNode;
}
