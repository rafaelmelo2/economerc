import { z } from "zod";

import { userSchema } from "./user";

export const preferencesResponseSchema = z.object({
  userId: z.string().uuid(),
  cityId: z.string().uuid().nullable(),
  householdSize: z.number().int().nullable(),
  monthlyBudget: z.string().nullable(), // decimal string — dinheiro nunca float
  budgetAlertPercent: z.number().int(),
  updatedAt: z.string(),
});
export type PreferencesResponse = z.infer<typeof preferencesResponseSchema>;

export const meResponseSchema = userSchema.extend({
  preferences: preferencesResponseSchema.nullable(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

/** PATCH parcial — campo omitido preserva o valor atual (COALESCE no backend). */
export const updatePreferencesRequestSchema = z.object({
  cityId: z.string().uuid().nullable().optional(),
  householdSize: z.number().int().min(1).max(20).nullable().optional(),
  monthlyBudget: z.string().nullable().optional(),
  budgetAlertPercent: z.number().int().min(50).max(100).nullable().optional(),
});
export type UpdatePreferencesRequest = z.infer<typeof updatePreferencesRequestSchema>;
