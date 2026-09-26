import { z } from "zod";

/** Envelope padrão de toda listagem (`.claude/rules/backend.md` > Listagem). */
export function pagedResponseSchema<Item extends z.ZodTypeAny>(item: Item) {
  return z.object({
    items: z.array(item),
    total: z.number().int(),
    skip: z.number().int(),
    limit: z.number().int(),
    hasMore: z.boolean().default(false),
  });
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
  hasMore: boolean;
}
