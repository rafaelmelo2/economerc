// `POST /receipts` / `GET /receipts/{id}` — wrapper tipado sobre o `ApiClient` autenticado
// (rules/mobile.md, docs/nfce-sefaz-go.md). `lib/receipts/queue.ts` é o único chamador — a UI
// nunca bate na rede direto, sempre lê o cache SQLite (`lib/db/receipts-repository.ts`).
//
// `ApiClient` (packages/shared) já converte snake_case ↔ camelCase na borda, então os shapes
// abaixo são exatamente `backend/src/api/schemas/receipts/receipt.py` em camelCase.

import { apiClient } from "./client";
import { ApiRequestError } from "./errors";

export type ReceiptStatus = "pending" | "processing" | "done" | "failed" | "duplicate";

export interface ReceiptResponseBody {
  id: string;
  userId: string;
  clientId: string;
  cartId: string | null;
  accessKey: string;
  stateCode: string;
  status: ReceiptStatus;
  failureReason: string | null;
  failureMessage: string | null; // pt-BR amigável (`services/nfce/failure_messages.py`)
  attempts: number;
  marketId: string | null;
  issuedAt: string | null;
  totalAmount: string | null; // decimal string — nunca float
  discountAmount: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptItemResponseBody {
  id: string;
  lineNumber: number;
  marketCode: string | null;
  ean: string | null;
  rawName: string;
  ncm: string | null;
  quantity: string; // decimal string
  unit: string | null;
  unitPrice: string; // decimal string
  totalPrice: string; // decimal string
  productId: string | null;
}

export interface ReceiptDetailResponseBody extends ReceiptResponseBody {
  items: ReceiptItemResponseBody[];
}

export interface CreateReceiptInput {
  qrText: string;
  clientId: string;
}

/** 202 sempre — a nota nasce `pending` e o worker processa em segundo plano
 * (`docs/nfce-sefaz-go.md` > Arquitetura). Nunca manda `cartId`: o app não tem como saber o id
 * de servidor do carrinho local (só o `client_id`), e a conciliação carrinho×nota desta onda é
 * 100% local (`lib/receipts/reconciliation.ts`) — não depende desse vínculo no backend. */
export async function createReceipt(input: CreateReceiptInput): Promise<ReceiptResponseBody> {
  const res = await apiClient.post<ReceiptResponseBody>("/receipts", {
    qrText: input.qrText,
    clientId: input.clientId,
    cartId: null,
  });
  if (!res.success) throw new ApiRequestError(res.status, res.data);
  return res.data;
}

export async function getReceipt(serverId: string): Promise<ReceiptDetailResponseBody> {
  const res = await apiClient.get<ReceiptDetailResponseBody>(`/receipts/${serverId}`);
  if (!res.success) throw new ApiRequestError(res.status, res.data);
  return res.data;
}
