import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { JourneyEvent, Milestone, RunRecord } from '../src/core/types.js';
import type { SessionManifest } from '../src/simulator/session.js';

export const tmp = (prefix = 'ba-') => mkdtempSync(join(tmpdir(), prefix));

type Ev = Partial<JourneyEvent> & { type: JourneyEvent['type'] };

/** Build a RunRecord from a compact event list. Ids follow the real `<run>:e<n>` format. */
export function fakeRun(
  o: {
    variant: string;
    persona: string;
    segment?: string;
    archetype?: string;
    completed?: boolean;
    status?: RunRecord['status'];
    objection?: string;
    reason?: string;
    milestones?: Milestone[];
  },
  events: Ev[],
): RunRecord {
  const run_id = `${o.variant}-${o.persona}`;
  const evs: JourneyEvent[] = events.map((e, i) => ({
    id: `${run_id}:e${i}`,
    seq: i,
    step: e.step ?? i,
    t: i * 10,
    url: e.url ?? 'http://x.test/',
    ...e,
  }));
  const milestones: Record<string, number> = {};
  for (const m of o.milestones ?? ['landed']) milestones[m] = 0;
  if (o.completed) milestones.goal_completed = evs.length;
  return {
    run_id,
    session_id: 's',
    variant: o.variant,
    persona_id: o.persona,
    segment: o.segment ?? 'Seg A',
    archetype: o.archetype ?? 'a',
    policy: 'heuristic',
    status: o.status ?? (o.completed ? 'completed' : 'abandoned'),
    goal_completed: Boolean(o.completed),
    abandon_reason: o.reason,
    objection: o.objection,
    steps: Math.max(1, evs.at(-1)?.step ?? 1),
    elapsed_ms: 100,
    started_at: new Date(0).toISOString(),
    final_url: 'http://x.test/',
    url_history: evs.filter((e) => e.type === 'navigate').map((e) => e.url),
    milestones,
    events: evs,
  };
}

export const completedRun = (variant: string, persona: string, segment = 'Seg A', archetype = 'a') =>
  fakeRun(
    {
      variant,
      persona,
      segment,
      archetype,
      completed: true,
      milestones: ['landed', 'pricing_found', 'signup_started'],
    },
    [
      { type: 'navigate', url: 'http://x.test/' },
      { type: 'decision', detail: 'Looking for a way to get started' },
      { type: 'navigate', url: 'http://x.test/signup' },
      { type: 'goal_complete' },
    ],
  );

export const pricingFailRun = (variant: string, persona: string, segment = 'Seg B', archetype = 'b') =>
  fakeRun({ variant, persona, segment, archetype, reason: 'Could not find what this costs. Leaving.' }, [
    { type: 'navigate', url: 'http://x.test/' },
    { type: 'decision', detail: 'Looking for the price; trying "Product".' },
    { type: 'navigate', url: 'http://x.test/features' },
    { type: 'decision', detail: 'Nothing about the price here yet; scrolling down.' },
    { type: 'abandon', detail: 'Could not find what this costs. Leaving.' },
  ]);

export const phoneRun = (variant: string, persona: string, segment = 'Seg C', archetype = 'c') =>
  fakeRun(
    {
      variant,
      persona,
      segment,
      archetype,
      objection: 'no-phone-number',
      reason: 'They require my phone number.',
      milestones: ['landed', 'signup_started'],
    },
    [
      { type: 'navigate', url: 'http://x.test/signup' },
      { type: 'objection', target: 'no-phone-number' },
      { type: 'abandon', detail: 'They require my phone number.' },
    ],
  );

export function fakeManifest(variants: string[]): SessionManifest {
  return {
    session_id: 'test-session',
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    template: 'saas',
    seed: 1,
    population_size: 10,
    task: { id: 't', instruction: 'x', success: { text_pattern: 'done' }, checkout_url_pattern: 'checkout' },
    variants: variants.map((name) => ({ name, url: `http://${name}.test/` })),
    buyer: 'heuristic',
    limits: { maxBuyers: 10, maxParallel: 1, timeoutMs: 1000 },
    status: 'complete',
    runs_total: 10,
    runs_done: 10,
    usage: [],
  };
}
