import type { JourneyEvent, RunRecord, Severity } from '../core/types.js';
import type { RunMetrics } from './run-metrics.js';
import { median } from './stats.js';

/** One observed friction signal in one journey, with the events that prove it. */
export interface FrictionSignal {
  code: string;
  run_id: string;
  variant: string;
  segment: string;
  archetype: string;
  blocking: boolean;
  evidence_ids: string[];
  detail: string;
}

export interface FrictionCluster {
  code: string;
  title: string;
  lens: ('ux' | 'business' | 'engineering' | 'customer')[];
  severity: Severity;
  variant: string;
  affected_runs: string[];
  affected: number;
  population: number;
  blocking_runs: number;
  segments: Record<string, number>;
  evidence_ids: string[];
  examples: string[];
}

interface Detector {
  code: string;
  title: string;
  lens: FrictionCluster['lens'];
  severity: Severity;
  detect(
    run: RunRecord,
    m: RunMetrics,
    ctx: { medianSteps: number | null },
  ): { evidence: JourneyEvent[]; detail: string } | null;
}

const lastDecisions = (run: RunRecord, n = 3) => run.events.filter((e) => e.type === 'decision').slice(-n);
const ofType = (run: RunRecord, ...t: JourneyEvent['type'][]) => run.events.filter((e) => t.includes(e.type));
const abandonEv = (run: RunRecord) =>
  run.events.filter((e) => e.type === 'abandon' || e.type === 'objection');
const byObjection = (slug: RegExp) => (run: RunRecord) =>
  run.objection && slug.test(run.objection)
    ? { evidence: abandonEv(run), detail: run.abandon_reason ?? run.objection }
    : null;

/**
 * Deterministic detectors. Each one reads recorded events only; a detector that cannot
 * point at events does not fire.
 */
export const DETECTORS: Detector[] = [
  {
    code: 'pricing_not_found',
    title: 'Buyers could not find pricing',
    lens: ['ux', 'business', 'customer'],
    severity: 'high',
    detect: (run, m) => {
      if (m.milestones.pricing_found || m.goal_completed) return null;
      const looked = run.events.filter((e) => e.type === 'decision' && /price/i.test(e.detail ?? ''));
      if (looked.length === 0) return null;
      return {
        evidence: [...looked.slice(-3), ...abandonEv(run)],
        detail: `searched for pricing in ${looked.length} decisions without success`,
      };
    },
  },
  {
    code: 'cta_not_found',
    title: 'Buyers could not find how to start',
    lens: ['ux', 'business'],
    severity: 'high',
    detect: (run, m) => {
      if (m.goal_completed || m.milestones.signup_started) return null;
      const looked = run.events.filter(
        (e) => e.type === 'decision' && /get started|how to get started/i.test(e.detail ?? ''),
      );
      if (looked.length === 0) return null;
      return { evidence: [...looked.slice(-3), ...abandonEv(run)], detail: 'never reached a sign-up form' };
    },
  },
  {
    code: 'trust_gap',
    title: 'No refund / guarantee information before commitment',
    lens: ['customer', 'business'],
    severity: 'high',
    detect: byObjection(/refund|guarantee|trust/i),
  },
  {
    code: 'required_phone',
    title: 'Sign-up demands a phone number',
    lens: ['customer', 'ux'],
    severity: 'high',
    detect: byObjection(/phone/i),
  },
  {
    code: 'card_for_trial',
    title: 'Card required to start a free trial',
    lens: ['customer', 'business'],
    severity: 'medium',
    detect: byObjection(/card/i),
  },
  {
    code: 'price_above_budget',
    title: 'Cheapest plan above buyer budget',
    lens: ['business'],
    severity: 'low',
    detect: byObjection(/price-too-high|budget/i),
  },
  {
    code: 'intrusive_modal',
    title: 'Pop-up interrupts the journey',
    lens: ['ux', 'customer'],
    severity: 'medium',
    detect: (run) => {
      const ev = ofType(run, 'dismiss_modal');
      if (ev.length === 0 && !/popup|pop-up/i.test(run.objection ?? '')) return null;
      return {
        evidence: [...ev, ...(/popup/i.test(run.objection ?? '') ? abandonEv(run) : [])],
        detail: `${ev.length} dismissal attempt(s)`,
      };
    },
  },
  {
    code: 'form_validation',
    title: 'Form rejected input (rules not shown up-front)',
    lens: ['ux', 'customer'],
    severity: 'medium',
    detect: (run) => {
      const ev = ofType(run, 'form_error');
      return ev.length ? { evidence: ev, detail: ev.map((e) => e.detail).join(' / ') } : null;
    },
  },
  {
    code: 'navigation_loop',
    title: 'Buyers loop back to pages already visited',
    lens: ['ux'],
    severity: 'low',
    detect: (run, m) => {
      if (m.navigation_loops === 0 && m.backtracks === 0) return null;
      const seen = new Set<string>();
      const revisits = run.events.filter((e) => {
        if (e.type === 'back') return true;
        if (e.type !== 'navigate') return false;
        const p = new URL(e.url).pathname;
        const again = seen.has(p);
        seen.add(p);
        return again;
      });
      return revisits.length
        ? { evidence: revisits, detail: `${m.navigation_loops} revisit(s), ${m.backtracks} back` }
        : null;
    },
  },
  {
    code: 'patience_exhausted',
    title: 'Buyers ran out of patience (step limit)',
    lens: ['ux', 'business'],
    severity: 'medium',
    detect: (run) =>
      run.status === 'step_limit' || run.status === 'timeout'
        ? {
            evidence: [...lastDecisions(run), ...ofType(run, 'abandon', 'timeout')],
            detail: run.abandon_reason ?? run.status,
          }
        : null,
  },
  {
    code: 'js_error',
    title: 'JavaScript errors on the page',
    lens: ['engineering'],
    severity: 'medium',
    detect: (run) => {
      const ev = ofType(run, 'page_error', 'console_error');
      return ev.length ? { evidence: ev, detail: [...new Set(ev.map((e) => e.detail))].join(' / ') } : null;
    },
  },
  {
    code: 'dead_link',
    title: 'Broken links (404)',
    lens: ['engineering', 'ux'],
    severity: 'medium',
    detect: (run) => {
      const ev = run.events.filter(
        (e) => e.type === 'http_error' && (e.data?.status === 404 || e.data?.status === 410),
      );
      return ev.length ? { evidence: ev, detail: ev.map((e) => new URL(e.url).pathname).join(', ') } : null;
    },
  },
  {
    code: 'server_error',
    title: 'Server / network failures',
    lens: ['engineering'],
    severity: 'high',
    detect: (run) => {
      const ev = run.events.filter(
        (e) => e.type === 'request_failed' || (e.type === 'http_error' && Number(e.data?.status) >= 500),
      );
      return ev.length ? { evidence: ev, detail: ev.map((e) => e.detail).join(' / ') } : null;
    },
  },
  {
    code: 'long_journey',
    title: 'Successful journeys take many more steps than typical',
    lens: ['ux'],
    severity: 'low',
    detect: (run, m, ctx) => {
      if (
        !m.goal_completed ||
        ctx.medianSteps === null ||
        m.steps < Math.max(ctx.medianSteps * 1.5, ctx.medianSteps + 3)
      )
        return null;
      return {
        evidence: run.events.filter((e) => e.type === 'decision'),
        detail: `${m.steps} steps vs median ${ctx.medianSteps}`,
      };
    },
  },
  {
    code: 'other_objection',
    title: 'Other buyer objections',
    lens: ['customer'],
    severity: 'medium',
    detect: (run) => {
      if (
        !run.objection ||
        /refund|guarantee|trust|phone|card|price-too-high|budget|popup/i.test(run.objection)
      )
        return null;
      return { evidence: abandonEv(run), detail: `${run.objection}: ${run.abandon_reason ?? ''}` };
    },
  },
];

