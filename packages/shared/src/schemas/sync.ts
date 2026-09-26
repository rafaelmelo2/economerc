import { z } from "zod";

/**
 * Contrato de `POST /sync/push` / `GET /sync/pull` (`backend/src/api/schemas/sync/`).
 * Dinheiro sempre string decimal (`"24.90"`) — nunca `number` (perde precisão
 * antes de chegar aqui). `MAX_PUSH_BATCH_SIZE` espelha o limite do backend.
 */

export const MAX_PUSH_BATCH_SIZE = 500;

/** Regex frouxa o bastante para inteiro ou decimal com ponto — o backend valida
 * o `Decimal` de verdade; aqui só barra `NaN`/notação científica/vírgula. */
const DECIMAL_STRING_PATTERN = /^\d+(\.\d+)?$/;
export const decimalStringSchema = z
  .string()
  .regex(DECIMAL_STRING_PATTERN, "precisa ser uma string decimal (ex.: \"12.50\")");

export const cartStatusSchema = z.enum(["open", "closed", "cancelled"]);
export type CartStatus = z.infer<typeof cartStatusSchema>;

export const cartItemUnitSchema = z.enum(["un", "kg", "g", "l", "ml"]);
export type CartItemUnit = z.infer<typeof cartItemUnitSchema>;

export const syncOpSchema = z.enum(["upsert", "delete"]);
export type SyncOp = z.infer<typeof syncOpSchema>;

export const cartFieldsSchema = z
  .object({
    marketId: z.string().uuid().nullable(),
    status: cartStatusSchema,
    budget: decimalStringSchema,
    startedAt: z.string(),
    closedAt: z.string().nullable(),
  })
  .partial();
export type CartFields = z.infer<typeof cartFieldsSchema>;

export const cartItemFieldsSchema = z
  .object({
    cartClientId: z.string().uuid(),
    productId: z.string().uuid().nullable(),
    ean: z.string().max(14).nullable(),
    productName: z.string().max(200),
    unitPrice: decimalStringSchema,
    quantity: decimalStringSchema,
    unit: cartItemUnitSchema,
    isOffer: z.boolean(),
  })
  .partial();
export type CartItemFields = z.infer<typeof cartItemFieldsSchema>;

const timestampedMutationSchema = z.object({
  clientId: z.string().uuid(),
  op: syncOpSchema,
  updatedAt: z.string(), // ISO 8601 com timezone — LWW compara instantes absolutos
});

export const cartMutationSchema = timestampedMutationSchema.extend({
  entity: z.literal("cart"),
  fields: cartFieldsSchema,
});
export type CartMutation = z.infer<typeof cartMutationSchema>;

export const cartItemMutationSchema = timestampedMutationSchema.extend({
  entity: z.literal("cart_item"),
  fields: cartItemFieldsSchema,
});
export type CartItemMutation = z.infer<typeof cartItemMutationSchema>;

export const syncMutationSchema = z.discriminatedUnion("entity", [
  cartMutationSchema,
  cartItemMutationSchema,
]);
export type SyncMutation = z.infer<typeof syncMutationSchema>;

export const syncPushRequestSchema = z.object({
  mutations: z.array(syncMutationSchema).min(1).max(MAX_PUSH_BATCH_SIZE),
});
export type SyncPushRequest = z.infer<typeof syncPushRequestSchema>;

export const syncPushStatusSchema = z.enum(["applied", "ignored_stale", "rejected"]);
export type SyncPushStatus = z.infer<typeof syncPushStatusSchema>;

export const syncPushItemResultSchema = z.object({
  clientId: z.string().uuid(),
  status: syncPushStatusSchema,
  reason: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type SyncPushItemResult = z.infer<typeof syncPushItemResultSchema>;

export const syncPushResponseSchema = z.object({
  results: z.array(syncPushItemResultSchema),
});
export type SyncPushResponse = z.infer<typeof syncPushResponseSchema>;

export const syncChangeResponseSchema = z.object({
  entity: z.enum(["cart", "cart_item"]),
  op: syncOpSchema,
  clientId: z.string().uuid(),
  updatedAt: z.string(),
  fields: z.record(z.string(), z.unknown()),
});
export type SyncChangeResponse = z.infer<typeof syncChangeResponseSchema>;

export const syncPullResponseSchema = z.object({
  changes: z.array(syncChangeResponseSchema),
  hasMore: z.boolean(),
  nextCursor: z.string(),
});
export type SyncPullResponse = z.infer<typeof syncPullResponseSchema>;
