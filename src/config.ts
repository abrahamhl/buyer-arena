import { existsSync } from 'node:fs';
import { z } from 'zod';
import { readStructured } from './core/fs.js';

export const ConfigSchema = z.object({
  population: z.string().optional(),
  task: z.string().optional(),
  variants: z.record(z.string(), z.string()).optional(),
  buyer: z.string().optional(),
  auditor: z.string().optional(),
  limits: z
    .object({
      max_buyers: z.number().int().positive(),
      max_parallel: z.number().int().positive(),
      max_steps: z.number().int().positive(),
      timeout_ms: z.number().int().positive(),
      budget_usd: z.number().nonnegative(),
    })
    .partial()
    .optional(),
});
export type Config = z.infer<typeof ConfigSchema>;

export const CONFIG_FILE = 'buyer-arena.yaml';

/** Optional project config. CLI flags always win over it. */
export function loadConfig(file = CONFIG_FILE): Config | undefined {
  return existsSync(file) ? ConfigSchema.parse(readStructured(file)) : undefined;
}
