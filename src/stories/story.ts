import { hashSeed, Rng } from '../core/rng.js';
import { StorySchema, type BuyerBrief, type Persona, type Story, type Task } from '../core/types.js';
import { LANGS, MESSAGES, t, type Lang } from '../i18n/messages.js';
import { flavor } from '../i18n/stories.js';
import { OBJECTION_TEXT, TEMPLATES } from '../personas/templates.js';

const TIME_TEXT: Record<Persona['time_pressure'], string> = {
  low: 'has the afternoon to look around properly',
  medium: 'has about twenty minutes before the next thing',
  high: 'has ten minutes before another meeting',
};

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
  const narratives = Object.fromEntries(
    LANGS.map((lang) => [lang, narrate(lang, persona, templateId, first, { situation, pain, trigger })]),
  ) as Record<Lang, string>;
  return StorySchema.parse({
    persona_id: persona.persona_id,
    context: {
      situation,
      pain,
      trigger,
      constraints,
      success_looks_like: `${first} is set up with a ${template.product_noun} within budget`,
    },
    narrative: narratives.en,
    narratives,
  });
}

/** Compose the narrative in one language from keyed sentence templates and translated flavor. */
function narrate(
  lang: Lang,
  persona: Persona,
  templateId: string,
  name: string,
  f: { situation: string; pain: string; trigger: string },
): string {
  const tt = (k: string, p: Record<string, string | number> = {}) => t(lang, k, { name, ...p });
  const lit =
    persona.technical_literacy >= 0.75
      ? 'lit.high'
      : persona.technical_literacy >= 0.45
        ? 'lit.mid'
        : 'lit.low';
  const productKey = `story.product.${templateId}`;
  const product =
    MESSAGES[lang][productKey] ??
    MESSAGES.en[productKey] ??
    `this ${TEMPLATES[templateId]?.product_noun ?? 'product'}`;
  return [
    tt('story.s1', { situation: flavor(f.situation, lang) }),
    tt('story.s2', { pain: flavor(f.pain, lang) }),
    persona.prior_experience.length
      ? tt('story.s3', {
          prior: persona.prior_experience.map((x) => flavor(x, lang)).join(tt('story.prior_join')),
        })
      : '',
    tt('story.s4', { budget: persona.budget, currency: persona.currency, literacy: tt(lit) }),
    tt('story.s5', { product, trigger: flavor(f.trigger, lang), time: tt(`time.${persona.time_pressure}`) }),
    persona.objections.length
      ? tt('story.s6', { objections: persona.objections.map((o) => tt(`obj.${o}`)).join(tt('story.join')) })
      : '',
  ]
    .filter(Boolean)
    .join(' ');
}

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
