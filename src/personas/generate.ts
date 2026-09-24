import { hashSeed, Rng } from '../core/rng.js';
import { PersonaSchema, PopulationSchema, type Persona, type Population } from '../core/types.js';
import { readStructured, writeStructured } from '../core/fs.js';
import { ARCHETYPES, FIRST_NAMES, LAST_INITIALS, TEMPLATES, type PopulationTemplate } from './templates.js';

export interface GenerateOptions {
  template: string;
  size: number;
  seed: number;
  /** Optional archetype weights (e.g. from calibration). Defaults to an even split. */
  weights?: Record<string, number>;
  /** Optional per-objection prevalence (e.g. from calibration). Default 0.8 for each archetype objection. */
  objectionRates?: Record<string, number>;
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

/**
 * Allocate archetypes deterministically. With even weights and size divisible by 5
 * every archetype gets exactly size/5 buyers (largest-remainder method otherwise).
 */
export function allocateArchetypes(size: number, ids: string[], weights?: Record<string, number>): string[] {
  // With explicit weights, archetypes that are not listed get none (calibration says they are absent).
  const w = ids.map((id) => Math.max(0, weights ? (weights[id] ?? 0) : 1));
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) throw new Error(`weights give zero share to every archetype (${ids.join(', ')})`);
  const exact = w.map((x) => (x / total) * size);
  const counts = exact.map(Math.floor);
  const order = exact
    .map((x, i) => [x - Math.floor(x), i] as const)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  let left = size - counts.reduce((a, b) => a + b, 0);
  for (const [, i] of order) {
    if (left-- <= 0) break;
    counts[i] = (counts[i] ?? 0) + 1;
  }
  // Interleave so the first N personas of any population cover all archetypes.
  const out: string[] = [];
  const remaining = [...counts];
  while (out.length < size) {
    for (let i = 0; i < ids.length; i++) {
      if ((remaining[i] ?? 0) > 0) {
        out.push(ids[i] as string);
        remaining[i] = (remaining[i] ?? 0) - 1;
      }
    }
  }
  return out;
}

export function generatePopulation(opts: GenerateOptions): Population {
  const template = TEMPLATES[opts.template];
  if (!template)
    throw new Error(`unknown template "${opts.template}". Available: ${Object.keys(TEMPLATES).join(', ')}`);
  if (!Number.isInteger(opts.size) || opts.size < 1) throw new Error('size must be a positive integer');
  const archetypeIds = Object.keys(template.flavors);
  const plan = allocateArchetypes(opts.size, archetypeIds, opts.weights);
  const personas = plan.map((archetype, i) =>
    buildPersona(template, archetype, i, opts.seed, opts.objectionRates),
  );
  return PopulationSchema.parse({
    version: 1,
    template: template.id,
    seed: opts.seed,
    size: opts.size,
    personas,
  });
}

function buildPersona(
  template: PopulationTemplate,
  archetypeId: string,
  index: number,
  seed: number,
  rates?: Record<string, number>,
): Persona {
  const profile = ARCHETYPES[archetypeId];
  const flavor = template.flavors[archetypeId];
  if (!profile || !flavor) throw new Error(`template ${template.id} lacks archetype ${archetypeId}`);
  const rng = new Rng(hashSeed(seed, template.id, index));
  const mobile = rng.next() < profile.mobile_share;
  const literacy = round(rng.range(...profile.technical_literacy));
  const accessibility: string[] = [];
  if (literacy < 0.3 && rng.next() < 0.5) accessibility.push('prefers larger text');
  const time_pressure = rng.pick(profile.time_pressure);
  const objections = [...profile.objections];
  // A little within-archetype heterogeneity: not every buyer carries every objection.
  const kept =
    objections.length > 1 || rates ? objections.filter((o) => rng.next() < (rates?.[o] ?? 0.8)) : objections;

  return PersonaSchema.parse({
    persona_id: `p-${String(index + 1).padStart(3, '0')}`,
    name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_INITIALS)}.`,
    segment: flavor.segment,
    archetype: archetypeId,
    age_band: rng.pick(profile.age_bands),
    budget: Math.round(rng.range(...profile.budget)),
    currency: template.currency,
    technical_literacy: literacy,
    purchase_urgency: rng.pick(profile.urgency),
    trust_threshold: round(rng.range(...profile.trust_threshold)),
    price_sensitivity: round(rng.range(...profile.price_sensitivity)),
    device: mobile
      ? { kind: 'mobile', viewport: { width: 390, height: 844 } }
      : {
          kind: 'desktop',
          viewport: rng.pick([
            { width: 1366, height: 768 },
            { width: 1440, height: 900 },
          ]),
        },
    language: 'en',
    motivation: rng.pick(flavor.motivations),
    goal: `find a ${template.product_noun} that fits and start using it`,
    objections: kept.length || rates ? kept : objections.slice(0, 1),
    prior_experience: rng.sample(flavor.prior_experience, Math.min(2, flavor.prior_experience.length)),
    time_pressure,
    accessibility_constraints: accessibility,
    custom_attributes: {},
  });
}

export function loadPopulation(path: string): Population {
  return PopulationSchema.parse(readStructured(path));
}

export function savePopulation(path: string, pop: Population): void {
  writeStructured(path, pop);
}
