import type { ElementInfo, Observation } from '../browser/observe.js';
import { hashSeed, Rng } from '../core/rng.js';
import type { BuyerBrief } from '../core/types.js';
import {
  type Action,
  type BuyerMemory,
  type BuyerPolicy,
  type DecideContext,
  pathOf,
  say,
  type Say,
  seenElements,
} from './policy.js';
import { en_ } from '../i18n/messages.js';

export const KW = {
  price: /pric|plans?\b|billing|cost|subscription/i,
  cta: /start|trial|sign ?up|get started|create (an )?account|register|buy|subscribe|choose|select|join|try it|continue|checkout/i,
  trust: /refund|guarantee|money.back|terms|faq|security|cancel/i,
  explore: /product|features?|how it works|learn more|overview/i,
  avoid: /sign ?in|log ?in|privacy|careers|blog|api|press|guide/i,
  sales: /demo|sales|contact/i,
  close: /no thanks|close|dismiss|not now|later|skip|^×$|^✕$/i,
  menu: /menu|☰|navigation/i,
};

/** Behavioural traits derived ONLY from persona attributes in the brief. */
export interface Traits {
  needsPrice: boolean;
  needsTrust: boolean;
  scrollBudget: number;
  formPatience: number;
  fillsOptional: boolean;
  usesNav: boolean;
  refusesPhone: boolean;
  refusesCardForTrial: boolean;
  refusesAccount: boolean;
}

export function traitsOf(brief: BuyerBrief): Traits {
  const p = brief.persona;
  const lit = p.technical_literacy;
  const mobile = p.device.kind === 'mobile';
  return {
    needsPrice: p.price_sensitivity >= 0.4 || p.objections.includes('hidden-costs'),
    needsTrust: p.trust_threshold >= 0.7,
    scrollBudget: mobile ? 1 : lit >= 0.6 ? 3 : lit >= 0.4 ? 2 : 1,
    formPatience: lit < 0.3 ? 1 : 2,
    fillsOptional: lit < 0.45,
    usesNav: lit >= 0.45,
    refusesPhone: p.objections.includes('no-phone-number'),
    refusesCardForTrial: p.objections.includes('no-card-for-trial'),
    refusesAccount: p.objections.includes('no-account'),
  };
}

export function stepBudget(brief: BuyerBrief): number {
  return { high: 10, medium: 14, low: 18 }[brief.persona.time_pressure];
}

type Subgoal = 'price' | 'trust' | 'commit';

const isCardField = (e: ElementInfo) => /card|cc-number|credit/i.test(`${e.name ?? ''} ${e.label ?? ''}`);
const isPhoneField = (e: ElementInfo) =>
  e.inputType === 'tel' || /phone|mobile number/i.test(`${e.name ?? ''} ${e.label ?? ''}`);
const isEmailField = (e: ElementInfo) =>
  e.inputType === 'email' || /e-?mail/i.test(`${e.name ?? ''} ${e.label ?? ''}`);
const isPasswordField = (e: ElementInfo) => e.inputType === 'password';
const fillable = (e: ElementInfo) =>
  e.kind === 'input' || e.kind === 'textarea' || e.kind === 'select' || e.kind === 'checkbox';

/**
 * Deterministic, attribute-driven buyer. It reads the page like a person with the given
 * literacy, patience, budget and objections would: it only acts on what it has scrolled
 * into view, looks for what it needs next, and gives up when it cannot find it.
 * It has no knowledge of the site's structure or of which variant it is on.
 */
export class HeuristicBuyer implements BuyerPolicy {
  readonly name = 'heuristic';

