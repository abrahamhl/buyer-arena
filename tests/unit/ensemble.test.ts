import { describe, expect, it } from 'vitest';
import { cohenKappa, compareEnsemble, sequenceDistance } from '../../src/ensemble/disagreement.js';
import type { Analysis } from '../../src/analysis.js';
import type { RunRecord } from '../../src/core/types.js';

const run = (persona: string, done: boolean, paths: string[], objection?: string) =>
  ({
    run_id: `candidate-${persona}`,
    variant: 'candidate',
    persona_id: persona,
    goal_completed: done,
    status: done ? 'completed' : 'abandoned',
    objection,
    url_history: paths.map((p) => `http://127.0.0.1:1${p}`),
  }) as unknown as RunRecord;

const analysis = (buyer: string, rate: number, clusters: { code: string; runs: string[] }[] = []) =>
  ({
    session: { buyer, usage: [] },
    backlog_variant: 'candidate',
    summaries: [{ variant: 'candidate', completion: { rate, lo: rate - 0.2, hi: rate + 0.2 } }],
    clusters: clusters.map((c) => ({ code: c.code, affected_runs: c.runs })),
  }) as unknown as Analysis;

describe('ensemble disagreement (experimental)', () => {
  it('distance and kappa primitives', () => {
    expect(sequenceDistance(['/', '/pricing'], ['/', '/pricing'])).toBe(0);
    expect(sequenceDistance(['/a'], ['/b'])).toBe(1);
    expect(cohenKappa([true, false, true, false], [true, false, true, false])).toBe(1);
    expect(cohenKappa([true, true], [true, true])).toBeNull();
  });

  it('reports agreement per pair and keeps uncertainty sources separate', () => {
    const h = [
      run('p1', true, ['/', '/signup']),
      run('p2', false, ['/', '/pricing'], 'price'),
      run('p3', true, ['/']),
    ];
    const m = [
      run('p1', true, ['/', '/signup']),
      run('p2', true, ['/', '/features']),
      run('p3', false, ['/'], 'trust'),
    ];
    const r = compareEnsemble([
      {
        label: 'heuristic',
        analysis: analysis('heuristic', 0.67, [{ code: 'popup', runs: ['candidate-p2'] }]),
        runs: h,
        repeats: [analysis('h', 0.6), analysis('h', 0.7)],
      },
      {
        label: 'llm',
        analysis: analysis('llm:x', 0.67, [{ code: 'popup', runs: ['candidate-p2'] }]),
        runs: m,
      },
    ]);
    expect(r.experimental).toBe(true);
    expect(r.pairs[0]).toMatchObject({
      pairs: 3,
      completion_agreement: 1 / 3,
      decision_agreement: 1 / 3,
      friction_jaccard: 1,
    });
    expect(r.model_disagreement).toBeCloseTo(2 / 3);
    expect(r.members[0]?.run_variance).toBeCloseTo(0.005);
    expect(r.members[0]?.population_ci_width).toBeCloseTo(0.4);
    expect(r.members[1]?.run_variance).toBeNull();
    expect(r.notes.join()).toMatch(/not ground truth/);
  });
});
