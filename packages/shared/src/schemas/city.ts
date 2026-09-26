import { z } from "zod";

export const citySchema = z.object({
  id: z.string().uuid(),
  stateCode: z.string().length(2),
  ibgeCode: z.number().int(),
  name: z.string(),
  isActive: z.boolean(),
});

export type City = z.infer<typeof citySchema>;
