import { spawn } from 'node:child_process';
import { z } from 'zod';
import {
  EventType,
  RunStatus,
  type BuyerBrief,
  type JourneyEvent,
  type RunRecord,
  type Task,
} from '../core/types.js';

/**
 * Adapter boundary for execution engines that drive their own browser — e.g. Browser Use
 * (Python) or Browser Harness. Buyer Arena launches the user-supplied command once per
 * journey, writes a JSON request to stdin and expects a JSON result on stdout.
 *
 * Contract (see docs/INTEGRATIONS.md):
 *   stdin  → { brief, task, max_steps, timeout_ms }
 *   stdout ← { status, final_url, abandon_reason?, objection?, events: [{ type, url, t?, step?, target?, detail? }] }
 *
 * The engine only reports what happened; ids, milestones and metrics are assigned by
 * Buyer Arena so evidence stays uniform across engines. The brief is the same
 * allow-listed brief the built-in buyers receive — no variant or hypothesis leaks.
 */
const ExternalResult = z.object({
  status: RunStatus,
  final_url: z.string(),
  abandon_reason: z.string().optional(),
  objection: z.string().optional(),
  events: z
    .array(
      z.object({
        type: EventType,
        url: z.string(),
        t: z.number().nonnegative().optional(),
        step: z.number().int().nonnegative().optional(),
        target: z.string().optional(),
        detail: z.string().optional(),
      }),
    )
    .max(2000),
});

export interface ExternalJourneyOptions {
  command: string;
  brief: BuyerBrief;
  task: Task;
  runId: string;
  sessionId: string;
  variant: string;
  segment: string;
  archetype: string;
  maxSteps: number;
  timeoutMs: number;
}

export async function runExternalJourney(o: ExternalJourneyOptions): Promise<RunRecord> {
  const started = Date.now();
  const raw = await new Promise<string>((resolve, reject) => {
    const child = spawn(o.command, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`external engine timed out after ${o.timeoutMs}ms`));
    }, o.timeoutMs);
    child.stdout.on('data', (d: Buffer) => {
      out += d.toString();
      if (out.length > 5_000_000) child.kill();
    });
    child.stderr.on('data', (d: Buffer) => (err += d.toString().slice(0, 2000)));
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`external engine exited with ${code}: ${err.trim().slice(0, 300)}`));
    });
    child.stdin.end(
      JSON.stringify({ brief: o.brief, task: o.task, max_steps: o.maxSteps, timeout_ms: o.timeoutMs }),
    );
  }).catch((e: unknown) => e as Error);

  const fail = (detail: string): RunRecord =>
    record(o, started, 'error', o.brief.start_url, [{ type: 'error', url: o.brief.start_url, detail }]);
  if (raw instanceof Error) return fail(raw.message);
  let parsed: z.infer<typeof ExternalResult>;
  try {
    parsed = ExternalResult.parse(JSON.parse(raw.slice(raw.indexOf('{'))));
  } catch (e) {
    return fail(
      `external engine returned invalid result: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`,
    );
  }
  const successRe = o.task.success.url_pattern ? new RegExp(o.task.success.url_pattern, 'i') : undefined;
  const completed = parsed.status === 'completed' || Boolean(successRe?.test(parsed.final_url));
  return record(
    o,
    started,
    completed ? 'completed' : parsed.status,
    parsed.final_url,
    parsed.events,
    parsed.abandon_reason,
    parsed.objection,
  );
}

function record(
  o: ExternalJourneyOptions,
  started: number,
  status: RunRecord['status'],
  finalUrl: string,
  evs: {
    type: JourneyEvent['type'];
    url: string;
    t?: number;
    step?: number;
    target?: string;
    detail?: string;
  }[],
  abandon_reason?: string,
  objection?: string,
): RunRecord {
  const events: JourneyEvent[] = evs.map((e, i) => ({
    id: `${o.runId}:e${i}`,
    seq: i,
    step: e.step ?? 0,
    t: e.t ?? 0,
    type: e.type,
    url: e.url,
    target: e.target,
    detail: e.detail,
  }));
  if (status === 'completed' && !events.some((e) => e.type === 'goal_complete')) {
    events.push({
      id: `${o.runId}:e${events.length}`,
      seq: events.length,
      step: events.at(-1)?.step ?? 0,
      t: Date.now() - started,
      type: 'goal_complete',
      url: finalUrl,
    });
  }
  const milestones: Record<string, number> = { landed: 0 };
  for (const e of events) {
    if (e.type === 'milestone' && e.target && milestones[e.target] === undefined)
      milestones[e.target] = e.step;
    if (e.type === 'goal_complete') milestones.goal_completed = e.step;
  }
  return {
    run_id: o.runId,
    session_id: o.sessionId,
    variant: o.variant,
    persona_id: o.brief.persona.persona_id,
    segment: o.segment,
    archetype: o.archetype,
    policy: `external:${o.command.split(/\s+/)[0] ?? 'engine'}`,
    status,
    goal_completed: status === 'completed',
    abandon_reason: status === 'completed' ? undefined : abandon_reason,
    objection,
    steps: Math.min(o.maxSteps, Math.max(0, ...events.map((e) => e.step))),
    elapsed_ms: Date.now() - started,
    started_at: new Date(started).toISOString(),
    final_url: finalUrl,
    url_history: events.filter((e) => e.type === 'navigate').map((e) => e.url),
    milestones,
    events,
  };
}
