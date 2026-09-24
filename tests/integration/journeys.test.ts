import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { analyzeSession } from '../../src/analysis.js';
import { buildEvidenceIndex } from '../../src/metrics/friction.js';
import { startDemoStore, type DemoStore } from '../../src/demo-store/server.js';
import { generatePopulation } from '../../src/personas/generate.js';
import { MockProvider } from '../../src/providers/index.js';
import { writeReports } from '../../src/reports/index.js';
import { loadRuns, runSession } from '../../src/simulator/session.js';
import { DEMO_TASK } from '../../src/workflow.js';
import { tmp } from '../helpers.js';

let baseline: DemoStore;
let candidate: DemoStore;
const pop = generatePopulation({ template: 'saas', size: 10, seed: 42 });

beforeAll(async () => {
  [baseline, candidate] = await Promise.all([startDemoStore('baseline'), startDemoStore('candidate')]);
});
afterAll(async () => {
  await Promise.all([baseline?.close(), candidate?.close()]);
});

const variants = () => [
  { name: 'baseline', url: baseline.url },
  { name: 'candidate', url: candidate.url },
];

describe('real browser journeys against the demo product', () => {
  it('captures journeys, persists evidence and the candidate outperforms the baseline', async () => {
    const root = tmp();
    const res = await runSession({
      root,
      sessionId: 's1',
      population: pop,
      task: DEMO_TASK,
      variants: variants(),
      screenshots: true,
      trace: 'failed',
    });
    expect(res.runs).toHaveLength(20);
    expect(res.manifest.status).toBe('complete');

    const rate = (v: string) => res.runs.filter((r) => r.variant === v && r.goal_completed).length;
    expect(rate('candidate')).toBeGreaterThan(rate('baseline'));

    // Evidence persisted on disk: run records, stories, screenshots, traces for failures.
    const failed = res.runs.find((r) => !r.goal_completed)!;
    const dir = join(res.dir, 'runs', failed.variant, failed.persona_id);
    expect(existsSync(join(dir, 'run.json'))).toBe(true);
    expect(existsSync(join(dir, 'story.json'))).toBe(true);
    expect(existsSync(join(dir, 'trace.zip'))).toBe(true);
    const shots = failed.events.filter((e) => e.screenshot);
    expect(shots.length).toBeGreaterThan(0);
    expect(existsSync(join(dir, shots[0]!.screenshot!))).toBe(true);
    expect(failed.events.some((e) => e.type === 'abandon')).toBe(true);

    // Engineering signal captured from the real page: the baseline pricing script throws.
    expect(
      res.runs.some((r) => r.variant === 'baseline' && r.events.some((e) => e.type === 'page_error')),
    ).toBe(true);
    // Passwords are never written to evidence in clear text.
    expect(JSON.stringify(res.runs)).not.toContain('Tb!p-');

    // Full analysis + reports; every consensus finding links to real events.
    const analysis = await analyzeSession(res.dir);
    const index = buildEvidenceIndex(loadRuns(res.dir));
    for (const audit of Object.values(analysis.audits)) {
      expect(audit.consensus.length).toBeGreaterThan(0);
      for (const item of audit.consensus)
        for (const id of item.evidence_ids) expect(index.has(id)).toBe(true);
    }
    const paths = writeReports(res.dir, analysis);
    expect(readFileSync(paths.html, 'utf8')).toContain('BUYER ARENA');
    expect(readFileSync(paths.backlog, 'utf8')).toContain('## Ranked experiments');
  });

  it('mock buyers are deterministic: same seed → identical journeys', async () => {
    const one = pop.personas.slice(0, 5);
    const sub = { ...pop, personas: one };
    const a = await runSession({
      root: tmp(),
      sessionId: 'a',
      population: sub,
      task: DEMO_TASK,
      variants: variants(),
      screenshots: false,
      trace: 'off',
    });
    const b = await runSession({
      root: tmp(),
      sessionId: 'b',
      population: sub,
      task: DEMO_TASK,
      variants: variants(),
      screenshots: false,
      trace: 'off',
      maxParallel: 1,
    });
    const sig = (runs: typeof a.runs) =>
      runs.map(
        (r) =>
          `${r.run_id}|${r.status}|${r.events
            .filter((e) => e.type === 'decision')
            .map((e) => e.target ?? e.detail)
            .join('>')}`,
      );
    expect(sig(a.runs)).toEqual(sig(b.runs));
  });

  it('resumes after interruption without re-running completed journeys', async () => {
    const root = tmp();
    const ac = new AbortController();
    let seen = 0;
    const first = await runSession({
      root,
      sessionId: 'r',
      population: pop,
      task: DEMO_TASK,
      variants: variants(),
      screenshots: false,
      trace: 'off',
      maxParallel: 1,
      signal: ac.signal,
      onRun: () => {
        if (++seen === 6) ac.abort();
      },
    });
    expect(first.manifest.status).toBe('interrupted');
    const done = first.runs.length;
    expect(done).toBeGreaterThanOrEqual(6);
    expect(done).toBeLessThan(20);

    const second = await runSession({
      root,
      sessionId: 'r',
      population: pop,
      task: DEMO_TASK,
      variants: variants(),
      screenshots: false,
      trace: 'off',
    });
    expect(second.skipped).toBe(done);
    expect(second.executed).toBe(20 - done);
    expect(second.manifest.status).toBe('complete');
  });

  it('enforces the LLM budget: the session stops, never overspends, and records why', async () => {
    const provider = new MockProvider(() => '{"action":"scroll","reason":"looking around"}', 'mock-priced', {
      input: 50,
      output: 200,
    });
    const res = await runSession({
      root: tmp(),
      sessionId: 'budget',
      population: { ...pop, personas: pop.personas.slice(0, 4) },
      task: DEMO_TASK,
      variants: variants(),
      provider,
      budgetUsd: 0.2,
      screenshots: false,
      trace: 'off',
      maxParallel: 1,
    });
    expect(res.manifest.status).toBe('budget_exhausted');
    const spent = res.manifest.usage.reduce((s, u) => s + u.estimated_cost_usd, 0);
    expect(spent).toBeLessThanOrEqual(0.2);
    expect(spent).toBeGreaterThan(0);
    expect(res.runs.some((r) => r.status === 'budget_exhausted')).toBe(true);
  });

  it('survives provider failure: the run is marked error with evidence and the session continues', async () => {
    const provider = new MockProvider((_, i) =>
      i === 0
        ? new Error('upstream exploded')
        : '{"action":"abandon","reason":"not for me","objection":"test"}',
    );
    const res = await runSession({
      root: tmp(),
      sessionId: 'fail',
      population: { ...pop, personas: pop.personas.slice(0, 2) },
      task: DEMO_TASK,
      variants: [variants()[0]!],
      provider,
      screenshots: false,
      trace: 'off',
      maxParallel: 1,
    });
    expect(res.runs).toHaveLength(2);
    const errored = res.runs.find((r) => r.status === 'error')!;
    expect(errored.events.some((e) => e.type === 'provider_error')).toBe(true);
    expect(res.runs.some((r) => r.status === 'abandoned' && r.policy.startsWith('llm:mock'))).toBe(true);
    expect(res.manifest.status).toBe('interrupted'); // the errored run is retried on resume
  });

  it('malformed LLM buyer output falls back to the deterministic buyer', async () => {
    const provider = new MockProvider(() => 'Honestly I would just click around.');
    const res = await runSession({
      root: tmp(),
      sessionId: 'mal',
      population: { ...pop, personas: pop.personas.slice(1, 2) },
      task: DEMO_TASK,
      variants: [variants()[1]!],
      provider,
      screenshots: false,
      trace: 'off',
    });
    const run = res.runs[0]!;
    expect(run.goal_completed).toBe(true);
    expect(run.events.some((e) => e.type === 'decision' && e.data?.llm_fallback)).toBe(true);
    expect(run.usage?.calls).toBeGreaterThan(0);
  });
});