  async decide(ctx: DecideContext): Promise<{ action: Action; meta?: Record<string, unknown> }> {
    const { brief, obs, memory } = ctx;
    const t = traitsOf(brief);
    const rng = new Rng(hashSeed(memory.seed, ctx.step, obs.url));
    const path = pathOf(obs.url);
    const visible = seenElements(obs, memory).filter((e) => !e.blocked);

    // 1. Interruptions first: a modal must be dealt with before anything else.
    if (obs.modalOpen) {
      if (memory.modalsDismissed >= 2) return abandon(say('reason.popup_quit'), 'intrusive-popup');
      const onScreen = obs.elements.filter(
        (e) => e.y - obs.scrollY < obs.viewport.height && e.y - obs.scrollY >= 0,
      );
      const close = onScreen.find(
        (e) => e.region === 'dialog' && (e.kind === 'button' || e.kind === 'link') && KW.close.test(e.text),
      );
      return {
        action: {
          kind: 'dismiss',
          idx: close?.idx,
          ...(close ? say('reason.popup_close', { text: close.text }) : say('reason.popup_escape')),
        },
      };
    }

    // 2. Hard objections that end the journey.
    if (memory.distrustSeen.length && t.needsTrust) {
      return abandon(
        say('reason.distrust', { text: memory.distrustSeen[0] ?? '' }),
        'needs-refund-guarantee',
      );
    }
    if (t.needsPrice && memory.pricesSeen.length) {
      const cheapest = Math.min(...memory.pricesSeen);
      if (cheapest > brief.persona.budget) {
        return abandon(
          say('reason.too_expensive', {
            price: cheapest,
            currency: brief.persona.currency,
            budget: brief.persona.budget,
          }),
          'price-too-high',
        );
      }
    }

    // 3. A goal-relevant form (signup or payment) on screen → fill it.
    const form = this.goalForm(visible);
    if (form) {
      const res = this.fillForm(form, ctx, t);
      if (res) return res;
    }

    // 4. Navigate towards the current subgoal.
    const subgoal = this.subgoal(t, memory);
    const scored = visible
      .filter((e) => e.kind === 'link' || e.kind === 'button' || e.kind === 'submit')
      .map((e) => ({ e, s: this.score(e, subgoal, t, memory, obs) + rng.next() * 0.3 }))
      .sort((a, b) => b.s - a.s);
    const best = scored[0];
    if (best && best.s >= 2.5) {
      return {
        action: {
          kind: 'click',
          idx: best.e.idx,
          ...sayWithSub('reason.click', subgoal, { text: best.e.text }),
        },
        meta: {
          subgoal,
          score: round(best.s),
          alternatives: scored.slice(1, 4).map((x) => ({ text: x.e.text, score: round(x.s) })),
        },
      };
    }

    // 5. Nothing promising in view: scroll, open the menu, go back, or give up.
    const scrolled = memory.scrolls[path] ?? 0;
    const moreBelow =
      Math.max(obs.scrollY, memory.depth[path] ?? 0) + obs.viewport.height < obs.scrollHeight - 4;
    if (moreBelow && scrolled < t.scrollBudget) {
      return {
        action: {
          kind: 'scroll',
          ...sayWithSub('reason.scroll', subgoal),
        },
        meta: { subgoal },
      };
    }
    const menu = visible.find((e) => e.kind === 'button' && KW.menu.test(e.text) && e.expanded === false);
    if (menu && !memory.menuOpened[path]) {
      return {
        action: { kind: 'click', idx: menu.idx, ...say('reason.menu') },
        meta: { subgoal, menu: true },
      };
    }
    if (best && best.s >= 1) {
      return {
        action: {
          kind: 'click',
          idx: best.e.idx,
          ...sayWithSub('reason.guess', subgoal, { text: best.e.text }),
        },
        meta: { subgoal, score: round(best.s), guess: true },
      };
    }
    if (memory.visited.length > 1 && memory.backs < 2) {
      return { action: { kind: 'back', ...say('reason.back') }, meta: { subgoal } };
    }
    return abandon(
      say(`reason.giveup.${subgoal}`),
      subgoal === 'trust' ? 'needs-refund-guarantee' : undefined,
    );
  }

  private subgoal(t: Traits, m: BuyerMemory): Subgoal {
    if (t.needsPrice && m.pricesSeen.length === 0) return 'price';
    if (t.needsTrust && m.trustSeen.length === 0 && m.actions.filter((a) => a.kind === 'click').length < 8)
      return 'trust';
    return 'commit';
  }

  private score(e: ElementInfo, g: Subgoal, t: Traits, m: BuyerMemory, obs: Observation): number {
    const text = `${e.text} ${e.href ? pathOf(e.href) : ''}`;
    let s = 0;
    if (g === 'price' && KW.price.test(text)) s += 3;
    if (g === 'trust' && KW.trust.test(text)) s += 3;
    if (g === 'commit' && KW.cta.test(e.text)) s += 3;
    if (g !== 'commit' && KW.cta.test(e.text)) s += 0.5;
    if (KW.explore.test(e.text)) s += 1;
    if (e.prominent) s += 0.8;
    if (e.y < obs.viewport.height) s += 0.4;
    if ((e.region === 'nav' || e.region === 'menu') && t.usesNav) s += 0.5;
    if (KW.avoid.test(text)) s -= 2;
    if (KW.sales.test(e.text)) s -= 1;
    if (e.kind === 'submit') s -= 3; // never submit a form it has not filled
    if (e.href) {
      try {
        const target = new URL(e.href);
        if (target.origin !== new URL(obs.url).origin) s -= 6;
        if (m.visited.includes(target.pathname + target.search) || m.visited.includes(target.pathname))
          s -= 4;
        if (target.pathname + target.search === pathOf(obs.url)) s -= 6;
      } catch {
        s -= 1;
      }
    }
    return s;
  }

  private goalForm(visible: ElementInfo[]): ElementInfo[] | null {
    const byForm = new Map<number, ElementInfo[]>();
    for (const e of visible)
      if (e.formIdx !== undefined) byForm.set(e.formIdx, [...(byForm.get(e.formIdx) ?? []), e]);
    for (const els of byForm.values()) {
      const goal = els.some(isPasswordField) && els.some(isEmailField);
      const pay = els.some(isCardField);
      const submit = els.find((e) => e.kind === 'submit');
      if ((goal || pay) && submit && !/sign ?in|log ?in/i.test(submit.text)) return els;
    }
    return null;
  }

