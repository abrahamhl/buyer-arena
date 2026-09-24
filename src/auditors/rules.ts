import type { AuditorFinding, Confidence } from '../core/types.js';
import { FUNNEL } from '../core/types.js';
import type { FrictionCluster } from '../metrics/friction.js';
import type { AuditPacket } from './packet.js';
import { playFor } from './playbook.js';

export type AuditorId = 'ux' | 'business' | 'engineering' | 'customer' | 'redteam';

export interface Auditor {
  id: AuditorId;
  name: string;
  mandate: string;
  audit(packet: AuditPacket): AuditorFinding[];
}

const pct = (k: number, n: number) => (n ? `${Math.round((k / n) * 100)}%` : '0%');
const share = (c: FrictionCluster) => `${c.affected}/${c.population}`;
const segs = (c: FrictionCluster) => Object.keys(c.segments);

/** One evidence id per affected run first (breadth), then the rest; capped. */
export function spreadEvidence(c: FrictionCluster, max = 12): string[] {
  const byRun = new Map<string, string[]>();
  for (const id of c.evidence_ids) {
    const run = id.slice(0, id.lastIndexOf(':'));
    byRun.set(run, [...(byRun.get(run) ?? []), id]);
  }
  const out: string[] = [];
  for (let i = 0; out.length < max; i++) {
    let added = false;
    for (const ids of byRun.values()) {
      if (ids[i] && out.length < max) {
        out.push(ids[i] as string);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}

function confidenceFor(c: FrictionCluster): Confidence {
  const r = c.affected / Math.max(1, c.population);
  if (c.affected >= 5 && r >= 0.2) return 'high';
  if (c.affected >= 3) return 'medium';
  return 'low';
}

const fromCluster = (
  c: FrictionCluster,
  finding: string,
  overrides: Partial<AuditorFinding> = {},
): AuditorFinding => ({
  finding,
  topic: c.code,
  evidence_ids: spreadEvidence(c),
  affected_segments: segs(c),
  severity: c.severity,
  confidence: confidenceFor(c),
  claim: 'inference',
  proposed_experiment: playFor(c.code).experiment,
  ...overrides,
});

export const UX_AUDITOR: Auditor = {
  id: 'ux',
  name: 'UX / usability',
  mandate: 'Can buyers find, understand and operate the interface?',
  audit(p) {
    const out = p.clusters
      .filter((c) => c.lens.includes('ux'))
      .map((c) =>
        fromCluster(
          c,
          `${c.title} — ${share(c)} buyers showed it; ${c.blocking_runs} ended their journey at it. Likely cause: ${playFor(c.code).likely_cause}.`,
        ),
      );
    return out;
  },
};

export const BUSINESS_AUDITOR: Auditor = {
  id: 'business',
  name: 'Business / conversion',
  mandate: 'Where does the funnel leak, for whom, and what is it worth testing?',
  audit(p) {
    const out: AuditorFinding[] = [];
    // Largest absolute funnel drop between consecutive stages.
    const f = p.summary.funnel;
    let worst = { from: '', to: '', drop: 0 };
    for (let i = 1; i < f.length; i++) {
      const a = f[i - 1];
      const b = f[i];
      if (!a || !b) continue;
      // Stages are not strictly nested (pricing can be skipped); use reach counts.
      const drop = a.count - b.count;
      if (drop > worst.drop) worst = { from: a.stage, to: b.stage, drop };
    }
    if (worst.drop > 0) {
      const fromIdx = FUNNEL.indexOf(worst.from as (typeof FUNNEL)[number]);
      const leaked = p.run_index.filter(
        (r) => r.milestones.includes(worst.from) && !r.milestones.includes(worst.to) && r.abandon_event,
      );
      const reachedLater = FUNNEL.slice(fromIdx + 1);
      const ev = leaked.map((r) => r.abandon_event as string);
      if (ev.length) {
        out.push({
          finding: `Largest funnel leak is ${worst.from} → ${worst.to}: ${worst.drop} of ${p.population} buyers drop here (${pct(worst.drop, p.population)} of the population).`,
          topic: 'funnel_leak',
          params: {
            kind: 'funnel_leak',
            from: `@stage.${worst.from}`,
            to: `@stage.${worst.to}`,
            drop: worst.drop,
            n: p.population,
          },
          evidence_ids: ev.slice(0, 12),
          affected_segments: [...new Set(leaked.map((r) => r.segment))],
          severity: worst.drop / p.population >= 0.25 ? 'high' : 'medium',
          confidence: ev.length >= 4 ? 'high' : 'medium',
          claim: 'observed_fact',
          computed: true,
          proposed_experiment: `Instrument and test the ${worst.from} → ${reachedLater[0] ?? worst.to} step first; it holds the most recoverable buyers.`,
        });
      }
    }
    // Segments that convert far below the population average.
    const overall = p.summary.completion.rate;
    for (const s of p.summary.segments) {
      if (s.n >= 2 && s.completion.rate + 0.25 <= overall) {
        const ev = p.run_index
          .filter((r) => r.segment === s.segment && !r.completed && r.abandon_event)
          .map((r) => r.abandon_event as string);
        if (ev.length) {
          out.push({
            finding: `Segment "${s.segment}" completes ${pct(s.completed, s.n)} vs ${Math.round(overall * 100)}% overall. Most common exit: ${s.top_abandon_reason ?? 'n/a'}`,
            topic: `segment_gap:${s.archetype}`,
            params: {
              kind: 'segment_gap',
              segment: s.segment,
              pct: `${Math.round(s.completion.rate * 100)}%`,
              overall: `${Math.round(overall * 100)}%`,
            },
            evidence_ids: ev,
            affected_segments: [s.segment],
            severity: s.completion.rate === 0 ? 'high' : 'medium',
            confidence: s.n >= 5 ? 'medium' : 'low',
            claim: 'observed_fact',
            computed: true,
            proposed_experiment: `Run a segment-targeted variant for "${s.segment}" addressing: ${(s.top_abandon_reason ?? 'the top exit reason').replace(/\.+$/, '')}.`,
          });
        }
      }
    }
    for (const c of p.clusters.filter((x) => x.lens.includes('business') && x.blocking_runs > 0)) {
      out.push(
        fromCluster(
          c,
          `${c.title}: ${c.blocking_runs}/${c.population} journeys ended at this friction (conversion proxy).`,
        ),
      );
    }
    if (p.comparison) {
      const h = p.comparison.headline;
      const ids = p.run_index.filter((r) => r.abandon_event).map((r) => r.abandon_event as string);
      if (ids.length) {
        out.push({
          finding: `Goal completion ${p.comparison.candidate} vs ${p.comparison.baseline}: ${h.delta >= 0 ? '+' : ''}${Math.round(h.delta * 100)}pp (95% interval ${Math.round(h.lo * 100)} to ${Math.round(h.hi * 100)}pp, n=${p.comparison.n_pairs} pairs) — ${p.comparison.label}.`,
          topic: 'variant_delta',
          params: {
            kind: 'variant_delta',
            candidate: p.comparison.candidate,
            baseline: p.comparison.baseline,
            delta: `${h.delta >= 0 ? '+' : '−'}${Math.abs(Math.round(h.delta * 100))} pp`,
            lo: `${Math.round(h.lo * 100)} pp`,
            hi: `${Math.round(h.hi * 100)} pp`,
            n: p.comparison.n_pairs,
          },
          evidence_ids: ids.slice(0, 8),
          affected_segments: p.comparison.segments.filter((s) => s.delta !== 0).map((s) => s.segment),
          severity: 'medium',
          confidence: p.comparison.n_pairs >= 30 ? 'medium' : 'low',
          claim: 'observed_fact',
          computed: true,
          proposed_experiment:
            'Validate the synthetic delta with a real A/B test before rollout; treat it as a conversion proxy only.',
        });
      }
    }
    return out;
  },
};

export const ENGINEERING_AUDITOR: Auditor = {
  id: 'engineering',
  name: 'Engineering / reliability',
  mandate: 'Did the product behave correctly under real browser journeys?',
  audit(p) {
    return p.clusters
      .filter((c) => c.lens.includes('engineering'))
      .map((c) =>
        fromCluster(
          c,
          `${c.title}: observed in ${share(c)} journeys. ${c.examples[0] ? `Example: ${c.examples[0].slice(0, 160)}` : ''}`.trim(),
          {
            claim: 'observed_fact',
            // An error that fires on every visit is certain even if few buyers reached the page.
            confidence: c.affected >= 2 ? 'high' : 'medium',
          },
        ),
      );
  },
};

/** Findings whose occurrence is set by a parameter of the deterministic buyer (disclosed by the red team). */
const POLICY_DRIVEN: Record<string, string> = {
  pricing_not_found: 'the price-sensitivity threshold (≥0.4) and the literacy/device scroll budget',
  cta_not_found: 'the scroll budget and English CTA keywords',
  patience_exhausted: 'the step budget derived from time pressure (10/14/18 steps)',
  intrusive_modal: 'the pop-up tolerance (gives up after 2 dismissal attempts)',
  form_validation: 'the password-strength rule tied to technical literacy',
};

const OBJECTION_TOPICS = new Set([
  'trust_gap',
  'required_phone',
  'card_for_trial',
  'price_above_budget',
  'other_objection',
]);

export const CUSTOMER_AUDITOR: Auditor = {
  id: 'customer',
  name: 'Customer / objections & comprehension',
  mandate: 'What did buyers not understand, and which concerns stopped them?',
  audit(p) {
    return p.clusters
      .filter((c) => c.lens.includes('customer'))
      .map((c) => {
        const voice = c.examples[0] ? ` Buyer voice: “${c.examples[0].slice(0, 140)}”` : '';
        return fromCluster(
          c,
          OBJECTION_TOPICS.has(c.code)
            ? `${share(c)} buyers voiced this objection; ${c.blocking_runs} ended their journey on it.${voice}`
            : `${c.title}: observed for ${share(c)} buyers; ${c.blocking_runs} ended their journey at it.${voice}`,
        );
      });
  },
};

/**
 * The red team does not see other auditors' conclusions. It challenges the EVIDENCE:
 * sample size, concentration, construction effects of the buyer policy.
 */
export const REDTEAM_AUDITOR: Auditor = {
  id: 'redteam',
  name: 'Skeptical red team',
  mandate: 'Which conclusions are weaker than they look?',
  audit(p) {
    const out: AuditorFinding[] = [];
    const heuristic = p.policy.some((x) => x === 'heuristic');
    for (const c of p.clusters) {
      const ev = spreadEvidence(c, 4);
      if (c.affected < 3) {
        out.push({
          finding: `Only ${c.affected} journey(s) show "${c.title}". Too few to generalise; could be one persona's configuration.`,
          params: { kind: 'too_few', n: c.affected },
          topic: c.code,
          evidence_ids: ev,
          affected_segments: segs(c),
          severity: 'low',
          confidence: 'medium',
          claim: 'hypothesis',
          proposed_experiment: 'Re-run with a larger population (--size 100) before acting.',
        });
      } else if (segs(c).length === 1 && c.affected < c.population) {
        out.push({
          finding: `"${c.title}" occurs only in segment "${segs(c)[0]}". It may be a segment-specific need, not a product-wide defect.`,
          params: { kind: 'single_segment', segment: segs(c)[0] ?? '' },
          topic: c.code,
          evidence_ids: ev,
          affected_segments: segs(c),
          severity: 'low',
          confidence: 'medium',
          claim: 'hypothesis',
          proposed_experiment:
            'Target the fix to that segment first, or confirm with real segment data (calibration).',
        });
      }
      const driver = heuristic
        ? OBJECTION_TOPICS.has(c.code)
          ? 'objections configured on the personas'
          : POLICY_DRIVEN[c.code]
        : undefined;
      if (driver) {
        out.push({
          finding: `"${c.title}" is decided by ${driver} in the deterministic buyer. Its frequency reflects that design choice, not observed human behaviour.`,
          params: OBJECTION_TOPICS.has(c.code)
            ? { kind: 'objection' }
            : { kind: 'policy', driver: `@drv.${c.code}` },
          topic: c.code,
          evidence_ids: ev,
          affected_segments: segs(c),
          severity: 'low',
          confidence: 'high',
          claim: 'hypothesis',
          proposed_experiment:
            'Calibrate objection prevalence from support tickets or lost-deal reasons before sizing this.',
        });
      }
    }
    if (p.comparison && p.comparison.n_pairs < 30) {
      const ids = p.run_index
        .filter((r) => r.abandon_event)
        .map((r) => r.abandon_event as string)
        .slice(0, 4);
      if (ids.length) {
        out.push({
          finding: `The variant comparison rests on ${p.comparison.n_pairs} paired synthetic buyers. Treat the delta as an exploratory signal, not proven impact.`,
          topic: 'variant_delta',
          params: { kind: 'small_sample', n: p.comparison.n_pairs },
          evidence_ids: ids,
          affected_segments: [],
          severity: 'medium',
          confidence: 'high',
          claim: 'hypothesis',
          proposed_experiment: 'Increase to ≥100 buyers and confirm with a real, randomised A/B test.',
        });
      }
    }
    return out;
  },
};

export const DEFAULT_AUDITORS: Auditor[] = [
  UX_AUDITOR,
  BUSINESS_AUDITOR,
  ENGINEERING_AUDITOR,
  CUSTOMER_AUDITOR,
  REDTEAM_AUDITOR,
];
