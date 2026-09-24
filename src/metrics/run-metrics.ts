import { FUNNEL, type JourneyEvent, type Milestone, type RunRecord } from '../core/types.js';
import { median, wilson, type Rate } from './stats.js';

/** Facts computed from a single journey. No interpretation happens here. */
export interface RunMetrics {
  run_id: string;
  variant: string;
  persona_id: string;
  segment: string;
  archetype: string;
  status: RunRecord['status'];
  goal_completed: boolean;
  abandoned: boolean;
  steps: number;
  elapsed_ms: number;
  steps_to_goal: number | null;
  time_to_goal_ms: number | null;
  milestones: Record<Milestone, boolean>;
  navigation_loops: number;
  repeated_actions: number;
  dead_ends: number;
  browser_errors: number;
  failed_forms: number;
  modal_interruptions: number;
  backtracks: number;
  objection?: string;
}

const pathOf = (u: string) => {
  try {
    return new URL(u).pathname;
  } catch {
    return u;
  }
};

export function computeRunMetrics(run: RunRecord): RunMetrics {
  const ev = run.events;
  const count = (t: JourneyEvent['type']) => ev.filter((e) => e.type === t).length;

  // A loop = returning to a page already visited earlier in the journey (A → B → A), counted once per revisit.
  const paths = run.url_history.map(pathOf);
  let loops = 0;
  for (let i = 2; i < paths.length; i++)
    if (paths.slice(0, i - 1).includes(paths[i] as string) && paths[i] !== paths[i - 1]) loops++;

  // Same decision on the same target twice in a row.
  const decisions = ev.filter((e) => e.type === 'decision');
  let repeated = 0;
  for (let i = 1; i < decisions.length; i++) {
    const a = decisions[i - 1] as JourneyEvent;
    const b = decisions[i] as JourneyEvent;
    if (a.target && a.target === b.target && a.url === b.url) repeated++;
  }

  const goalEvent = ev.find((e) => e.type === 'goal_complete');
  const milestones = Object.fromEntries(FUNNEL.map((m) => [m, run.milestones[m] !== undefined])) as Record<
    Milestone,
    boolean
  >;
  return {
    run_id: run.run_id,
    variant: run.variant,
    persona_id: run.persona_id,
    segment: run.segment,
    archetype: run.archetype,
    status: run.status,
    goal_completed: run.goal_completed,
    abandoned: !run.goal_completed && run.status !== 'error' && run.status !== 'budget_exhausted',
    steps: run.steps,
    elapsed_ms: run.elapsed_ms,
    steps_to_goal: goalEvent ? goalEvent.step : null,
    time_to_goal_ms: goalEvent ? goalEvent.t : null,
    milestones,
    navigation_loops: loops,
    repeated_actions: repeated,
    dead_ends: ev.filter((e) => e.type === 'http_error' && (e.data?.status === 404 || e.data?.status === 410))
      .length,
    browser_errors:
      count('console_error') +
      count('page_error') +
      count('request_failed') +
      ev.filter((e) => e.type === 'http_error' && Number(e.data?.status) >= 500).length,
    failed_forms: count('form_error'),
    modal_interruptions: count('dismiss_modal'),
    backtracks: count('back'),
    objection: run.objection,
  };
}

export interface FunnelStage {
  stage: Milestone;
  count: number;
  rate: number;
}

export interface SegmentSummary {
  segment: string;
  archetype: string;
  n: number;
  completed: number;
  completion: Rate;
  median_steps: number | null;
  top_abandon_reason?: string;
  top_abandon_i18n?: { k: string; p?: Record<string, string | number> };
}

export interface VariantSummary {
  variant: string;
  n: number;
  completion: Rate;
  abandonment: Rate;
  pricing_found: Rate;
  error_rate: Rate;
  median_steps: number | null;
  median_steps_to_goal: number | null;
  median_time_to_goal_ms: number | null;
  friction_events_per_buyer: number;
  funnel: FunnelStage[];
  segments: SegmentSummary[];
  totals: {
    browser_errors: number;
    failed_forms: number;
    navigation_loops: number;
    dead_ends: number;
    modal_interruptions: number;
    repeated_actions: number;
  };
}

