import { z } from 'zod';
import { meteredComplete, type CostMeter } from '../providers/metered.js';
import type { ChatProvider, ChatResponse } from '../providers/types.js';
import { HeuristicBuyer } from './heuristic.js';
import { type Action, type BuyerPolicy, type DecideContext, seenBlocks, seenElements } from './policy.js';

const LlmAction = z.object({
  action: z.enum(['click', 'fill_form', 'scroll', 'back', 'abandon', 'dismiss']),
  target: z.number().int().optional(),
  fields: z.array(z.object({ target: z.number().int(), value: z.string() })).optional(),
  submit: z.number().int().optional(),
  reason: z.string().min(1).max(400),
  objection: z.string().max(80).optional(),
});

/**
 * The system prompt describes HOW to behave, never what to expect. It contains no
 * variant names, hypotheses or evaluation criteria.
 */
const SYSTEM = `You are role-playing a real prospective customer browsing a website in a web browser.
Stay strictly in character using the persona and story you are given. Act as that person would:
with their budget, patience, technical skill, device and objections. You may give up at any time if
the person would. You only know what is on the screen you are shown.
Never enter real personal or payment data: use only obviously synthetic values
(email <id>@buyers.example.test, phone 555-0100) and only a test card number if the page itself prints one.
Reply with ONE JSON object and nothing else:
{"action":"click|fill_form|scroll|back|abandon|dismiss","target":<element number>,"fields":[{"target":<n>,"value":"..."}],"submit":<n>,"reason":"<first-person, one sentence>","objection":"<short slug if abandoning because of a concern>"}`;

export interface LlmPolicyOptions {
  provider: ChatProvider;
  meter: CostMeter;
  maxTokens?: number;
  onUsage?: (res: ChatResponse) => void;
  onFallback?: (why: string) => void;
}

/** LLM-driven buyer. Falls back to the deterministic buyer on malformed output. */
export class LlmBuyer implements BuyerPolicy {
  readonly name: string;
  private readonly fallback = new HeuristicBuyer();
  constructor(private readonly o: LlmPolicyOptions) {
    this.name = `llm:${o.provider.name}:${o.provider.model}`;
  }

  async decide(ctx: DecideContext): Promise<{ action: Action; meta?: Record<string, unknown> }> {
    const prompt = renderObservation(ctx);
    const req = { system: SYSTEM, messages: [{ role: 'user' as const, content: prompt }], maxTokens: this.o.maxTokens ?? 300 };
    const res = await meteredComplete(this.o.provider, this.o.meter, req, { onUsage: this.o.onUsage }); // Budget/provider errors propagate to the runner.
    const parsed = parseAction(res.text, ctx);
    if (!parsed.ok) {
      this.o.onFallback?.(parsed.error);
      const fb = await this.fallback.decide(ctx);
      return { action: fb.action, meta: { ...fb.meta, llm_fallback: parsed.error } };
    }
    return { action: parsed.action, meta: { tokens_in: res.usage.input_tokens, tokens_out: res.usage.output_tokens } };
  }
}

export function renderObservation(ctx: DecideContext): string {
  const { brief, obs, memory } = ctx;
  const els = seenElements(obs, memory)
    .filter((e) => !e.blocked || e.region === 'dialog')
    .slice(0, 60)
    .map((e) => {
      const bits = [`[${e.idx}] ${e.kind}`, e.text && `"${e.text}"`, e.label && `label="${e.label}"`, e.inputType && `type=${e.inputType}`, e.required && 'required', e.hint && `hint="${e.hint}"`, e.options && `options=${JSON.stringify(e.options)}`, `(${e.region})`];
      return bits.filter(Boolean).join(' ');
    });
  const text = seenBlocks(obs, memory)
    .map((b) => b.text)
    .join(' | ')
    .slice(0, 2500);
  return [
    `PERSONA: ${JSON.stringify(brief.persona)}`,
    `STORY: ${brief.story}`,
    `TASK: ${brief.task}`,
    `STEP ${ctx.step} of at most ${ctx.maxSteps}.`,
    `RECENT ACTIONS: ${memory.actions.slice(-6).map((a) => `${a.kind} ${a.target ?? ''} @${a.url}`).join('; ') || 'none'}`,
    `PAGE: ${obs.title} (${new URL(obs.url).pathname})${obs.modalOpen ? ' — a pop-up dialog is open' : ''}`,
    obs.alerts.length ? `ERRORS ON PAGE: ${obs.alerts.join(' / ')}` : '',
    `VISIBLE TEXT: ${text}`,
    `INTERACTIVE ELEMENTS:\n${els.join('\n')}`,
    `More content below: ${obs.scrollY + obs.viewport.height < obs.scrollHeight - 4 ? 'yes' : 'no'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function parseAction(text: string, ctx: DecideContext): { ok: true; action: Action } | { ok: false; error: string } {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, error: 'no JSON object in response' };
  let raw: unknown;
  try {
    raw = JSON.parse(m[0]);
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  const r = LlmAction.safeParse(raw);
  if (!r.success) return { ok: false, error: `schema: ${r.error.issues[0]?.message ?? 'invalid'}` };
  const a = r.data;
  const exists = (i?: number) => i !== undefined && ctx.obs.elements.some((e) => e.idx === i);
  switch (a.action) {
    case 'click':
      return exists(a.target) ? { ok: true, action: { kind: 'click', idx: a.target as number, reason: a.reason } } : { ok: false, error: 'click target does not exist' };
    case 'dismiss':
      return { ok: true, action: { kind: 'dismiss', idx: exists(a.target) ? a.target : undefined, reason: a.reason } };
    case 'fill_form':
      if (!exists(a.submit) || !a.fields?.length || !a.fields.every((f) => exists(f.target))) return { ok: false, error: 'fill_form references unknown elements' };
      return { ok: true, action: { kind: 'fill_form', fields: a.fields.map((f) => ({ idx: f.target, value: f.value })), submitIdx: a.submit as number, reason: a.reason } };
    case 'scroll':
      return { ok: true, action: { kind: 'scroll', reason: a.reason } };
    case 'back':
      return { ok: true, action: { kind: 'back', reason: a.reason } };
    case 'abandon':
      return { ok: true, action: { kind: 'abandon', reason: a.reason, objection: a.objection } };
  }
}

