import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assessCalibration, labelMetrics, stageMetrics } from '../../src/calibration/metrics.js';
import { CalibrationInputSchema } from '../../src/calibration/calibration.js';
import { redact, secretFingerprint } from '../../src/core/redact.js';
import {
  canonicalJson,
  EvidenceEnvelopeV1Schema,
  makeEvidence,
  normalizeSeverity,
  summarizeEvidence,
} from '../../src/evidence/envelope.js';
import { readEvidence, writeEvidence } from '../../src/evidence/store.js';
import { migrateLaunchReport, type LaunchReport } from '../../src/launch.js';
import {
  buildGraph,
  evaluateGates,
  ReleaseGatesSchema,
  stagesFromEvidence,
  withRelease,
} from '../../src/lifecycle/graph.js';
import { migratePanelId, parseMix } from '../../src/panels/mix.js';

const base = {
  source: 'test',
  source_version: '1.0',
  source_kind: 'import' as const,
  categories: ['security' as const],
  finding_type: 'secret.x',
  severity: 'critical' as const,
  confidence: 0.8,
  claim_type: 'observed' as const,
  deterministic: true,
  offline: true,
  network_accessed: false,
  provenance: { tool: 't', version: '1', config_digest: null, timestamp: '2026-09-25T00:00:00Z' },
};

