import { z } from "zod";

import { userSchema } from "./user";

/** `id_token` do Google Sign-In nativo — já assinado, backend só verifica. */
export const googleLoginRequestSchema = z.object({
  idToken: z.string().min(1),
});
export type GoogleLoginRequest = z.infer<typeof googleLoginRequestSchema>;

/** `identity_token` do Sign in with Apple. `fullName` só vem no 1º login. */
export const appleLoginRequestSchema = z.object({
  identityToken: z.string().min(1),
  fullName: z.string().nullable().optional(),
});
export type AppleLoginRequest = z.infer<typeof appleLoginRequestSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

/** App nativo sempre recebe `refreshToken` no corpo (SecureStore) — só a web
 * (cookie HttpOnly) recebe `null` aqui. */
export const tokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().nullable(),
  expiresIn: z.number().int(),
  user: userSchema,
});
export type TokenResponse = z.infer<typeof tokenResponseSchema>;
