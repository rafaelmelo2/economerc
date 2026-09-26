// `GET /markets/{id}` — só o nome do mercado (`tradeName`), pra resolver `market_id` de uma nota
// pronta em texto legível. `lib/receipts/queue.ts` chama isso uma vez por nota (o resultado fica
// persistido em `receipts.market_name`, nunca refeito a cada poll).
//
// `GET /markets?city_id=` — lista de mercados da cidade pro seletor "Em qual mercado você está?"
// (`components/cart/market-picker-sheet.tsx`). Resultado cacheado em SQLite
// (`lib/db/markets-cache-repository.ts`) pra funcionar offline.

import { type Market, marketSchema, type PagedResponse, pagedResponseSchema } from "@economerc/shared";

import { apiClient } from "./client";
import { ApiRequestError } from "./errors";

const MARKETS_PAGE_LIMIT = 200; // cidade pequena/média (Fase 1) — 1 página cobre o catálogo todo

export interface MarketResponseBody {
  id: string;
  cityId: string;
  cnpj: string | null;
  legalName: string | null;
  tradeName: string;
  address: string | null;
  isPartner: boolean;
}

export async function getMarket(marketId: string): Promise<MarketResponseBody> {
  const res = await apiClient.get<MarketResponseBody>(`/markets/${marketId}`);
  if (!res.success) throw new ApiRequestError(res.status, res.data);
  return res.data;
}

export async function listMarketsByCity(cityId: string): Promise<Market[]> {
  const res = await apiClient.get<unknown>("/markets", { city_id: cityId, limit: MARKETS_PAGE_LIMIT });
  if (!res.success) throw new ApiRequestError(res.status, res.data);
  const page: PagedResponse<Market> = pagedResponseSchema(marketSchema).parse(res.data);
  return page.items;
}