export function detectFriction(runs: RunRecord[], metrics: RunMetrics[]): FrictionSignal[] {
  const out: FrictionSignal[] = [];
  const medians = new Map<string, number | null>();
  for (const v of new Set(metrics.map((m) => m.variant))) {
    medians.set(v, median(metrics.filter((m) => m.variant === v && m.goal_completed).map((m) => m.steps)));
  }
  for (const run of runs) {
    const m = metrics.find((x) => x.run_id === run.run_id);
    if (!m) continue;
    for (const d of DETECTORS) {
      const hit = d.detect(run, m, { medianSteps: medians.get(run.variant) ?? null });
      if (!hit || hit.evidence.length === 0) continue;
      out.push({
        code: d.code,
        run_id: run.run_id,
        variant: run.variant,
        segment: run.segment,
        archetype: run.archetype,
        blocking: !run.goal_completed,
        evidence_ids: [...new Set(hit.evidence.map((e) => e.id))],
        detail: hit.detail,
      });
    }
  }
  return out;
}

export function clusterFriction(
  signals: FrictionSignal[],
  populationByVariant: Record<string, number>,
): FrictionCluster[] {
  const groups = new Map<string, FrictionSignal[]>();
  for (const s of signals)
    groups.set(`${s.variant}\u0000${s.code}`, [...(groups.get(`${s.variant}\u0000${s.code}`) ?? []), s]);
  const clusters: FrictionCluster[] = [];
  for (const [key, sigs] of groups) {
    const [variant, code] = key.split('\u0000') as [string, string];
    const d = DETECTORS.find((x) => x.code === code);
    if (!d) continue;
    const runsAffected = [...new Set(sigs.map((s) => s.run_id))];
    const segments: Record<string, number> = {};
    for (const r of runsAffected) {
      const s = sigs.find((x) => x.run_id === r) as FrictionSignal;
      segments[s.segment] = (segments[s.segment] ?? 0) + 1;
    }
    clusters.push({
      code,
      title: d.title,
      lens: d.lens,
      severity: d.severity,
      variant,
      affected_runs: runsAffected,
      affected: runsAffected.length,
      population: populationByVariant[variant] ?? runsAffected.length,
      blocking_runs: new Set(sigs.filter((s) => s.blocking).map((s) => s.run_id)).size,
      segments,
      evidence_ids: sigs.flatMap((s) => s.evidence_ids),
      examples: [...new Set(sigs.map((s) => s.detail))].slice(0, 3),
    });
  }
  const sev = { critical: 4, high: 3, medium: 2, low: 1 };
  return clusters.sort(
    (a, b) =>
      b.blocking_runs - a.blocking_runs || b.affected - a.affected || sev[b.severity] - sev[a.severity],
  );
}

/** Evidence index: every event id → event, for validating findings. */
export function buildEvidenceIndex(runs: RunRecord[]): Map<string, JourneyEvent & { run_id: string }> {
  const idx = new Map<string, JourneyEvent & { run_id: string }>();
  for (const r of runs) for (const e of r.events) idx.set(e.id, { ...e, run_id: r.run_id });
  return idx;
}
