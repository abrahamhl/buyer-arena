import { AuditorOutputSchema, type AuditorFinding } from '../core/types.js';
import { meteredComplete, type CostMeter } from '../providers/metered.js';
import type { ChatProvider } from '../providers/types.js';
import type { AuditPacket } from './packet.js';
import type { Auditor } from './rules.js';

const SYSTEM = (a: Auditor) => `You are the ${a.name} auditor in a panel of five independent reviewers.
Mandate: ${a.mandate}
You receive measured metrics and recorded journey events from synthetic buyers. Rules:
- Reason ONLY over the provided data. Never invent events, numbers or quotes.
- Every finding MUST cite evidence_ids copied exactly from the data (format "<run>:e<n>").
- Label each finding's claim: "observed_fact" (directly visible in the data), "inference" (interpretation), or "hypothesis" (untested causal idea).
- Synthetic results are a conversion PROXY, never predicted revenue.
Reply with JSON only: {"findings":[{"finding":"...","topic":"<snake_case or a friction code from the data>","evidence_ids":["..."],"affected_segments":["..."],"severity":"low|medium|high|critical","confidence":"low|medium|high","claim":"observed_fact|inference|hypothesis","proposed_experiment":"..."}]}`;

export interface LlmAuditResult {
  findings: AuditorFinding[];
  degraded: boolean;
  error?: string;
}

export function parseAuditorOutput(
  text: string,
): { ok: true; findings: AuditorFinding[] } | { ok: false; error: string } {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, error: 'no JSON object' };
  let raw: unknown;
  try {
    raw = JSON.parse(m[0]);
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  const r = AuditorOutputSchema.safeParse(raw);
  if (!r.success)
    return {
      ok: false,
      error: `schema: ${r.error.issues
        .map((i) => `${i.path.join('.')} ${i.message}`)
        .slice(0, 2)
        .join('; ')}`,
    };
  return { ok: true, findings: r.data.findings };
}

/**
 * Run one auditor through an LLM. On malformed output: one repair attempt, then fall back
 * to the deterministic auditor and flag the result as degraded. Never throws on bad output.
 */
export async function llmAudit(
  auditor: Auditor,
  packet: AuditPacket,
  provider: ChatProvider,
  meter: CostMeter,
): Promise<LlmAuditResult> {
  const data = JSON.stringify(packet);
  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    { role: 'user', content: `DATA:\n${data}` },
  ];
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await meteredComplete(provider, meter, {
        system: SYSTEM(auditor),
        messages,
        maxTokens: 1500,
      });
      const parsed = parseAuditorOutput(res.text);
      if (parsed.ok) return { findings: parsed.findings, degraded: false };
      lastError = parsed.error;
      messages.push(
        { role: 'assistant', content: res.text.slice(0, 4000) },
        {
          role: 'user',
          content: `Your reply was invalid (${parsed.error}). Reply again with valid JSON only.`,
        },
      );
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      break;
    }
  }
  return { findings: auditor.audit(packet), degraded: true, error: lastError };
}
