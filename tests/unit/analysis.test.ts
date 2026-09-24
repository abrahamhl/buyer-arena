import { describe, expect, it } from 'vitest';
import { analyzeRuns } from '../../src/analysis.js';
import { buildConsensus, type AttributedFinding } from '../../src/auditors/consensus.js';
import { llmAudit, parseAuditorOutput } from '../../src/auditors/llm-auditor.js';
import { buildPacket } from '../../src/auditors/packet.js';
import { UX_AUDITOR } from '../../src/auditors/rules.js';
import { buildEvidenceIndex, clusterFriction, detectFriction } from '../../src/metrics/friction.js';
import { computeRunMetrics, summarizeVariant } from '../../src/metrics/run-metrics.js';
import { median, pairedBootstrap, signalLabel, wilson } from '../../src/metrics/stats.js';
import { CostMeter, MockProvider } from '../../src/providers/index.js';
import { renderBacklog } from '../../src/reports/backlog-md.js';
import { renderReport } from '../../src/reports/html.js';
import { prioritize, ROI_FORMULA } from '../../src/roi/roi.js';
import { parseAction } from '../../src/simulator/llm-policy.js';
import { newMemory } from '../../src/simulator/policy.js';
import { completedRun, fakeManifest, fakeRun, phoneRun, pricingFailRun } from '../helpers.js';

describe('statistics', () => {
  it('wilson interval behaves at the edges', () => {
    expect(wilson(0, 10).lo).toBe(0);
    expect(wilson(10, 10).hi).toBe(1);
    const w = wilson(8, 20);
    expect(w.rate).toBe(0.4);
    expect(w.lo).toBeGreaterThan(0.2);
    expect(w.hi).toBeLessThan(0.62);
  });

  it('paired bootstrap is seeded and brackets the observed delta', () => {
    const pairs: [number, number][] = Array.from({ length: 20 }, (_, i) => [i % 2, i % 4 === 0 ? 0 : 1]);
    const a = pairedBootstrap(pairs, 1000, 3);
    expect(a).toEqual(pairedBootstrap(pairs, 1000, 3));
    expect(a.lo).toBeLessThanOrEqual(a.delta);
    expect(a.hi).toBeGreaterThanOrEqual(a.delta);
  });

  it('small samples are always labelled EXPLORATORY SIGNAL', () => {
    expect(signalLabel(20, 0.2, 0.5)).toBe('EXPLORATORY SIGNAL');
    expect(signalLabel(100, 0.02, 0.1)).toBe('CONSISTENT SYNTHETIC EFFECT');
    expect(signalLabel(100, -0.1, 0.1)).toBe('INCONCLUSIVE');
    expect(median([3, 1, 2, 10])).toBe(2.5);
  });
});

describe('metrics and funnel', () => {
  it('computes deterministic journey metrics', () => {
    const run = fakeRun({ variant: 'v', persona: 'p1', reason: 'x' }, [
      { type: 'navigate', url: 'http://x.test/' },
      { type: 'navigate', url: 'http://x.test/a' },
      { type: 'navigate', url: 'http://x.test/' },
      { type: 'form_error', detail: 'bad' },
      { type: 'page_error', detail: 'TypeError' },
      { type: 'http_error', data: { status: 404 } },
      { type: 'back' },
      { type: 'abandon' },
    ]);
    const m = computeRunMetrics(run);
    expect(m.navigation_loops).toBe(1);
    expect(m.failed_forms).toBe(1);
    expect(m.browser_errors).toBe(1);
    expect(m.dead_ends).toBe(1);
    expect(m.backtracks).toBe(1);
    expect(m.abandoned).toBe(true);
  });

  it('funnel reach is monotone and goal completion rate is exact', () => {
    const runs = [
      completedRun('v', 'p1'),
      completedRun('v', 'p2'),
      pricingFailRun('v', 'p3'),
      phoneRun('v', 'p4'),
    ];
    const s = summarizeVariant('v', runs.map(computeRunMetrics), runs);
    const reach = s.funnel.map((f) => f.count);
    for (let i = 1; i < reach.length; i++) expect(reach[i]).toBeLessThanOrEqual(reach[i - 1]!);
    expect(s.completion.rate).toBe(0.5);
    expect(s.funnel.at(-1)!.count).toBe(2);
  });
});

