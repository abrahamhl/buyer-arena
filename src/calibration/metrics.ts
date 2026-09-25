import type { CalibrationInput } from './calibration.js';

/**
 * Calibration metrics over AGGREGATES only.
 *
 * A stage pair is (p = simulated rate, r = real rate over n visitors). With a constant
 * prediction p for n binary outcomes whose mean is r, the exact mean Brier score is
 *   r·(1−p)² + (1−r)·p²
 * which needs no person-level data. ECE uses each stage as a bin, weighted by n.
 */
export interface StagePair {
  stage: string;
  p: number;
  r: number;
  n?: number;
}

export type CalibrationState = 'UNCALIBRATED' | 'PARTIALLY_CALIBRATED' | 'CALIBRATED';

export interface CalibrationMetrics {
  stages: number;
  mae: number | null;
  rmse: number | null;
  brier: number | null;
  /** Brier of always predicting the real overall mean: lower Brier than this = skill. */
  brier_reference: number | null;
  ece: number | null;
  calibration_curve: { stage: string; predicted: number; observed: number; n: number | null }[];
  directional_agreement: boolean | null;
  simulated_delta_pp: number | null;
  real_delta_pp: number | null;
  finding_labels: {
    tp: number;
    fp: number;
    fn: number;
    tn: number;
    fpr: number | null;
    fnr: number | null;
  } | null;
}

export interface CalibrationAssessment {
  state: CalibrationState;
  metrics: CalibrationMetrics;
  reasons: string[];
  /** Conservative defaults; documented in docs/METHODOLOGY.md, not a scientific standard. */
  thresholds: typeof THRESHOLDS;
}

export const THRESHOLDS = {
  min_stages: 3,
  min_group_size: 100,
  max_mae: 0.1,
  min_labels: 10,
  max_fpr: 0.3,
  max_fnr: 0.3,
} as const;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function stageMetrics(
  pairs: StagePair[],
): Pick<
  CalibrationMetrics,
  'stages' | 'mae' | 'rmse' | 'brier' | 'brier_reference' | 'ece' | 'calibration_curve'
> {
  const errs = pairs.map((x) => x.p - x.r);
  const brierOf = (p: number, r: number) => r * (1 - p) ** 2 + (1 - r) * p ** 2;
  const totalN = pairs.reduce((s, x) => s + (x.n ?? 0), 0);
  const weighted = pairs.every((x) => x.n !== undefined) && totalN > 0;
  const w = (x: StagePair) => (weighted ? (x.n as number) / totalN : 1 / pairs.length);
  const rBar = pairs.length ? pairs.reduce((s, x) => s + w(x) * x.r, 0) : 0;
  return {
    stages: pairs.length,
    mae: mean(errs.map(Math.abs)),
    rmse: pairs.length ? Math.sqrt(mean(errs.map((e) => e * e)) as number) : null,
    brier: pairs.length ? pairs.reduce((s, x) => s + w(x) * brierOf(x.p, x.r), 0) : null,
    brier_reference: pairs.length ? pairs.reduce((s, x) => s + w(x) * brierOf(rBar, x.r), 0) : null,
    ece: pairs.length ? pairs.reduce((s, x) => s + w(x) * Math.abs(x.p - x.r), 0) : null,
    calibration_curve: [...pairs]
      .sort((a, b) => a.p - b.p)
      .map((x) => ({ stage: x.stage, predicted: x.p, observed: x.r, n: x.n ?? null })),
  };
}

export function labelMetrics(
  predictedTopics: string[],
  labels: NonNullable<CalibrationInput['finding_labels']>,
): NonNullable<CalibrationMetrics['finding_labels']> {
  const pred = new Set(predictedTopics);
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (const l of labels) {
    const p = pred.has(l.topic);
    if (p && l.confirmed) tp++;
    else if (p && !l.confirmed) fp++;
    else if (!p && l.confirmed) fn++;
    else tn++;
  }
  return {
    tp,
    fp,
    fn,
    tn,
    fpr: fp + tn ? fp / (fp + tn) : null,
    fnr: fn + tp ? fn / (fn + tp) : null,
  };
}

/**
 * Assess calibration state. Rules (all must hold for CALIBRATED):
 *   - evidence is external (real aggregate or independent human review), never synthetic
 *   - ≥3 funnel stages from groups of ≥100 with MAE ≤ 10pp
 *   - and a second, independent signal: correct direction on a real A/B delta, or ≥10
 *     labelled findings with FPR and FNR ≤ 30%
 * Any external evidence short of that is PARTIALLY_CALIBRATED.
 */
export function assessCalibration(
  input: CalibrationInput,
  pairs: StagePair[],
  o: { simulatedDeltaPp?: number | null; predictedTopics?: string[] } = {},
): CalibrationAssessment {
  const reasons: string[] = [];
  const sm = stageMetrics(pairs);
  const realDelta = input.variant_delta?.real_delta_pp ?? null;
  const simDelta = o.simulatedDeltaPp ?? null;
  const directional =
    realDelta === null || simDelta === null || realDelta === 0
      ? null
      : Math.sign(realDelta) === Math.sign(simDelta);
  const labels = input.finding_labels?.length
    ? labelMetrics(o.predictedTopics ?? [], input.finding_labels)
    : null;
  const metrics: CalibrationMetrics = {
    ...sm,
    directional_agreement: directional,
    simulated_delta_pp: simDelta,
    real_delta_pp: realDelta,
    finding_labels: labels,
  };
  const T = THRESHOLDS;
  if (input.evidence_kind === 'synthetic') {
    reasons.push('evidence is synthetic: a simulation cannot calibrate a simulation');
    return { state: 'UNCALIBRATED', metrics, reasons, thresholds: T };
  }
  const hasExternal = sm.stages > 0 || labels !== null || directional !== null;
  if (!hasExternal) {
    reasons.push('no comparable external evidence (no matching funnel stages, labels or A/B delta)');
    return { state: 'UNCALIBRATED', metrics, reasons, thresholds: T };
  }
  const funnelOk =
    sm.stages >= T.min_stages && input.min_group_size >= T.min_group_size && (sm.mae ?? 1) <= T.max_mae;
  if (sm.stages < T.min_stages) reasons.push(`only ${sm.stages} comparable stage(s) (need ${T.min_stages})`);
  if (input.min_group_size < T.min_group_size)
    reasons.push(`min group size ${input.min_group_size} < ${T.min_group_size}`);
  if (sm.mae !== null && sm.mae > T.max_mae)
    reasons.push(`MAE ${(sm.mae * 100).toFixed(1)}pp > ${T.max_mae * 100}pp`);
  const labelsOk =
    labels !== null &&
    input.finding_labels!.length >= T.min_labels &&
    labels.fpr !== null &&
    labels.fnr !== null &&
    labels.fpr <= T.max_fpr &&
    labels.fnr <= T.max_fnr;
  const second = directional === true || labelsOk;
  if (directional === false) reasons.push('simulated A/B direction disagrees with the real result');
  if (!second)
    reasons.push(
      'no independent second signal (correct A/B direction, or ≥10 labelled findings within error limits)',
    );
  const state: CalibrationState =
    funnelOk && second && directional !== false ? 'CALIBRATED' : 'PARTIALLY_CALIBRATED';
  if (state === 'CALIBRATED')
    reasons.push('all thresholds met for this product, population template and task only');
  return { state, metrics, reasons, thresholds: T };
}
