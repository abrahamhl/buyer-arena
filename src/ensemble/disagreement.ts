import type { Analysis } from '../analysis.js';
import type { RunRecord } from '../core/types.js';

/**
 * EXPERIMENTAL — multi-buyer comparison on identical tasks (heuristic vs model A vs model B…).
 *
 * Agreement between models is NOT truth: it is reported as disagreement, next to (never
 * merged with) the other uncertainty sources:
 *   population uncertainty  — sampling of synthetic personas (bootstrap interval width)
 *   run variance            — same buyer, repeated sessions (only if repeats are given)
 *   model disagreement      — different buyers, same persona × variant
 *   calibration error       — distance to real aggregates (only if calibration exists)
 */
export interface EnsembleMember {
  label: string;
  analysis: Analysis;
  runs: RunRecord[];
  /** Optional repeats of the SAME buyer configuration (seed/run variance). */
  repeats?: Analysis[];
  calibration_mae?: number | null;
}

export interface PairAgreement {
  a: string;
  b: string;
  pairs: number;
  completion_agreement: number;
  /** Cohen's kappa on goal completion (null when undefined, e.g. no variation). */
  kappa: number | null;
  decision_agreement: number;
  friction_jaccard: number | null;
  trajectory_divergence: number;
}

export interface EnsembleReport {
  experimental: true;
  members: {
    label: string;
    buyer: string;
    completion: number;
    population_ci_width: number | null;
    run_variance: number | null;
    cost_usd: number;
    avg_latency_ms: number | null;
    calibration_mae: number | null;
  }[];
  pairs: PairAgreement[];
  model_disagreement: number | null;
  notes: string[];
}

const key = (r: { variant: string; persona_id: string }) => `${r.variant}\u0000${r.persona_id}`;

/** Normalised Levenshtein distance between two path sequences (0 = identical, 1 = disjoint). */
export function sequenceDistance(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 0;
  const d: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0] as number;
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j] as number;
      d[j] = Math.min((d[j] as number) + 1, (d[j - 1] as number) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return (d[b.length] as number) / Math.max(a.length, b.length);
}

export function cohenKappa(x: boolean[], y: boolean[]): number | null {
  const n = x.length;
  if (!n) return null;
  let agree = 0;
  let px = 0;
  let py = 0;
  for (let i = 0; i < n; i++) {
    if (x[i] === y[i]) agree++;
    if (x[i]) px++;
    if (y[i]) py++;
  }
  const po = agree / n;
  const pe = (px / n) * (py / n) + (1 - px / n) * (1 - py / n);
  return pe === 1 ? null : (po - pe) / (1 - pe);
}

const pathSeq = (r: RunRecord) =>
  r.url_history.map((u) => {
    try {
      return new URL(u).pathname;
    } catch {
      return u;
    }
  });

/** Decision = how the journey ended: completed, or the abandonment objection / status. */
const decisionOf = (r: RunRecord) => (r.goal_completed ? 'completed' : (r.objection ?? r.status));

function frictionByRun(a: Analysis): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const c of a.clusters)
    for (const run of c.affected_runs) {
      const s = m.get(run) ?? new Set<string>();
      s.add(c.code);
      m.set(run, s);
    }
  return m;
}

export function compareEnsemble(members: EnsembleMember[]): EnsembleReport {
  const notes = [
    'EXPERIMENTAL. Agreement between buyers is a consistency signal, not ground truth.',
    'Uncertainty sources are reported separately and never combined into one confidence number.',
  ];
  const pairs: PairAgreement[] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const A = members[i] as EnsembleMember;
      const B = members[j] as EnsembleMember;
      const byB = new Map(B.runs.map((r) => [key(r), r]));
      const fa = frictionByRun(A.analysis);
      const fb = frictionByRun(B.analysis);
      const xs: boolean[] = [];
      const ys: boolean[] = [];
      let decisions = 0;
      let jac = 0;
      let jacN = 0;
      let div = 0;
      for (const ra of A.runs) {
        const rb = byB.get(key(ra));
        if (!rb) continue;
        xs.push(ra.goal_completed);
        ys.push(rb.goal_completed);
        if (decisionOf(ra) === decisionOf(rb)) decisions++;
        const sa = fa.get(ra.run_id) ?? new Set();
        const sb = fb.get(rb.run_id) ?? new Set();
        const union = new Set([...sa, ...sb]);
        if (union.size) {
          jac += [...sa].filter((c) => sb.has(c)).length / union.size;
          jacN++;
        }
        div += sequenceDistance(pathSeq(ra), pathSeq(rb));
      }
      const n = xs.length;
      pairs.push({
        a: A.label,
        b: B.label,
        pairs: n,
        completion_agreement: n ? xs.filter((x, k) => x === ys[k]).length / n : 0,
        kappa: cohenKappa(xs, ys),
        decision_agreement: n ? decisions / n : 0,
        friction_jaccard: jacN ? jac / jacN : null,
        trajectory_divergence: n ? div / n : 0,
      });
    }
  }
  if (pairs.some((p) => p.pairs === 0))
    notes.push('Some pairs share no persona × variant: they were not run on identical tasks.');
  const rate = (a: Analysis) => {
    const s = a.summaries.find((x) => x.variant === a.backlog_variant) ?? a.summaries[0];
    return s ? s.completion.rate : 0;
  };
  return {
    experimental: true,
    members: members.map((m) => {
      const s =
        m.analysis.summaries.find((x) => x.variant === m.analysis.backlog_variant) ?? m.analysis.summaries[0];
      const usage = m.analysis.session.usage;
      const calls = usage.reduce((t, u) => t + u.calls, 0);
      const reps = m.repeats?.map(rate) ?? [];
      const mean = reps.length ? reps.reduce((t, x) => t + x, 0) / reps.length : 0;
      return {
        label: m.label,
        buyer: m.analysis.session.buyer,
        completion: rate(m.analysis),
        population_ci_width: s ? s.completion.hi - s.completion.lo : null,
        run_variance:
          reps.length >= 2 ? reps.reduce((t, x) => t + (x - mean) ** 2, 0) / (reps.length - 1) : null,
        cost_usd: usage.reduce((t, u) => t + u.estimated_cost_usd, 0),
        avg_latency_ms: calls ? usage.reduce((t, u) => t + u.latency_ms, 0) / calls : null,
        calibration_mae: m.calibration_mae ?? null,
      };
    }),
    pairs,
    model_disagreement: pairs.length
      ? 1 - pairs.reduce((t, p) => t + p.completion_agreement, 0) / pairs.length
      : null,
    notes,
  };
}