function fixture() {
  const base = [
    completedRun('baseline', 'p1', 'Seg A', 'a'),
    pricingFailRun('baseline', 'p2'),
    pricingFailRun('baseline', 'p3'),
    pricingFailRun('baseline', 'p4'),
    phoneRun('baseline', 'p5'),
    phoneRun('baseline', 'p6'),
  ];
  const cand = [
    completedRun('candidate', 'p1', 'Seg A', 'a'),
    completedRun('candidate', 'p2', 'Seg B', 'b'),
    completedRun('candidate', 'p3', 'Seg B', 'b'),
    completedRun('candidate', 'p4', 'Seg B', 'b'),
    phoneRun('candidate', 'p5'),
    phoneRun('candidate', 'p6'),
  ];
  return [...base, ...cand];
}

describe('friction, evidence and consensus', () => {
  it('detects friction with evidence ids that exist in the recorded events', () => {
    const runs = fixture();
    const metrics = runs.map(computeRunMetrics);
    const clusters = clusterFriction(detectFriction(runs, metrics), { baseline: 6, candidate: 6 });
    const pricing = clusters.find((c) => c.variant === 'baseline' && c.code === 'pricing_not_found')!;
    expect(pricing.affected).toBe(3);
    const index = buildEvidenceIndex(runs);
    for (const c of clusters) for (const id of c.evidence_ids) expect(index.has(id)).toBe(true);
  });

  it('rejects findings whose evidence does not exist ("a score without evidence is invalid")', () => {
    const runs = fixture();
    const f: AttributedFinding = {
      auditor: 'ux',
      variant: 'baseline',
      finding: 'made up',
      topic: 'x',
      evidence_ids: ['nope:e1'],
      affected_segments: [],
      severity: 'high',
      confidence: 'high',
      claim: 'inference',
      proposed_experiment: 'y',
    };
    const res = buildConsensus([f], buildEvidenceIndex(runs), []);
    expect(res.items).toHaveLength(0);
    expect(res.rejected[0]!.reason).toMatch(/no valid evidence/);
  });

  it('two independent supporters → INFERENCE; a red-team challenge → HYPOTHESIS with disagreement', () => {
    const runs = fixture();
    const idx = buildEvidenceIndex(runs);
    const ev = ['baseline-p2:e4'];
    const mk = (auditor: AttributedFinding['auditor'], topic: string): AttributedFinding => ({
      auditor,
      variant: 'baseline',
      finding: `${auditor} says`,
      topic,
      evidence_ids: ev,
      affected_segments: ['Seg B'],
      severity: 'high',
      confidence: 'high',
      claim: 'inference',
      proposed_experiment: 'e',
    });
    const res = buildConsensus(
      [mk('ux', 't1'), mk('customer', 't1'), mk('ux', 't2'), mk('business', 't2'), mk('redteam', 't2')],
      idx,
      [],
    );
    const t1 = res.items.find((i) => i.topic === 't1')!;
    const t2 = res.items.find((i) => i.topic === 't2')!;
    expect(t1.claim).toBe('inference');
    expect(t1.disagreement).toBe(false);
    expect(t2.claim).toBe('hypothesis');
    expect(t2.disagreement).toBe(true);
    expect(t2.confidence).toBe('medium');
  });

  it('auditors are independent: the packet contains no findings', () => {
    const runs = fixture();
    const metrics = runs.map(computeRunMetrics);
    const s = summarizeVariant('baseline', metrics, runs);
    const packet = buildPacket(
      'baseline',
      runs,
      s,
      clusterFriction(detectFriction(runs, metrics), { baseline: 6 }),
    );
    expect(JSON.stringify(packet)).not.toMatch(/"finding"|"auditor"/);
  });
});

