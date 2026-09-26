// `GET/PATCH/DELETE /api/me` — perfil, preferências (cidade/família/orçamento)
// e exclusão de conta (LGPD/App Store, rules/mobile.md > Auth).

import {
  type MeResponse,
  meResponseSchema,
  type UpdatePreferencesRequest,
  type PreferencesResponse,
  preferencesResponseSchema,
} from "@economerc/shared";

import { apiClient } from "./client";
import { ApiRequestError } from "./errors";

export async function getMe(): Promise<MeResponse> {
  const res = await apiClient.get<unknown>("/me");
  if (!res.success) throw new ApiRequestError(res.status, res.data);
  return meResponseSchema.parse(res.data);
}

export async function updatePreferences(
  body: UpdatePreferencesRequest,
): Promise<PreferencesResponse> {
  const res = await apiClient.patch<unknown>("/me/preferences", body);
  if (!res.success) throw new ApiRequestError(res.status, res.data);
  return preferencesResponseSchema.parse(res.data);
}

export async function deleteMyAccount(): Promise<void> {
  const res = await apiClient.delete<unknown>("/me");
  if (!res.success) throw new ApiRequestError(res.status, res.data);
}
