import { z } from 'zod';
import type { EvidenceEnvelopeV1 } from '../evidence/envelope.js';

/**
 * Production lifecycle graph. A run fills the stages it has evidence for; the rest are N/A.
 * Statuses are never averaged: one FAIL stays a FAIL, and a critical security finding fails
 * SECURITY whatever else passed.
 */
export const STAGES = [
  'spec',
  'code',
  'build',
  'test',
  'ai_eval',
  'security',
  'browser',
  'buyer',
  'accessibility',
  'release',
] as const;
export type Stage = (typeof STAGES)[number];
export type StageStatus = 'PASS' | 'WARN' | 'FAIL' | 'N/A';

export interface StageResult {
  stage: Stage;
  status: StageStatus;
  summary: string;
  /** Envelope ids, event ids, files or commands behind this status. */
  evidence_refs: string[];
  metrics?: Record<string, number | string | boolean | null>;
}

export interface LifecycleGraph {
  version: 1;
  stages: StageResult[];
  gates?: GateEvaluation;
}

export const na = (stage: Stage, summary = 'not run'): StageResult => ({
  stage,
  status: 'N/A',
  summary,
  evidence_refs: [],
});

/** Map evidence envelopes onto stages by category (used when nothing more specific exists). */
export function stagesFromEvidence(evidence: EvidenceEnvelopeV1[]): Partial<Record<Stage, StageResult>> {
  const out: Partial<Record<Stage, StageResult>> = {};
  const group = (stage: Stage, list: EvidenceEnvelopeV1[]) => {
    if (!list.length) return;
    const critical = list.filter((e) => e.severity === 'critical');
    const failed = list.filter((e) => e.passed === false || e.severity === 'high');
    const warn = list.filter((e) => e.severity === 'medium');
    const status: StageStatus = critical.length || failed.length ? 'FAIL' : warn.length ? 'WARN' : 'PASS';
    out[stage] = {
      stage,
      status,
      summary: `${list.length} evidence item(s): ${critical.length} critical, ${failed.length} failing/high, ${warn.length} medium`,
      evidence_refs: [...critical, ...failed, ...warn].slice(0, 20).map((e) => e.id),
      metrics: { total: list.length, critical: critical.length, failing: failed.length, medium: warn.length },
    };
  };
  group(
    'security',
    evidence.filter((e) => e.categories.includes('security')),
  );
  group(
    'ai_eval',
    evidence.filter((e) => e.categories.includes('model') || e.categories.includes('agent')),
  );
  group(
    'accessibility',
    evidence.filter((e) => e.categories.includes('accessibility')),
  );
  return out;
}

export function buildGraph(parts: Partial<Record<Stage, StageResult>>): LifecycleGraph {
  return { version: 1, stages: STAGES.map((s) => parts[s] ?? na(s)) };
}

/* ─────────────────────────── gates ─────────────────────────── */

/**
 * buyer-arena.yaml:
 *   release:
 *     require:
 *       tests: pass
 *       security_critical: 0
 *       buyer_regression_pp: "<=5"
 */
const Comparison = z.union([z.number(), z.string().regex(/^\s*(<=|>=|<|>|==)?\s*-?\d+(\.\d+)?\s*$/)]);
export const ReleaseGatesSchema = z
  .object({
    require: z
      .object({
        build: z.enum(['pass', 'warn']).optional(),
        tests: z.enum(['pass', 'warn']).optional(),
        security: z.enum(['pass', 'warn']).optional(),
        accessibility: z.enum(['pass', 'warn']).optional(),
        security_critical: Comparison.optional(),
        security_high: Comparison.optional(),
        buyer_regression_pp: Comparison.optional(),
        tests_removed: Comparison.optional(),
        cost_usd: Comparison.optional(),
      })
      .strict()
      .default({}),
  })
  .strict();
export type ReleaseGates = z.infer<typeof ReleaseGatesSchema>;

