// `GET /api/cities` — lista real pro onboarding (docs/roadmap-fase1.md > Etapa 4).

import { type City, citySchema, type PagedResponse, pagedResponseSchema } from "@economerc/shared";

import { apiClient } from "./client";
import { ApiRequestError } from "./errors";

const CITIES_PAGE_LIMIT = 100; // lista fechada (poucas cidades na Fase 1) — 1 página basta

export async function listCities(): Promise<City[]> {
  const res = await apiClient.get<unknown>("/cities", { limit: CITIES_PAGE_LIMIT });
  if (!res.success) throw new ApiRequestError(res.status, res.data);
  const page: PagedResponse<City> = pagedResponseSchema(citySchema).parse(res.data);
  return page.items;
}
