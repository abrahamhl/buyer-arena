import { z } from 'zod';
import { FUNNEL, Milestone } from '../core/types.js';
import type { VariantSummary } from '../metrics/run-metrics.js';

/**
 * Privacy-preserving aggregates only. There is deliberately no field that can hold a
 * person-level record: shares and rates per group, plus the group size used.
 */
export const CalibrationInputSchema = z
  .object({
    source: z.string().describe('Where the aggregates came from, e.g. "analytics funnel export, Aug 2026"'),
    period: z.string().optional(),
    /** Smallest group size present in the aggregates (k-anonymity). Groups below 10 are rejected. */
    min_group_size: z.number().int().min(10),
    segments: z.array(z.object({ archetype: z.string(), share: z.number().min(0).max(1) })).optional(),
    funnel: z.array(z.object({ stage: Milestone, rate: z.number().min(0).max(1) })).optional(),
    objections: z.array(z.object({ objection: z.string(), share: z.number().min(0).max(1) })).optional(),
  })
  .strict();
export type CalibrationInput = z.infer<typeof CalibrationInputSchema>;

export interface Calibration {
  source: string;
  /** Archetype weights for generatePopulation({ weights }). */
  weights?: Record<string, number>;
  /** Probability a persona of a matching archetype carries each objection. */
  objection_rates?: Record<string, number>;
  notes: string[];
}

/** Turn aggregate patterns into synthetic population parameters. */
export function calibrate(input: CalibrationInput): Calibration {
  const parsed = CalibrationInputSchema.parse(input);
  const notes: string[] = [
    `Calibrated from aggregates: ${parsed.source}${parsed.period ? ` (${parsed.period})` : ''}; min group size ${parsed.min_group_size}.`,
  ];
  let weights: Record<string, number> | undefined;
  if (parsed.segments?.length) {
    const total = parsed.segments.reduce((s, x) => s + x.share, 0);
    if (total <= 0) throw new Error('segment shares sum to zero');
    weights = Object.fromEntries(parsed.segments.map((s) => [s.archetype, s.share / total]));
    if (Math.abs(total - 1) > 0.02)
      notes.push(`Segment shares summed to ${total.toFixed(2)}; normalised to 1.`);
  }
  let objection_rates: Record<string, number> | undefined;
  if (parsed.objections?.length) {
    objection_rates = Object.fromEntries(parsed.objections.map((o) => [o.objection, o.share]));
    notes.push('Objection prevalence applied only to archetypes whose profile allows that objection.');
  }
  notes.push(
    'Calibration changes WHO is simulated, not what they do; it does not make results predictions of real sales.',
  );
  return { source: parsed.source, weights, objection_rates, notes };
}

export interface CalibrationErrorRow {
  stage: Milestone;
  simulated: number;
  real: number;
  abs_error: number;
  /** real / simulated — a per-stage correction factor to record, not to apply blindly. */
  correction: number | null;
}

/** Compare a simulated funnel with a real aggregate funnel: the first step of measuring how wrong the simulator is. */
export function calibrationError(
  sim: VariantSummary,
  real: CalibrationInput['funnel'],
): { rows: CalibrationErrorRow[]; mean_abs_error: number | null } {
  const rows: CalibrationErrorRow[] = [];
  for (const stage of FUNNEL) {
    const r = real?.find((x) => x.stage === stage);
    const s = sim.funnel.find((x) => x.stage === stage);
    if (!r || !s) continue;
    rows.push({
      stage,
      simulated: s.rate,
      real: r.rate,
      abs_error: Math.abs(s.rate - r.rate),
      correction: s.rate > 0 ? r.rate / s.rate : null,
    });
  }
  return {
    rows,
    mean_abs_error: rows.length ? rows.reduce((a, b) => a + b.abs_error, 0) / rows.length : null,
  };
}
