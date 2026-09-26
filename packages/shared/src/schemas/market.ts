import { z } from "zod";

export const marketSchema = z.object({
  id: z.string().uuid(),
  cityId: z.string().uuid(),
  cnpj: z.string().nullable(),
  legalName: z.string().nullable(),
  tradeName: z.string(),
  address: z.string().nullable(),
  isPartner: z.boolean(),
});

export type Market = z.infer<typeof marketSchema>;
