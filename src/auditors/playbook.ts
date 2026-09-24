export type Effort = 'low' | 'medium' | 'high';

export interface Play {
  /** Why this might be happening — always a hypothesis until tested. */
  likely_cause: string;
  experiment: string;
  effort: Effort;
  /** 0..1 — how easy it is to roll the change back. */
  reversibility: number;
  /** 0..1 — how cleanly a synthetic + real A/B test can measure it. */
  testability: number;
}

/**
 * Default remedies per friction code. Used to phrase proposed experiments and to seed
 * effort estimates in the ROI engine. Teams override effort in buyer-arena.config.
 */
export const PLAYBOOK: Record<string, Play> = {
  pricing_not_found: {
    likely_cause: 'pricing is not reachable from the primary navigation or hero',
    experiment: 'Add "Pricing" to the main and mobile navigation and show the entry price near the hero CTA.',
    effort: 'low',
    reversibility: 0.95,
    testability: 0.9,
  },
  cta_not_found: {
    likely_cause: 'the primary call-to-action is vague or not visible without scrolling',
    experiment:
      'Replace the generic hero CTA with an explicit action ("Start free trial") and repeat it in the header.',
    effort: 'low',
    reversibility: 0.95,
    testability: 0.9,
  },
  trust_gap: {
    likely_cause: 'no refund policy, guarantee or cancellation terms are visible before commitment',
    experiment: 'Show "30-day money-back · cancel anytime" on the pricing page and sign-up form.',
    effort: 'low',
    reversibility: 0.9,
    testability: 0.8,
  },
  required_phone: {
    likely_cause: 'the sign-up form requires a phone number buyers are unwilling to share',
    experiment: 'Make the phone field optional (or remove it) on self-serve sign-up.',
    effort: 'low',
    reversibility: 0.9,
    testability: 0.9,
  },
  card_for_trial: {
    likely_cause: 'a credit card is requested before a free trial can start',
    experiment: 'Offer a no-card trial and collect payment details at conversion time.',
    effort: 'medium',
    reversibility: 0.7,
    testability: 0.8,
  },
  price_above_budget: {
    likely_cause: 'the entry plan is above the budget of a price-sensitive segment',
    experiment: 'Test a lower-priced entry tier or annual discount for budget-constrained buyers.',
    effort: 'high',
    reversibility: 0.5,
    testability: 0.6,
  },
  intrusive_modal: {
    likely_cause: 'a pop-up interrupts the first visit and can be hard to dismiss (especially on phones)',
    experiment:
      'Delay the pop-up until engagement (or remove it) and guarantee a visible close button on small screens.',
    effort: 'low',
    reversibility: 0.95,
    testability: 0.95,
  },
  form_validation: {
    likely_cause: 'input rules (e.g. password requirements) are revealed only after a failed submit',
    experiment: 'Show field requirements inline before submission and validate as the user types.',
    effort: 'low',
    reversibility: 0.95,
    testability: 0.85,
  },
  navigation_loop: {
    likely_cause: 'information scent is weak; buyers revisit pages looking for the next step',
    experiment: 'Add a clear next-step link at the end of each key page (features → pricing → sign-up).',
    effort: 'low',
    reversibility: 0.9,
    testability: 0.7,
  },
  patience_exhausted: {
    likely_cause: 'the path to the goal is longer than time-pressed buyers tolerate',
    experiment: 'Shorten the path: fewer pages and fields between landing and first value.',
    effort: 'medium',
    reversibility: 0.8,
    testability: 0.7,
  },
  js_error: {
    likely_cause: 'a client-side script throws at runtime',
    experiment: 'Fix the failing script and add an error budget alert for key pages.',
    effort: 'low',
    reversibility: 1,
    testability: 0.9,
  },
  dead_link: {
    likely_cause: 'links point at pages that do not exist',
    experiment: 'Fix or remove broken links; add a link checker to CI.',
    effort: 'low',
    reversibility: 1,
    testability: 1,
  },
  server_error: {
    likely_cause: 'backend or network failures on key requests',
    experiment: 'Investigate failing endpoints; add retries and monitoring.',
    effort: 'medium',
    reversibility: 0.8,
    testability: 0.8,
  },
  long_journey: {
    likely_cause: 'some buyers take a detour before converting',
    experiment: 'Review the detour pages and add direct links to the conversion path.',
    effort: 'low',
    reversibility: 0.9,
    testability: 0.6,
  },
  other_objection: {
    likely_cause: 'buyers raised concerns not covered by the standard detectors',
    experiment: 'Review the quoted objections and address the most frequent one on the pricing page.',
    effort: 'medium',
    reversibility: 0.8,
    testability: 0.6,
  },
};

export const playFor = (code: string): Play =>
  PLAYBOOK[code] ?? {
    likely_cause: 'unclear',
    experiment: 'Investigate the linked journeys.',
    effort: 'medium',
    reversibility: 0.7,
    testability: 0.5,
  };
