import { z } from "zod";

export const categorySchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  slug: z.string(),
  name: z.string(),
  icon: z.string(),
  ncmPrefixes: z.array(z.string()),
  position: z.number().int(),
});

export type Category = z.infer<typeof categorySchema>;
