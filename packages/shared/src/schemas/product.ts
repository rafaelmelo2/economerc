import { z } from "zod";

export const productUnitSchema = z.enum(["un", "kg", "g", "l", "ml"]);
export type ProductUnit = z.infer<typeof productUnitSchema>;

/** `GET /products/by-ean/{ean}` (Postgres → Valkey → Open Food Facts). */
export const productResponseSchema = z.object({
  id: z.string().uuid(),
  ean: z.string().nullable(),
  name: z.string(),
  brand: z.string().nullable(),
  categoryId: z.string().uuid().nullable(),
  unit: productUnitSchema,
  netQuantity: z.string().nullable(), // decimal string
  imageUploadId: z.string().uuid().nullable(),
  source: z.string(),
});
export type ProductResponse = z.infer<typeof productResponseSchema>;
