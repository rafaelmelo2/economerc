import type { PagedResponse } from "@economerc/shared";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

export interface EntityListParams {
  search?: string;
  limit?: number;
}

/**
 * Fábrica do `useList` esperado pelo `EntityPicker` (`.claude/rules/web.md` > FK em forms) — o
 * MESMO endpoint paginado (`PagedResponse` + `search` ILIKE), sem endpoint de autocomplete.
 */
export function makeEntityListHook<T>(endpoint: string) {
  return function useList(params: EntityListParams, options: { enabled: boolean }) {
    const query = useQuery({
      queryKey: [endpoint, "picker", params],
      queryFn: async () => {
        const res = await apiClient.get<PagedResponse<T>>(endpoint, {
          search: params.search,
          limit: params.limit,
          skip: 0,
        });
        return res.data;
      },
      enabled: options.enabled,
    });
    return { data: query.data, isFetching: query.isFetching };
  };
}