describe('EvidenceEnvelope v1', () => {
  it('validates, fills defaults and is content-addressed', () => {
    const a = makeEvidence({ ...base, raw: { b: 1, a: 2 } });
    const b = makeEvidence({ ...base, raw: { a: 2, b: 1 } });
    expect(a.id).toBe(b.id); // key order does not change the digest
    expect(a).toMatchObject({ schema_version: '1', passed: null, evidence_refs: [], usage: null });
    expect(a.raw_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(canonicalJson({ b: [2, { d: 1, c: 0 }], a: null })).toBe('{"a":null,"b":[2,{"c":0,"d":1}]}');
  });

  it('rejects invalid envelopes', () => {
    expect(() => makeEvidence({ ...base, confidence: 2, raw: 1 })).toThrow();
    expect(() => makeEvidence({ ...base, categories: [], raw: 1 })).toThrow();
    expect(
      EvidenceEnvelopeV1Schema.safeParse({ ...base, id: 'x', schema_version: '2', raw_digest: null }).success,
    ).toBe(false);
  });

  it('consumers ignore unknown fields (forward compatibility)', () => {
    const e = makeEvidence({ ...base, raw: 1 });
    const parsed = EvidenceEnvelopeV1Schema.parse({ ...e, future_field: 'x' });
    expect(parsed.id).toBe(e.id);
  });

  it('store appends idempotently by id', () => {
    const f = join(mkdtempSync(join(tmpdir(), 'ba-ev-')), 'evidence.jsonl');
    const e = makeEvidence({ ...base, raw: 1 });
    expect(writeEvidence(f, [e, e])).toEqual({ added: 1, total: 1 });
    expect(writeEvidence(f, [e, makeEvidence({ ...base, raw: 2 })])).toEqual({ added: 1, total: 2 });
    expect(readEvidence(f)).toHaveLength(2);
    expect(summarizeEvidence(readEvidence(f)).by_severity.critical).toBe(2);
  });

  it('severity normalisation', () => {
    expect(['CRITICAL', 'error', 'moderate', 'note', 'unknown', undefined].map(normalizeSeverity)).toEqual([
      'critical',
      'high',
      'medium',
      'low',
      'info',
      'info',
    ]);
  });

  it('secret redaction and fingerprints', () => {
    const aws = 'AKIA' + 'ABCDEFGHIJKLMNOP'; // built at runtime so the repo secret scan stays clean
    const t = redact(`key sk-abcdefghijklmnop token=abc123 ${aws} ghp_` + 'a'.repeat(36));
    expect(t).not.toMatch(/abcdefghijklmnop|abc123|ghp_a{36}/);
    expect(t).not.toContain(aws);
    expect(secretFingerprint('s')).toMatch(/^fp:[a-f0-9]{12}$/);
    expect(secretFingerprint('s')).toBe(secretFingerprint('s'));
  });
});

describe('lifecycle graph and release gates', () => {
  const crit = makeEvidence({ ...base, raw: 'c' });
  it('a critical security finding fails SECURITY; statuses are never averaged', () => {
    const g = buildGraph(stagesFromEvidence([crit, makeEvidence({ ...base, severity: 'info', raw: 'i' })]));
    expect(g.stages.find((s) => s.stage === 'security')?.status).toBe('FAIL');
    expect(g.stages.find((s) => s.stage === 'build')?.status).toBe('N/A');
    expect(g.stages).toHaveLength(10);
  });

  it('gates: pass, fail, and fail closed when a metric was not measured', () => {
    const gates = ReleaseGatesSchema.parse({
      require: { security_critical: 0, buyer_regression_pp: '<=5', tests: 'pass' },
    });
    const graph = buildGraph({ test: { stage: 'test', status: 'PASS', summary: '', evidence_refs: [] } });
    const ok = evaluateGates(graph, gates, { security_critical: 0, buyer_delta_pp: -3 });
    expect(ok.passed).toBe(true);
    const bad = evaluateGates(graph, gates, { security_critical: 1, buyer_delta_pp: -8 });
    expect(bad.results.filter((r) => !r.passed).map((r) => r.gate)).toEqual([
      'security_critical',
      'buyer_regression_pp',
    ]);
    const unknown = evaluateGates(graph, gates, {});
    expect(unknown.passed).toBe(false);
    expect(withRelease(graph, bad).stages.find((s) => s.stage === 'release')?.status).toBe('FAIL');
    expect(() => ReleaseGatesSchema.parse({ require: { made_up: 1 } })).toThrow();
  });
});

describe('calibration metrics and state', () => {
  const input = (o: object) =>
    CalibrationInputSchema.parse({ source: 'test aggregates', min_group_size: 200, ...o });
  const pairs = [
    { stage: 'landed', p: 1, r: 1, n: 1000 },
    { stage: 'pricing_found', p: 0.6, r: 0.55, n: 1000 },
    { stage: 'signup_started', p: 0.25, r: 0.22, n: 550 },
    { stage: 'goal_completed', p: 0.08, r: 0.06, n: 220 },
  ];

  it('computes MAE, RMSE, Brier (aggregate-exact), ECE and the calibration curve', () => {
    const m = stageMetrics(pairs);
    expect(m.mae).toBeCloseTo((0 + 0.05 + 0.03 + 0.02) / 4, 6);
    expect(m.rmse).toBeCloseTo(Math.sqrt((0.0025 + 0.0009 + 0.0004) / 4), 6);
    expect(m.brier).toBeGreaterThan(0);
    expect(m.ece).toBeGreaterThan(0);
    expect(m.calibration_curve.map((x) => x.stage)[0]).toBe('goal_completed');
  });

  it('FPR / FNR from independently labelled findings', () => {
    expect(
      labelMetrics(
        ['a', 'b'],
        [
          { topic: 'a', confirmed: true },
          { topic: 'b', confirmed: false },
          { topic: 'c', confirmed: true },
          { topic: 'd', confirmed: false },
        ],
      ),
    ).toMatchObject({
      tp: 1,
      fp: 1,
      fn: 1,
      tn: 1,
      fpr: 0.5,
      fnr: 0.5,
    });
  });

  it('a synthetic run never calibrates another synthetic run', () => {
    expect(
      assessCalibration(input({ evidence_kind: 'synthetic' }), pairs, { simulatedDeltaPp: 10 }).state,
    ).toBe('UNCALIBRATED');
  });

  it('funnel alone is PARTIALLY; funnel + correct A/B direction is CALIBRATED; wrong direction is not', () => {
    expect(assessCalibration(input({}), pairs).state).toBe('PARTIALLY_CALIBRATED');
    const vd = { baseline: 'baseline', candidate: 'candidate', real_delta_pp: 4 };
    expect(assessCalibration(input({ variant_delta: vd }), pairs, { simulatedDeltaPp: 9 }).state).toBe(
      'CALIBRATED',
    );
    const wrong = assessCalibration(input({ variant_delta: vd }), pairs, { simulatedDeltaPp: -2 });
    expect(wrong.state).toBe('PARTIALLY_CALIBRATED');
    expect(wrong.reasons.join()).toMatch(/disagrees/);
    expect(
      assessCalibration(input({ min_group_size: 20, variant_delta: vd }), pairs, { simulatedDeltaPp: 9 })
        .state,
    ).toBe('PARTIALLY_CALIBRATED');
    expect(assessCalibration(input({}), []).state).toBe('UNCALIBRATED');
  });

  it('the input schema still refuses person-level fields', () => {
    expect(() =>
      CalibrationInputSchema.parse({ source: 'x', min_group_size: 50, users: [{ email: 'a@b.c' }] }),
    ).toThrow();
  });
});

describe('Commercial Readiness rename (backward compatible)', () => {
  it('accepts the old `investors` mix key and panel id', () => {
    expect(migratePanelId('investors')).toBe('commercial');
    const m = parseMix('investors=60,security=0');
    expect(m.commercial).toBeGreaterThan(m.users);
    expect('investors' in m).toBe(false);
  });

  it('upgrades launch reports written before the rename', () => {
    const old = {
      version: 1,
      id: 'l',
      mix: { users: 40, developers: 15, investors: 15, security: 15, segments: 15 },
      allocations: [{ panel: 'investors', participants: 3 }],
      panels: [
        {
          id: 'investors',
          checks: [
            { id: 'inv.problem', panel: 'investors', score: 80, weight: 1, status: 'pass', evidence: [] },
          ],
        },
      ],
      actions: [{ rank: 1, panel: 'investors', check: 'inv.moat', score: 20, impact: 1 }],
    } as unknown as LaunchReport;
    const r = migrateLaunchReport(old);
    expect(r.mix).toMatchObject({ commercial: 15 });
    expect(JSON.stringify(r)).not.toMatch(/investors|"inv\./);
    expect(migrateLaunchReport(r)).toEqual(r); // idempotent
  });
});
