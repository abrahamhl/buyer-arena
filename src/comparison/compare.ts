import type { RunRecord } from '../core/types.js';
import type { FrictionCluster } from '../metrics/friction.js';
import { frictionCount, type RunMetrics, type VariantSummary } from '../metrics/run-metrics.js';
import { median, pairedBootstrap, signalLabel, type DeltaEstimate, type SignalLabel } from '../metrics/stats.js';

export interface ComparisonRow {
  metric: string;
  unit: 'pct' | 'count' | 'steps' | 'ms';
  baseline: number | null;
  candidate: number | null;
  delta: number | null;
  /** Paired bootstrap 95% interval for the delta (rates and per-buyer counts). */
  ci?: [number, number];
  /** +1 if higher is better, −1 if lower is better. */
  better: 1 | -1;
  verdict: 'improved' | 'regressed' | 'unchanged';
}

export interface SegmentDelta {
  segment: string;
  archetype: string;
  n: number;
  baseline: number;
  candidate: number;
  delta: number;
}

export interface FrictionDiff {
  code: string;
  title: string;
  status: 'resolved' | 'persisting' | 'new';
  baseline_affected: number;
  candidate_affected: number;
}

export interface Comparison {
  baseline: string;
  candidate: string;
  n_pairs: number;
  label: SignalLabel;
  headline: DeltaEstimate;
  rows: ComparisonRow[];
  segments: SegmentDelta[];
  friction: FrictionDiff[];
  caveats: string[];
}

/**
 * Compare two variants on the SAME personas. Only personas with a finished run on both
 * sides are paired; the rest are excluded and reported.
 */
export function compareVariants(
  baseline: string,
  candidate: string,
  metrics: RunMetrics[],
  summaries: VariantSummary[],
  clusters: FrictionCluster[],
  runs: RunRecord[],
): Comparison {
  const byPersona = (v: string) => new Map(metrics.filter((m) => m.variant === v && m.status !== 'error' && m.status !== 'budget_exhausted').map((m) => [m.persona_id, m]));
  const A = byPersona(baseline);
  const B = byPersona(candidate);
  const ids = [...A.keys()].filter((id) => B.has(id)).sort();
  const pairs = ids.map((id) => [A.get(id) as RunMetrics, B.get(id) as RunMetrics] as const);
  const boot = (f: (m: RunMetrics) => number, seed: number) => pairedBootstrap(pairs.map(([a, b]) => [f(a), f(b)]), 2000, seed);

  const sA = summaries.find((s) => s.variant === baseline);
  const sB = summaries.find((s) => s.variant === candidate);
  const headline = boot((m) => (m.goal_completed ? 1 : 0), 11);

  const rateRow = (metric: string, f: (m: RunMetrics) => boolean, better: 1 | -1, seed: number): ComparisonRow => {
    const e = boot((m) => (f(m) ? 1 : 0), seed);
    const a = pairs.length ? pairs.filter(([x]) => f(x)).length / pairs.length : null;
    const b = pairs.length ? pairs.filter(([, y]) => f(y)).length / pairs.length : null;
    return row(metric, 'pct', a, b, better, [e.lo, e.hi]);
  };
  const perBuyer = (metric: string, f: (m: RunMetrics) => number, better: 1 | -1, seed: number): ComparisonRow => {
    const e = boot(f, seed);
    const mean = (side: 0 | 1) => (pairs.length ? pairs.reduce((s, p) => s + f(p[side]), 0) / pairs.length : null);
    return row(metric, 'count', mean(0), mean(1), better, [e.lo, e.hi]);
  };

  const rows: ComparisonRow[] = [
    rateRow('Goal completion', (m) => m.goal_completed, 1, 11),
    rateRow('Abandonment', (m) => m.abandoned, -1, 12),
    rateRow('Pricing found', (m) => m.milestones.pricing_found, 1, 13),
    rateRow('Reached sign-up', (m) => m.milestones.signup_started, 1, 14),
    rateRow('Runs with browser errors', (m) => m.browser_errors > 0, -1, 15),
    perBuyer('Friction events / buyer', frictionCount, -1, 16),
    row('Median steps (all journeys)', 'steps', median(pairs.map(([a]) => a.steps)), median(pairs.map(([, b]) => b.steps)), -1),
    row(
      'Median steps to goal',
      'steps',
      median(pairs.flatMap(([a]) => (a.steps_to_goal === null ? [] : [a.steps_to_goal]))),
      median(pairs.flatMap(([, b]) => (b.steps_to_goal === null ? [] : [b.steps_to_goal]))),
      -1,
    ),
    row('Median time to goal', 'ms', sA?.median_time_to_goal_ms ?? null, sB?.median_time_to_goal_ms ?? null, -1),
  ];

  const segKeys = [...new Set(pairs.map(([a]) => `${a.archetype}\u0000${a.segment}`))];
  const segments = segKeys.map((k) => {
    const [archetype, segment] = k.split('\u0000') as [string, string];
    const g = pairs.filter(([a]) => a.archetype === archetype);
    const ra = g.filter(([a]) => a.goal_completed).length / g.length;
    const rb = g.filter(([, b]) => b.goal_completed).length / g.length;
    return { segment, archetype, n: g.length, baseline: ra, candidate: rb, delta: rb - ra };
  });

  const codes = [...new Set(clusters.filter((c) => c.variant === baseline || c.variant === candidate).map((c) => c.code))];
  const friction = codes
    .map((code) => {
      const a = clusters.find((c) => c.variant === baseline && c.code === code);
      const b = clusters.find((c) => c.variant === candidate && c.code === code);
      return {
        code,
        title: (a ?? b)?.title ?? code,
        status: (!b ? 'resolved' : !a ? 'new' : 'persisting') as FrictionDiff['status'],
        baseline_affected: a?.affected ?? 0,
        candidate_affected: b?.affected ?? 0,
      };
    })
    .sort((x, y) => y.baseline_affected + y.candidate_affected - (x.baseline_affected + x.candidate_affected));

  const excluded = new Set([...A.keys(), ...B.keys()]).size - ids.length;
  const policies = [...new Set(runs.map((r) => r.policy))];
  const caveats = [
    'CONVERSION PROXY: synthetic goal completion is a behavioural proxy, not a prediction of real conversion or revenue.',
    `Sample: ${ids.length} paired synthetic buyers. ${ids.length < 30 ? 'Below 30 pairs every delta is an EXPLORATORY SIGNAL.' : ''}`.trim(),
    'Intervals: paired percentile bootstrap (2,000 resamples, seeded) over personas; they describe variability within this synthetic population only.',
    policies.includes('heuristic')
      ? 'Buyer policy "heuristic" is deterministic: repeated runs give identical journeys, so intervals reflect persona diversity, not behavioural randomness.'
      : `Buyer policy: ${policies.join(', ')}.`,
  ];
  if (excluded > 0) caveats.push(`${excluded} persona(s) without a finished run on both variants were excluded from pairing.`);

  return { baseline, candidate, n_pairs: ids.length, label: signalLabel(ids.length, headline.lo, headline.hi), headline, rows, segments, friction, caveats };
}

function row(metric: string, unit: ComparisonRow['unit'], a: number | null, b: number | null, better: 1 | -1, ci?: [number, number]): ComparisonRow {
  const delta = a === null || b === null ? null : b - a;
  const eps = unit === 'pct' ? 0.005 : 0.05;
  const verdict = delta === null || Math.abs(delta) < eps ? 'unchanged' : delta * better > 0 ? 'improved' : 'regressed';
  return { metric, unit, baseline: a, candidate: b, delta, ci, better, verdict };
}
