import type { RunRecord } from '../core/types.js';
import type { Comparison } from '../comparison/compare.js';
import type { FrictionCluster } from '../metrics/friction.js';
import type { VariantSummary } from '../metrics/run-metrics.js';

export interface JourneyDigest {
  run_id: string;
  segment: string;
  status: string;
  steps: number;
  milestones: string[];
  abandon_reason?: string;
  timeline: { id: string; step: number; type: string; text: string; screenshot?: string }[];
}

/**
 * Everything an auditor may see. Deliberately contains NO other auditor's output:
 * auditors are independent until the consensus stage.
 */
export interface AuditPacket {
  subject_variant: string;
  population: number;
  summary: VariantSummary;
  comparison?: Pick<Comparison, 'baseline' | 'candidate' | 'n_pairs' | 'label' | 'headline' | 'rows' | 'segments' | 'friction'>;
  clusters: FrictionCluster[];
  run_index: { run_id: string; segment: string; completed: boolean; milestones: string[]; abandon_event?: string; objection?: string }[];
  failed_journeys: JourneyDigest[];
  successful_journeys: JourneyDigest[];
  policy: string[];
}

const KEEP = new Set(['decision', 'abandon', 'objection', 'form_error', 'page_error', 'console_error', 'http_error', 'dismiss_modal', 'goal_complete', 'milestone', 'request_failed']);

export function digest(run: RunRecord): JourneyDigest {
  return {
    run_id: run.run_id,
    segment: run.segment,
    status: run.status,
    steps: run.steps,
    milestones: Object.keys(run.milestones),
    abandon_reason: run.abandon_reason,
    timeline: run.events
      .filter((e) => KEEP.has(e.type))
      .map((e) => ({
        id: e.id,
        step: e.step,
        type: e.type,
        text: [e.target, e.detail].filter(Boolean).join(' — ').slice(0, 220),
        screenshot: e.screenshot,
      })),
  };
}

/** Pick representative journeys: one per segment first, then fill — deterministic. */
function representative(runs: RunRecord[], max: number): RunRecord[] {
  const out: RunRecord[] = [];
  const bySeg = new Map<string, RunRecord[]>();
  for (const r of runs) bySeg.set(r.segment, [...(bySeg.get(r.segment) ?? []), r]);
  let round = 0;
  while (out.length < max && out.length < runs.length) {
    let added = false;
    for (const group of bySeg.values()) {
      const r = group[round];
      if (r && out.length < max) {
        out.push(r);
        added = true;
      }
    }
    if (!added) break;
    round++;
  }
  return out;
}

export function buildPacket(
  variant: string,
  runs: RunRecord[],
  summary: VariantSummary,
  clusters: FrictionCluster[],
  comparison?: Comparison,
): AuditPacket {
  const mine = runs.filter((r) => r.variant === variant);
  const cap = (c: FrictionCluster): FrictionCluster => ({ ...c, evidence_ids: c.evidence_ids.slice(0, 40) });
  return {
    subject_variant: variant,
    population: mine.length,
    summary,
    comparison: comparison && {
      baseline: comparison.baseline,
      candidate: comparison.candidate,
      n_pairs: comparison.n_pairs,
      label: comparison.label,
      headline: comparison.headline,
      rows: comparison.rows,
      segments: comparison.segments,
      friction: comparison.friction,
    },
    clusters: clusters.filter((c) => c.variant === variant).map(cap),
    run_index: mine.map((r) => ({
      run_id: r.run_id,
      segment: r.segment,
      completed: r.goal_completed,
      milestones: Object.keys(r.milestones),
      abandon_event: r.events.find((e) => e.type === 'abandon')?.id,
      objection: r.objection,
    })),
    failed_journeys: representative(mine.filter((r) => !r.goal_completed), 6).map(digest),
    successful_journeys: representative(mine.filter((r) => r.goal_completed), 3).map(digest),
    policy: [...new Set(mine.map((r) => r.policy))],
  };
}
