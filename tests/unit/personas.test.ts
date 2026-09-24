import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { calibrate, calibrationError } from '../../src/calibration/calibration.js';
import { PersonaSchema, type BuyerBrief } from '../../src/core/types.js';
import {
  allocateArchetypes,
  generatePopulation,
  loadPopulation,
  savePopulation,
} from '../../src/personas/generate.js';
import { TEMPLATES } from '../../src/personas/templates.js';
import { assertNoLeak, buildBrief, buildStory } from '../../src/stories/story.js';
import { summarizeVariant, computeRunMetrics } from '../../src/metrics/run-metrics.js';
import { completedRun, pricingFailRun, tmp } from '../helpers.js';

const task = {
  id: 't',
  instruction: 'Find a tool and start using it.',
  success: { text_pattern: 'done' },
  checkout_url_pattern: 'checkout',
};

describe('population generation', () => {
  it('same seed → identical population; different seed → different', () => {
    const a = generatePopulation({ template: 'saas', size: 20, seed: 42 });
    const b = generatePopulation({ template: 'saas', size: 20, seed: 42 });
    const c = generatePopulation({ template: 'saas', size: 20, seed: 43 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it('20 buyers split evenly across 5 archetypes and all personas validate', () => {
    const pop = generatePopulation({ template: 'saas', size: 20, seed: 1 });
    const counts: Record<string, number> = {};
    for (const p of pop.personas) {
      expect(() => PersonaSchema.parse(p)).not.toThrow();
      counts[p.archetype] = (counts[p.archetype] ?? 0) + 1;
    }
    expect(Object.values(counts)).toEqual([4, 4, 4, 4, 4]);
    expect(new Set(pop.personas.map((p) => p.persona_id)).size).toBe(20);
  });

  it('every template generates valid populations', () => {
    for (const t of Object.keys(TEMPLATES))
      expect(generatePopulation({ template: t, size: 10, seed: 3 }).personas).toHaveLength(10);
  });

  it('rejects unknown templates and bad sizes', () => {
    expect(() => generatePopulation({ template: 'nope', size: 5, seed: 1 })).toThrow(/unknown template/);
    expect(() => generatePopulation({ template: 'saas', size: 0, seed: 1 })).toThrow();
  });

  it('round-trips YAML and JSON', () => {
    const dir = tmp();
    const pop = generatePopulation({ template: 'ecommerce', size: 7, seed: 9 });
    for (const f of ['p.yaml', 'p.json']) {
      savePopulation(join(dir, f), pop);
      expect(loadPopulation(join(dir, f))).toEqual(pop);
    }
  });

  it('largest-remainder allocation respects weights and size', () => {
    const plan = allocateArchetypes(10, ['a', 'b'], { a: 3, b: 1 });
    expect(plan.filter((x) => x === 'a')).toHaveLength(8);
    expect(plan).toHaveLength(10);
  });
});

describe('customer stories and buyer brief', () => {
  const pop = generatePopulation({ template: 'saas', size: 5, seed: 42 });
  const p = pop.personas[0]!;

  it('stories are deterministic and carry structured + narrative forms', () => {
    const s1 = buildStory(p, 'saas');
    expect(s1).toEqual(buildStory(p, 'saas'));
    expect(s1.narrative).toContain(p.name.split(' ')[0]);
    expect(s1.context.constraints[0]).toContain(String(p.budget));
  });

  it('brief never contains segment, archetype or variant metadata', () => {
    const brief: BuyerBrief = buildBrief(p, buildStory(p, 'saas'), task, 'http://127.0.0.1:1/');
    const blob = JSON.stringify(brief);
    expect(blob).not.toContain(p.segment);
    expect(blob).not.toContain('"archetype"');
    expect(() => assertNoLeak(brief, ['baseline', 'candidate', 'hypothesis'])).not.toThrow();
  });

  it('assertNoLeak catches a leaked hypothesis', () => {
    const leaky = buildBrief(
      p,
      buildStory(p, 'saas'),
      { ...task, instruction: 'The candidate variant should win.' },
      'http://x/',
    );
    expect(() => assertNoLeak(leaky, ['candidate'])).toThrow(/leaks/);
  });
});

describe('calibration', () => {
  it('turns aggregate segment shares into weights and rejects tiny groups', () => {
    const cal = calibrate({
      source: 'test',
      min_group_size: 50,
      segments: [
        { archetype: 'skeptic', share: 0.6 },
        { archetype: 'novice', share: 0.2 },
      ],
    });
    expect(cal.weights!.skeptic).toBeCloseTo(0.75);
    expect(cal.weights!.novice).toBeCloseTo(0.25);
    expect(() => calibrate({ source: 'x', min_group_size: 3 })).toThrow();
    const pop = generatePopulation({ template: 'saas', size: 20, seed: 1, weights: cal.weights });
    expect(pop.personas.filter((x) => x.archetype === 'skeptic')).toHaveLength(15);
  });

  it('rejects person-level fields (strict schema)', () => {
    expect(() => calibrate({ source: 'x', min_group_size: 20, email: 'a@b.c' } as never)).toThrow();
  });

  it('computes calibration error per funnel stage', () => {
    const runs = [completedRun('v', 'p1'), pricingFailRun('v', 'p2')];
    const sim = summarizeVariant('v', runs.map(computeRunMetrics), runs);
    const err = calibrationError(sim, [{ stage: 'goal_completed', rate: 0.1 }]);
    expect(err.rows[0]!.simulated).toBe(0.5);
    expect(err.rows[0]!.abs_error).toBeCloseTo(0.4);
    expect(err.rows[0]!.correction).toBeCloseTo(0.2);
  });
});