export interface GateResult {
  gate: string;
  required: string;
  actual: string;
  passed: boolean | null;
}
export interface GateEvaluation {
  passed: boolean;
  results: GateResult[];
}

function compare(expr: number | string, actual: number): boolean {
  if (typeof expr === 'number') return actual <= expr; // bare number = upper bound
  const m = /^\s*(<=|>=|<|>|==)?\s*(-?\d+(?:\.\d+)?)\s*$/.exec(expr);
  if (!m) return false;
  const v = Number(m[2]);
  switch (m[1] ?? '<=') {
    case '<':
      return actual < v;
    case '>':
      return actual > v;
    case '>=':
      return actual >= v;
    case '==':
      return actual === v;
    default:
      return actual <= v;
  }
}

/** Numbers the gates can reference. Missing number → the gate cannot be checked → it FAILS. */
export interface GateMetrics {
  security_critical?: number;
  security_high?: number;
  /** Candidate − baseline goal completion, in pp; a regression is a negative delta. */
  buyer_delta_pp?: number;
  tests_removed?: number;
  cost_usd?: number;
}

export function evaluateGates(
  graph: LifecycleGraph,
  gates: ReleaseGates | undefined,
  m: GateMetrics,
): GateEvaluation {
  const results: GateResult[] = [];
  const req = gates?.require ?? {};
  const stage = (s: Stage) => graph.stages.find((x) => x.stage === s);
  for (const key of ['build', 'tests', 'security', 'accessibility'] as const) {
    const want = req[key];
    if (!want) continue;
    const st = stage(key === 'tests' ? 'test' : key);
    const ok = st
      ? want === 'pass'
        ? st.status === 'PASS'
        : st.status === 'PASS' || st.status === 'WARN'
      : false;
    results.push({ gate: key, required: want.toUpperCase(), actual: st?.status ?? 'N/A', passed: ok });
  }
  const num = (gate: string, expr: number | string | undefined, actual: number | undefined) => {
    if (expr === undefined) return;
    results.push({
      gate,
      required: String(expr),
      actual: actual === undefined ? 'unknown' : String(Math.round(actual * 100) / 100),
      // Fail closed: a gate whose input was not measured does not pass.
      passed: actual === undefined ? false : compare(expr, actual),
    });
  };
  num('security_critical', req.security_critical, m.security_critical);
  num('security_high', req.security_high, m.security_high);
  // "buyer_regression_pp <= 5" means a drop of at most 5pp.
  num(
    'buyer_regression_pp',
    req.buyer_regression_pp,
    m.buyer_delta_pp === undefined ? undefined : Math.max(0, -m.buyer_delta_pp),
  );
  num('tests_removed', req.tests_removed, m.tests_removed);
  num('cost_usd', req.cost_usd, m.cost_usd);
  return { passed: results.every((r) => r.passed !== false), results };
}

/** Attach gate results as the RELEASE stage. */
export function withRelease(graph: LifecycleGraph, g: GateEvaluation | undefined): LifecycleGraph {
  const release: StageResult =
    !g || !g.results.length
      ? na('release', 'no release gates configured')
      : {
          stage: 'release',
          status: g.passed ? 'PASS' : 'FAIL',
          summary: g.passed
            ? `all ${g.results.length} gate(s) passed`
            : `failed: ${g.results
                .filter((r) => r.passed === false)
                .map((r) => r.gate)
                .join(', ')}`,
          evidence_refs: [],
          metrics: Object.fromEntries(g.results.map((r) => [r.gate, r.actual])),
        };
  return { ...graph, gates: g, stages: graph.stages.map((s) => (s.stage === 'release' ? release : s)) };
}

export function renderGraphText(g: LifecycleGraph): string {
  const icon: Record<StageStatus, string> = { PASS: '✓', WARN: '!', FAIL: '✗', 'N/A': '·' };
  return g.stages
    .map((s) => `  ${icon[s.status]} ${s.stage.toUpperCase().padEnd(14)} ${s.status.padEnd(5)} ${s.summary}`)
    .join('\n');
}
