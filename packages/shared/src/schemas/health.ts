import { z } from "zod";

export const dependencyStatusSchema = z.object({
  database: z.string(),
  valkey: z.string(),
  nats: z.string(),
});

export const healthSchema = z.object({
  status: z.string(),
  version: z.string(),
  timestamp: z.string(),
  dependencies: dependencyStatusSchema,
});

export type DependencyStatus = z.infer<typeof dependencyStatusSchema>;
export type Health = z.infer<typeof healthSchema>;
