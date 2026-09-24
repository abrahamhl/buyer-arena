import { hashSeed, Rng } from '../core/rng.js';
import { StorySchema, type BuyerBrief, type Persona, type Story, type Task } from '../core/types.js';
import { OBJECTION_TEXT, TEMPLATES } from '../personas/templates.js';

const TIME_TEXT: Record<Persona['time_pressure'], string> = {
  low: 'has the afternoon to look around properly',
  medium: 'has about twenty minutes before the next thing',
  high: 'has ten minutes before another meeting',
};

const LITERACY_TEXT = (x: number) =>
  x >= 0.75 ? 'is comfortable with software' : x >= 0.45 ? 'gets by with most websites' : 'finds most software confusing';

/** Deterministically turn a persona into a scenario (structured + narrative). */
export function buildStory(persona: Persona, templateId: string): Story {
  const template = TEMPLATES[templateId];
  const flavor = template?.flavors[persona.archetype];
  if (!template || !flavor) throw new Error(`no story material for ${templateId}/${persona.archetype}`);
  const rng = new Rng(hashSeed('story', templateId, persona.persona_id));
  const first = persona.name.split(' ')[0] ?? persona.name;
  const situation = rng.pick(flavor.situations);
  const pain = rng.pick(flavor.pains);
  const trigger = rng.pick(flavor.triggers);
  const constraints = [
    `${persona.budget} ${persona.currency}/month maximum`,
    TIME_TEXT[persona.time_pressure],
    persona.device.kind === 'mobile' ? 'only has a phone right now' : 'is on a laptop',
    ...persona.objections.map((o) => OBJECTION_TEXT[o] ?? o),
  ];
  const narrative = [
    `${first} ${situation}.`,
    `Right now ${first} ${pain}.`,
    persona.prior_experience.length ? `In the past, ${first} ${persona.prior_experience.join(' and ')}.` : '',
    `${cap(first)} can spend up to ${persona.budget} ${persona.currency} a month and ${LITERACY_TEXT(persona.technical_literacy)}.`,
    `${cap(first)} finds this ${template.product_noun} because ${trigger}, and ${TIME_TEXT[persona.time_pressure]}.`,
    persona.objections.length ? `${cap(first)} ${persona.objections.map((o) => OBJECTION_TEXT[o] ?? o).join(', and ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return StorySchema.parse({
    persona_id: persona.persona_id,
    context: {
      situation,
      pain,
      trigger,
      constraints,
      success_looks_like: `${first} is set up with a ${template.product_noun} within budget`,
    },
    narrative,
  });
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Build the ONLY context a buyer agent receives. It is assembled from an explicit
 * allow-list: segment/archetype labels, variant names and any experiment metadata
 * cannot leak because they are never copied.
 */
export function buildBrief(persona: Persona, story: Story, task: Task, startUrl: string): BuyerBrief {
  return {
    persona: {
      persona_id: persona.persona_id,
      name: persona.name,
      age_band: persona.age_band,
      budget: persona.budget,
      currency: persona.currency,
      technical_literacy: persona.technical_literacy,
      purchase_urgency: persona.purchase_urgency,
      trust_threshold: persona.trust_threshold,
      price_sensitivity: persona.price_sensitivity,
      device: persona.device,
      language: persona.language,
      motivation: persona.motivation,
      goal: persona.goal,
      objections: persona.objections,
      prior_experience: persona.prior_experience,
      time_pressure: persona.time_pressure,
      accessibility_constraints: persona.accessibility_constraints,
    },
    story: story.narrative,
    task: task.instruction,
    start_url: startUrl,
  };
}

/** Throws if any forbidden term (variant label, hypothesis text…) appears in the brief. */
export function assertNoLeak(brief: BuyerBrief, forbidden: string[]): void {
  const blob = JSON.stringify({ ...brief, start_url: '' }).toLowerCase();
  for (const term of forbidden) {
    const t = term.trim().toLowerCase();
    if (t.length >= 3 && blob.includes(t)) throw new Error(`buyer brief leaks forbidden term "${term}"`);
  }
}
