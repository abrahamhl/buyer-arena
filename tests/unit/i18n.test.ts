import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LANGS, MESSAGES, t } from '../../src/i18n/messages.js';
import { FLAVOR } from '../../src/i18n/stories.js';
import { DETECTORS } from '../../src/metrics/friction.js';
import { generatePopulation } from '../../src/personas/generate.js';
import { TEMPLATES } from '../../src/personas/templates.js';
import { buildStory } from '../../src/stories/story.js';

describe('i18n (ES · EN · NL)', () => {
  it('every language has exactly the same keys and no empty strings', () => {
    const en = Object.keys(MESSAGES.en).sort();
    for (const l of LANGS) {
      expect(Object.keys(MESSAGES[l]).sort()).toEqual(en);
      for (const [k, v] of Object.entries(MESSAGES[l])) expect(v.trim(), `${l}:${k}`).not.toBe('');
    }
  });

  it('placeholders match across languages', () => {
    const ph = (s: string) =>
      [...s.matchAll(/\{(\w+)\}/g)]
        .map((m) => m[1])
        .sort()
        .join(',');
    for (const k of Object.keys(MESSAGES.en))
      for (const l of LANGS)
        expect(ph(MESSAGES[l][k] as string), `${l}:${k}`).toBe(ph(MESSAGES.en[k] as string));
  });

  it('every friction detector has a title, cause and experiment in every language', () => {
    for (const d of DETECTORS)
      for (const p of ['fr', 'cause', 'exp'])
        expect(MESSAGES.en[`${p}.${d.code}`], `${p}.${d.code}`).toBeTruthy();
  });

  it('every reason key used by the buyer and journey engine exists', () => {
    const src = ['src/simulator/heuristic.ts', 'src/simulator/journey.ts']
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    const keys = [...src.matchAll(/'(reason\.[\w.]+)'/g)].map((m) => m[1] as string);
    expect(keys.length).toBeGreaterThan(15);
    for (const k of keys) expect(MESSAGES.en[k], k).toBeTruthy();
    for (const s of ['price', 'trust', 'commit']) expect(MESSAGES.en[`reason.giveup.${s}`]).toBeTruthy();
  });

  it('all saas story material is translated, so stories really change language', () => {
    const f = TEMPLATES.saas!.flavors;
    for (const a of Object.values(f))
      for (const s of [...a.situations, ...a.pains, ...a.triggers, ...a.prior_experience])
        for (const l of ['es', 'nl'] as const) expect(FLAVOR[s]?.[l], `${l}: ${s}`).toBeTruthy();
    const p = generatePopulation({ template: 'saas', size: 5, seed: 42 }).personas[0]!;
    const n = buildStory(p, 'saas').narratives!;
    expect(n.es).not.toBe(n.en);
    expect(n.nl).not.toBe(n.en);
    expect(n.es).toContain(p.name.split(' ')[0]);
  });

  it('formats with params and falls back to English', () => {
    expect(t('es', 'fr.buyers', { a: 3, n: 20 })).toBe('3 de 20 compradores');
    expect(t('nl', 'does.not.exist')).toBe('does.not.exist');
  });
});