  private fillForm(
    els: ElementInfo[],
    ctx: DecideContext,
    t: Traits,
  ): { action: Action; meta?: Record<string, unknown> } | null {
    const { brief, memory, obs } = ctx;
    const p = brief.persona;
    if (memory.formErrors > t.formPatience) {
      return abandon(say('reason.form_rejects'), 'complex-forms');
    }
    // Buyers who will not create an account leave when the only path is a password sign-up.
    if (t.refusesAccount && els.some(isPasswordField)) return abandon(say('reason.no_account'), 'no-account');
    const phone = els.find((e) => isPhoneField(e) && e.required);
    if (phone && t.refusesPhone) return abandon(say('reason.phone'), 'no-phone-number');
    const card = els.find(isCardField);
    if (card) {
      const pageText = obs.blocks.map((b) => b.text).join(' ');
      if (t.refusesCardForTrial && /trial/i.test(pageText)) {
        return abandon(say('reason.card_trial'), 'no-card-for-trial');
      }
      const testCard = (card.hint ?? '').match(/(\d{4}[ -]?){3}\d{4}/)?.[0];
      if (!testCard) return abandon(say('reason.real_payment'), 'payment-details');
    }
    if (t.needsTrust && memory.trustSeen.length === 0 && (card || els.some(isPasswordField))) {
      // Skeptics want reassurance before committing; look for it once before signing up.
      const trustLinks = seenElements(obs, memory).filter(
        (e) => e.kind === 'link' && KW.trust.test(e.text) && !memory.visited.includes(pathOf(e.href ?? '')),
      );
      if (trustLinks[0]) {
        return {
          action: {
            kind: 'click',
            idx: trustLinks[0].idx,
            ...say('reason.check_refund', { text: trustLinks[0].text }),
          },
          meta: { subgoal: 'trust' },
        };
      }
      return abandon(say('reason.no_refund'), 'needs-refund-guarantee');
    }

    const hintText = [...els.map((e) => e.hint ?? ''), ...obs.alerts].join(' ');
    const knowsRules = /at least|characters|symbol|number/i.test(hintText) || p.technical_literacy >= 0.6;
    const fields: { idx: number; value: string }[] = [];
    for (const e of els) {
      if (!fillable(e)) continue;
      if (!e.required && !t.fillsOptional && !isEmailField(e) && !isPasswordField(e) && e.kind !== 'select')
        continue;
      if (e.kind === 'checkbox') {
        if (e.required) fields.push({ idx: e.idx, value: 'true' });
        continue;
      }
      if (e.kind === 'select') {
        const opt = pickOption(e.options ?? [], p.budget);
        if (opt) fields.push({ idx: e.idx, value: opt });
        continue;
      }
      fields.push({ idx: e.idx, value: syntheticValue(e, p.persona_id, knowsRules, card) });
    }
    const submit = els.find((e) => e.kind === 'submit');
    if (!submit) return null;
    return {
      action: {
        kind: 'fill_form',
        fields,
        submitIdx: submit.idx,
        ...say(card ? 'reason.fill_card' : 'reason.fill_signup'),
      },
      meta: { knowsPasswordRules: knowsRules, fields: fields.length },
    };
  }
}

function syntheticValue(
  e: ElementInfo,
  personaId: string,
  strongPassword: boolean,
  card?: ElementInfo,
): string {
  const key = `${e.name ?? ''} ${e.label ?? ''}`.toLowerCase();
  if (isEmailField(e)) return `${personaId}@buyers.example.test`;
  if (isPasswordField(e))
    return strongPassword ? `Tb!${personaId}-2026` : `sunshine${personaId.replace(/\D/g, '')}`;
  if (isPhoneField(e)) return '555-0100';
  if (card && e === card) return (card.hint ?? '').match(/(\d{4}[ -]?){3}\d{4}/)?.[0] ?? '';
  if (/exp/.test(key)) return '12/30';
  if (/cvc|cvv/.test(key)) return '123';
  if (/company|organi[sz]ation|business/.test(key)) return 'Synthetic Studio';
  if (/name/.test(key)) return 'Synthetic Buyer';
  return 'n/a';
}

function pickOption(options: string[], budget: number): string | undefined {
  const priced = options
    .map((o) => ({ o, price: Number(o.match(/[€$£]\s?(\d+)/)?.[1] ?? NaN) }))
    .filter((x) => !Number.isNaN(x.price));
  const affordable = priced.filter((x) => x.price <= budget).sort((a, b) => a.price - b.price);
  return affordable[0]?.o ?? priced.sort((a, b) => a.price - b.price)[0]?.o ?? options[0];
}

/** A reason that mentions the current subgoal: English text inline, subgoal key for translation. */
function sayWithSub(k: string, sub: Subgoal, p: Record<string, string | number> = {}): Say {
  const s = say(k, { ...p, sub: en_(`sub.${sub}`) });
  return { reason: s.reason, i18n: { k, p: { ...p, sub: `@sub.${sub}` } } };
}

const abandon = (s: Say, objection?: string): { action: Action } => ({
  action: { kind: 'abandon', ...s, objection },
});
const round = (n: number) => Math.round(n * 100) / 100;
