import { analyzeRuns, type Analysis } from '../analysis.js';
import type { Population, RunRecord, Task } from '../core/types.js';
import { runSession, type Variant } from '../simulator/session.js';
import {
  check,
  clamp,
  panelScore,
  stars,
  type Check,
  type Emit,
  type PanelResult,
  type Reviewer,
} from './types.js';

export interface UsersOptions {
  root: string;
  sessionId: string;
  population: Population;
  task: Task;
  variants: Variant[];
  maxParallel?: number;
  screenshots?: boolean;
  allowTargetChange?: boolean;
  emit: Emit;
  signal?: AbortSignal;
}

export interface UsersOutcome {
  panel: PanelResult;
  analysis: Analysis;
  runs: RunRecord[];
  sessionDir: string;
}

/** End users: real browser journeys + the full evidence analysis (funnel, friction, auditors, backlog). */
export async function runUsers(o: UsersOptions): Promise<UsersOutcome> {
  const t0 = Date.now();
  const P = 'users' as const;
  const total = o.population.personas.length * o.variants.length;
  const res = await runSession({
    root: o.root,
    sessionId: o.sessionId,
    population: o.population,
    task: o.task,
    variants: o.variants,
    maxParallel: o.maxParallel,
    screenshots: o.screenshots ?? true,
    trace: 'failed',
    allowTargetChange: o.allowTargetChange,
    signal: o.signal,
    onRun: (run, p) => {
      o.emit({ type: 'progress', panel: P, done: p.done, total, label: `${run.variant} ${run.persona_id}` });
      o.emit({
        type: 'log',
        panel: P,
        line: `${run.goal_completed ? '✓' : '✕'} ${run.variant} ${run.persona_id} · ${run.goal_completed ? `${run.steps} steps` : (run.abandon_reason ?? run.status).slice(0, 80)}`,
      });
    },
  });
  const analysis = await analyzeRuns(res.manifest, res.runs);
  const v = analysis.backlog_variant;
  const s = analysis.summaries.find((x) => x.variant === v);
  const ev = (_id: string) =>
    res.runs
      .filter((r) => r.variant === v)
      .slice(0, 3)
      .map((r) => ({ kind: 'run' as const, ref: `${r.run_id}:e0`, excerpt: `${r.segment} · ${r.status}` }));
  const checks: Check[] = [];
  if (s) {
    const pct = (x: number) => Math.round(x * 100);
    checks.push(
      check(P, 'usr.completion', pct(s.completion.rate), 5, ev('c'), {
        rate: `${pct(s.completion.rate)}%`,
        n: s.n,
      }),
    );
    checks.push(
      check(P, 'usr.pricing', pct(s.pricing_found.rate), 2, [], { rate: `${pct(s.pricing_found.rate)}%` }),
    );
    const cta = s.funnel.find((f) => f.stage === 'cta_discovered');
    checks.push(check(P, 'usr.cta', pct(cta?.rate ?? 0), 3, [], { rate: `${pct(cta?.rate ?? 0)}%` }));
    checks.push(
      check(P, 'usr.errors', 100 - pct(s.error_rate.rate), 2, [], { rate: `${pct(s.error_rate.rate)}%` }),
    );
    checks.push(
      check(P, 'usr.friction', clamp(100 - s.friction_events_per_buyer * 25), 2, [], {
        per: s.friction_events_per_buyer.toFixed(2),
      }),
    );
    const steps = s.median_steps_to_goal;
    checks.push(
      check(P, 'usr.effort', steps === null ? null : clamp(130 - steps * 10), 2, [], { steps: steps ?? '—' }),
    );
    if (analysis.comparison) {
      const d = analysis.comparison.headline.delta;
      checks.push(
        check(P, 'usr.delta', clamp(50 + d * 100), 2, [], {
          delta: `${d >= 0 ? '+' : ''}${Math.round(d * 100)} pp`,
          label: analysis.comparison.label,
        }),
      );
    }
  }
  // Reviewers = customer segments: each archetype's completion on the shipped version.
  const reviewers: Reviewer[] = (s?.segments ?? []).map((g) => ({
    id: g.archetype,
    archetype: g.archetype,
    score: Math.round(g.completion.rate * 100),
  }));
  const score = panelScore(checks);
  return {
    panel: { id: P, score, stars: stars(score), share: 0, reviewers, checks, duration_ms: Date.now() - t0 },
    analysis,
    runs: res.runs,
    sessionDir: res.dir,
  };
}
