// `GET /markets/{id}` — só o nome do mercado (`tradeName`), pra resolver `market_id` de uma nota
// pronta em texto legível. `lib/receipts/queue.ts` chama isso uma vez por nota (o resultado fica
// persistido em `receipts.market_name`, nunca refeito a cada poll).

import { apiClient } from "./client";
import { ApiRequestError } from "./errors";

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
