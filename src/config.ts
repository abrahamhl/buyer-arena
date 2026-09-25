import { existsSync } from 'node:fs';
import { z } from 'zod';
import { readStructured } from './core/fs.js';
import { ReleaseGatesSchema } from './lifecycle/graph.js';

export const ConfigSchema = z.object({
  population: z.string().optional(),
  task: z.string().optional(),
  variants: z.record(z.string(), z.string()).optional(),
  buyer: z.string().optional(),
  auditor: z.string().optional(),
  /** Network policy. Setting it makes the policy strict (see src/policy/network.ts). */
  network: z
    .object({
      mode: z.enum(['offline', 'local', 'hybrid', 'online']).optional(),
      allow_providers: z.array(z.string()).optional(),
    })
    .optional(),
  /** Model catalog overrides and routing defaults. */
  models: z
    .object({
      routing: z.enum(['quality', 'balanced', 'economy', 'offline']).optional(),
      /** Exact response cache for temperature-0 calls (default on). */
      cache: z.boolean().optional(),
      overrides: z
        .record(
          z.string(),
          z
            .object({
              input: z.number().nonnegative(),
              output: z.number().nonnegative(),
              cached_input: z.number().nonnegative(),
              context: z.number().int().positive(),
              vision: z.boolean(),
              tools: z.boolean(),
              structured_output: z.boolean(),
            })
            .partial(),
        )
        .optional(),
    })
    .optional(),
  /** Commands `agent-eval` runs on both sides of a change (argv, no shell on POSIX). */
  agent_eval: z
    .object({
      install: z.string().optional(),
      build: z.string().optional(),
      lint: z.string().optional(),
      test: z.string().optional(),
      env_pass: z.array(z.string()).optional(),
      timeout_ms: z.number().int().positive().optional(),
    })
    .optional(),
  release: ReleaseGatesSchema.optional(),
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