/** Friction events: every observable signal that a buyer struggled. */
export const frictionCount = (m: RunMetrics) =>
  m.navigation_loops +
  m.repeated_actions +
  m.dead_ends +
  m.failed_forms +
  m.modal_interruptions +
  m.backtracks +
  (m.abandoned ? 1 : 0);

export function summarizeVariant(variant: string, metrics: RunMetrics[], runs: RunRecord[]): VariantSummary {
  const ms = metrics.filter((m) => m.variant === variant);
  const n = ms.length;
  const k = (f: (m: RunMetrics) => boolean) => ms.filter(f).length;
  const sum = (f: (m: RunMetrics) => number) => ms.reduce((s, m) => s + f(m), 0);
  const segKeys = [...new Set(ms.map((m) => `${m.archetype}\u0000${m.segment}`))];
  const reasonOf = (id: string) => runs.find((r) => r.run_id === id)?.abandon_reason;
  return {
    variant,
    n,
    completion: wilson(
      k((m) => m.goal_completed),
      n,
    ),
    abandonment: wilson(
      k((m) => m.abandoned),
      n,
    ),
    pricing_found: wilson(
      k((m) => m.milestones.pricing_found),
      n,
    ),
    error_rate: wilson(
      k((m) => m.browser_errors > 0),
      n,
    ),
    median_steps: median(ms.map((m) => m.steps)),
    median_steps_to_goal: median(ms.flatMap((m) => (m.steps_to_goal === null ? [] : [m.steps_to_goal]))),
    median_time_to_goal_ms: median(
      ms.flatMap((m) => (m.time_to_goal_ms === null ? [] : [m.time_to_goal_ms])),
    ),
    friction_events_per_buyer: n ? sum(frictionCount) / n : 0,
    // Funnel reach is monotone: a buyer who reached a later stage counts as having passed earlier ones
    // (e.g. a site without a checkout step). Raw milestone rates stay available via `pricing_found` etc.
    funnel: FUNNEL.map((stage, i) => {
      const reached = (m: RunMetrics) => FUNNEL.slice(i).some((s) => m.milestones[s]);
      return { stage, count: k(reached), rate: n ? k(reached) / n : 0 };
    }),
    segments: segKeys.map((key) => {
      const [archetype, segment] = key.split('\u0000') as [string, string];
      const g = ms.filter((m) => m.archetype === archetype);
      const raw = g.filter((m) => !m.goal_completed).map((m) => reasonOf(m.run_id) ?? 'unknown');
      const top = mode(raw.map(normalizeReason));
      return {
        segment,
        archetype,
        n: g.length,
        completed: g.filter((m) => m.goal_completed).length,
        completion: wilson(g.filter((m) => m.goal_completed).length, g.length),
        median_steps: median(g.map((m) => m.steps)),
        // Group by normalised reason, but show a real example so the text stays readable.
        top_abandon_reason: top === undefined ? undefined : raw.find((r) => normalizeReason(r) === top),
        top_abandon_i18n:
          top === undefined
            ? undefined
            : runs.find(
                (r) =>
                  r.archetype === archetype &&
                  r.variant === variant &&
                  !r.goal_completed &&
                  normalizeReason(r.abandon_reason) === top,
              )?.abandon_i18n,
      };
    }),
    totals: {
      browser_errors: sum((m) => m.browser_errors),
      failed_forms: sum((m) => m.failed_forms),
      navigation_loops: sum((m) => m.navigation_loops),
      dead_ends: sum((m) => m.dead_ends),
      modal_interruptions: sum((m) => m.modal_interruptions),
      repeated_actions: sum((m) => m.repeated_actions),
    },
  };
}

/** Collapse per-persona numbers in reasons so identical causes group together. */
export const normalizeReason = (r?: string) => (r ?? 'unknown').replace(/\d+(\.\d+)?/g, '#');

function mode(xs: string[]): string | undefined {
  const c = new Map<string, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}
