import { z } from "zod";

/** Perfil público — espelha `UserResponse` do backend (nunca hash/token). */
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().nullable(),
  displayName: z.string().nullable(),
  role: z.string(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
});

export type User = z.infer<typeof userSchema>;