describe('LLM auditor robustness (mock provider, zero spend)', () => {
  const runs = fixture();
  const metrics = runs.map(computeRunMetrics);
  const s = summarizeVariant('baseline', metrics, runs);
  const packet = buildPacket(
    'baseline',
    runs,
    s,
    clusterFriction(detectFriction(runs, metrics), { baseline: 6 }),
  );

  it('malformed output → one repair attempt → deterministic fallback flagged degraded', async () => {
    const p = new MockProvider(() => 'I think the site is fine!');
    const res = await llmAudit(UX_AUDITOR, packet, p, new CostMeter());
    expect(p.calls).toBe(2);
    expect(res.degraded).toBe(true);
    expect(res.findings.length).toBeGreaterThan(0);
  });

  it('valid output is parsed and schema-checked', async () => {
    const good = JSON.stringify({
      findings: [
        {
          finding: 'f',
          topic: 'pricing_not_found',
          evidence_ids: ['baseline-p2:e4'],
          affected_segments: ['Seg B'],
          severity: 'high',
          confidence: 'medium',
          claim: 'inference',
          proposed_experiment: 'x',
        },
      ],
    });
    const res = await llmAudit(UX_AUDITOR, packet, new MockProvider(() => `Sure:\n${good}`), new CostMeter());
    expect(res.degraded).toBe(false);
    expect(res.findings[0]!.topic).toBe('pricing_not_found');
    expect(parseAuditorOutput('{"findings":[{"finding":"x"}]}').ok).toBe(false);
  });

  it('LLM buyer output is validated against real element ids', () => {
    const ctx = {
      brief: {} as never,
      obs: { elements: [{ idx: 3 }] } as never,
      memory: newMemory(1),
      step: 1,
      maxSteps: 5,
    };
    expect(parseAction('{"action":"click","target":3,"reason":"go"}', ctx)).toMatchObject({ ok: true });
    expect(parseAction('{"action":"click","target":99,"reason":"go"}', ctx)).toMatchObject({ ok: false });
    expect(parseAction('not json', ctx)).toMatchObject({ ok: false });
  });
});

describe('comparison, ROI and reports', () => {
  it('compares paired personas, prioritises evidence and renders outputs', async () => {
    const a = await analyzeRuns(fakeManifest(['baseline', 'candidate']), fixture());
    const c = a.comparison!;
    expect(c.n_pairs).toBe(6);
    expect(c.label).toBe('EXPLORATORY SIGNAL');
    const gc = c.rows.find((r) => r.metric === 'Goal completion')!;
    expect(gc.baseline).toBeCloseTo(1 / 6);
    expect(gc.candidate).toBeCloseTo(4 / 6);
    expect(gc.verdict).toBe('improved');
    expect(c.friction.find((f) => f.code === 'pricing_not_found')!.status).toBe('resolved');
    expect(c.friction.find((f) => f.code === 'required_phone')!.status).toBe('persisting');

    // Backlog is ranked, labelled and every item cites evidence.
    expect(a.backlog.length).toBeGreaterThan(0);
    for (let i = 1; i < a.backlog.length; i++)
      expect(a.backlog[i - 1]!.score).toBeGreaterThanOrEqual(a.backlog[i]!.score);
    for (const o of a.backlog) expect(o.evidence_ids.length).toBeGreaterThan(0);
    expect(a.backlog[0]!.topic).toBe('required_phone');

    const md = renderBacklog(a);
    expect(md).toContain('# ROI Backlog');
    expect(md).toContain(ROI_FORMULA);
    expect(md).toContain('CONVERSION PROXY');
    expect(md).not.toMatch(/\$\d|revenue lift/i);

    const html = renderReport(a, []);
    expect(html).toContain('<script id="data" type="application/json">');
    expect(html).not.toMatch(/<\/script><script>[^]*<\/script>[^]*<\/script>[^]*<\/script>/);
  });

  it('ROI score favours frequent, low-effort, blocking friction', () => {
    const base = {
      title: 't',
      variant: 'v',
      observed_fact: '',
      interpretation: '',
      claim: 'inference' as const,
      supporters: [],
      challenges: [],
      disagreement: false,
      evidence_ids: ['r:e1'],
      affected_segments: ['a'],
      proposed_experiments: ['x'],
    };
    const ranked = prioritize(
      [
        {
          ...base,
          id: 'F-1',
          topic: 'price_above_budget',
          severity: 'low',
          confidence: 'low',
          affected_runs: ['a'],
          blocking_runs: 1,
        },
        {
          ...base,
          id: 'F-2',
          topic: 'pricing_not_found',
          severity: 'high',
          confidence: 'high',
          affected_runs: ['a', 'b', 'c', 'd'],
          blocking_runs: 4,
        },
      ],
      { population: 10, totalSegments: 2 },
    );
    expect(ranked[0]!.topic).toBe('pricing_not_found');
    expect(ranked[0]!.leverage).toBe('HIGH-LEVERAGE EXPERIMENT');
    expect(ranked[1]!.leverage).toBe('LOW');
  });
});
