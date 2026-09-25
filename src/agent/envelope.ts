import { z } from 'zod';

/**
 * AgentRunEnvelope v1 — OPTIONAL metadata about who/what produced a change.
 *
 * Buyer Arena evaluates the resulting code, not the agent's account of it: `self_report`
 * is recorded for transparency and is never used in any score. A human commit needs no
 * envelope at all.
 */
export const AgentRunEnvelopeSchema = z.object({
  schema_version: z.literal('1').default('1'),
  agent: z.object({ name: z.string(), version: z.string().optional() }).optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  task: z.object({ id: z.string().optional(), description: z.string().max(4000).optional() }).optional(),
  repo_before_sha: z.string().optional(),
  repo_after_sha: z.string().optional(),
  duration_ms: z.number().nonnegative().optional(),
  usage: z
    .object({
      input_tokens: z.number().nonnegative().optional(),
      output_tokens: z.number().nonnegative().optional(),
      cached_tokens: z.number().nonnegative().optional(),
      cost_usd: z.number().nonnegative().optional(),
    })
    .optional(),
  tool_calls: z.number().int().nonnegative().optional(),
  artifacts: z.array(z.string()).optional(),
  self_report: z
    .object({ success: z.boolean().optional(), summary: z.string().max(4000).optional() })
    .optional(),
});
export type AgentRunEnvelope = z.infer<typeof AgentRunEnvelopeSchema>;
