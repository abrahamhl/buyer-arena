import type { Comparison } from '../comparison/compare.js';
import type { ConsensusItem } from '../auditors/consensus.js';
import { playFor, type Effort } from '../auditors/playbook.js';

export type Leverage = 'HIGH-LEVERAGE EXPERIMENT' | 'MEDIUM' | 'LOW';

export interface Opportunity {
  rank: number;
  id: string;
  topic: string;
  title: string;
  variant: string;
  score: number;
  leverage: Leverage;
  factors: {
    frequency: number;
    severity: number;
    goal_impact: number;
    segment_breadth: number;
    confidence: number;
    effort: Effort;
    effort_cost: number;
    reversibility: number;
    testability: number;
  };
  affected: string;
  evidence_ids: string[];
  experiment: string;
  /** Upper bound on goal completion recoverable by fixing this item (journeys that ended here / population). */
  ceiling_pp: number;
  status?: 'persisting' | 'new' | 'resolved';
  claim: ConsensusItem['claim'];
}

export const ROI_FORMULA =
  'score = 100 × frequency × (0.1 + 0.9 × goal_impact) × confidence × (0.5 + 0.25 × reversibility + 0.25 × testability) / effort_cost   [≈ confidence-weighted pp of goal completion recoverable per unit of effort]';

const SEVERITY = { low: 0.25, medium: 0.5, high: 0.8, critical: 1 } as const;
const CONFIDENCE = { low: 0.4, medium: 0.7, high: 1 } as const;
const EFFORT_COST: Record<Effort, number> = { low: 1, medium: 2, high: 4 };

/** Topics that describe the measurement or a symptom (covered by root-cause items), not a product change. */
const NON_ACTIONABLE = (topic: string) =>
  topic === 'variant_delta' || topic === 'funnel_leak' || topic.startsWith('segment_gap:');

/**
 * Evidence-driven prioritisation. No money is invented: without revenue data the score is a
 * unitless leverage index. Every input is visible in the backlog so the ranking can be argued with.
 */
export function prioritize(
  items: ConsensusItem[],
  opts: {
    population: number;
    totalSegments: number;
    comparison?: Comparison;
    effortOverrides?: Record<string, Effort>;
  },
): Opportunity[] {
  const scored = items
    .filter((it) => !NON_ACTIONABLE(it.topic))
    .map((it) => {
      const play = playFor(it.topic);
      const effort = opts.effortOverrides?.[it.topic] ?? play.effort;
      const affectedRuns = it.affected_runs.length;
      const frequency = Math.min(1, affectedRuns / Math.max(1, opts.population));
      const goal_impact =
        it.blocking_runs !== null && affectedRuns ? Math.min(1, it.blocking_runs / affectedRuns) : 0.25;
      const segment_breadth = Math.min(1, it.affected_segments.length / Math.max(1, opts.totalSegments));
      const f = {
        frequency,
        severity: SEVERITY[it.severity],
        goal_impact,
        segment_breadth,
        confidence: CONFIDENCE[it.confidence],
        effort,
        effort_cost: EFFORT_COST[effort],
        reversibility: play.reversibility,
        testability: play.testability,
      };
      // frequency × goal_impact = share of ALL buyers whose journey ended here (the "if fixed" ceiling).
      // Unit: confidence-weighted percentage points of goal completion recoverable per unit of effort.
      const score =
        (100 *
          f.frequency *
          (0.1 + 0.9 * f.goal_impact) *
          f.confidence *
          (0.5 + 0.25 * f.reversibility + 0.25 * f.testability)) /
        f.effort_cost;
      const diff = opts.comparison?.friction.find((d) => d.code === it.topic);
      return {
        rank: 0,
        id: it.id,
        topic: it.topic,
        title: it.title,
        variant: it.variant,
        score: Math.round(score * 10) / 10,
        leverage: (score >= 5 ? 'HIGH-LEVERAGE EXPERIMENT' : score >= 2 ? 'MEDIUM' : 'LOW') as Leverage,
        factors: f,
        affected: `${affectedRuns}/${opts.population}`,
        evidence_ids: it.evidence_ids.slice(0, 6),
        experiment: it.proposed_experiments[0] ?? play.experiment,
        ceiling_pp: (it.blocking_runs ?? 0) / Math.max(1, opts.population),
        status: diff?.status,
        claim: it.claim,
      };
    })
    .sort((a, b) => b.score - a.score || a.topic.localeCompare(b.topic));
  return scored.map((o, i) => ({ ...o, rank: i + 1 }));
}
