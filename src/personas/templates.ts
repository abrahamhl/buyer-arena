import type { Level } from '../core/types.js';

/**
 * Behavioural profile shared by every template. Archetypes are defined by attribute
 * RANGES, not scripts: the buyer engine only ever reads the sampled attributes.
 */
export interface ArchetypeProfile {
  id: string;
  budget: [number, number];
  technical_literacy: [number, number];
  trust_threshold: [number, number];
  price_sensitivity: [number, number];
  urgency: Level[];
  time_pressure: Level[];
  mobile_share: number;
  age_bands: string[];
  objections: string[];
}

export const ARCHETYPES: Record<string, ArchetypeProfile> = {
  'price-sensitive': {
    id: 'price-sensitive',
    budget: [10, 40],
    technical_literacy: [0.55, 0.85],
    trust_threshold: [0.3, 0.55],
    price_sensitivity: [0.75, 0.95],
    urgency: ['low', 'medium'],
    time_pressure: ['low', 'medium'],
    mobile_share: 0,
    age_bands: ['25-34', '35-44', '45-54'],
    objections: ['hidden-costs', 'price-too-high'],
  },
  'goal-focused': {
    id: 'goal-focused',
    budget: [60, 150],
    technical_literacy: [0.7, 0.95],
    trust_threshold: [0.15, 0.4],
    price_sensitivity: [0.1, 0.35],
    urgency: ['high'],
    time_pressure: ['medium', 'high'],
    mobile_share: 0,
    age_bands: ['25-34', '35-44'],
    objections: ['slow-onboarding'],
  },
  novice: {
    id: 'novice',
    budget: [25, 70],
    technical_literacy: [0.1, 0.4],
    trust_threshold: [0.35, 0.6],
    price_sensitivity: [0.4, 0.65],
    urgency: ['medium'],
    time_pressure: ['low', 'medium'],
    mobile_share: 0,
    age_bands: ['45-54', '55-64', '65+'],
    objections: ['jargon', 'complex-forms'],
  },
  'mobile-rushed': {
    id: 'mobile-rushed',
    budget: [30, 90],
    technical_literacy: [0.45, 0.75],
    trust_threshold: [0.25, 0.5],
    price_sensitivity: [0.45, 0.7],
    urgency: ['high'],
    time_pressure: ['high'],
    mobile_share: 1,
    age_bands: ['18-24', '25-34'],
    objections: ['long-forms', 'no-phone-number'],
  },
  skeptic: {
    id: 'skeptic',
    budget: [40, 120],
    technical_literacy: [0.6, 0.9],
    trust_threshold: [0.75, 0.95],
    price_sensitivity: [0.35, 0.6],
    urgency: ['low'],
    time_pressure: ['low'],
    mobile_share: 0,
    age_bands: ['35-44', '45-54', '55-64'],
    objections: ['needs-refund-guarantee', 'no-card-for-trial', 'no-phone-number'],
  },
};

export const OBJECTION_TEXT: Record<string, string> = {
  'hidden-costs': 'distrusts pricing that is not shown up front',
  'price-too-high': 'will not pay more than the monthly budget',
  'slow-onboarding': 'drops tools that take long to set up',
  jargon: 'gets lost in technical jargon',
  'complex-forms': 'gives up on forms with unclear errors',
  'long-forms': 'hates long forms on a phone',
  'no-phone-number': 'refuses to hand over a phone number to sign up',
  'needs-refund-guarantee': 'needs a visible refund or money-back guarantee before paying',
  'no-card-for-trial': 'will not enter a card just to start a free trial',
};

export interface ArchetypeFlavor {
  segment: string;
  motivations: string[];
  situations: string[];
  pains: string[];
  triggers: string[];
  prior_experience: string[];
}

export interface PopulationTemplate {
  id: string;
  description: string;
  product_noun: string;
  currency: string;
  default_task: string;
  flavors: Record<string, ArchetypeFlavor>;
}

const T = (t: PopulationTemplate) => t;

export const TEMPLATES: Record<string, PopulationTemplate> = {
  saas: T({
    id: 'saas',
    description: 'B2B SaaS buyers evaluating a subscription tool',
    product_noun: 'invoicing tool',
    currency: 'EUR',
    default_task:
      'You need a tool that solves the problem described in your situation. Find out whether this product fits your budget and, if it does, start using it (a free trial or paid plan both count).',
    flavors: {
      'price-sensitive': {
        segment: 'Budget freelancer',
        motivations: ['stop paying for bloated software', 'keep costs predictable', 'save a few hours a month'],
        situations: ['works alone as a freelance designer', 'runs a one-person bookkeeping practice', 'sells illustrations part-time'],
        pains: ['builds invoices by hand in a spreadsheet', 'forgets to chase late payments', 'loses track of what was billed'],
        triggers: ['a client paid two months late', 'a friend mentioned this tool', 'the old tool raised its price'],
        prior_experience: ['cancelled a tool after a surprise price increase', 'uses free spreadsheets'],
      },
      'goal-focused': {
        segment: 'Agency operator',
        motivations: ['get invoicing off the to-do list today', 'bill clients faster', 'standardise billing across the team'],
        situations: ['manages a four-person design agency', 'runs operations at a small consultancy', 'leads a boutique dev studio'],
        pains: ['spends five hours a week producing invoices', 'chases payments manually', 'has no view of outstanding revenue'],
        triggers: ['the quarter closes on Friday', 'the accountant asked for cleaner records', 'a big client needs proper invoices'],
        prior_experience: ['abandoned two SaaS tools because onboarding was too complicated', 'has bought SaaS with a company card before'],
      },
      novice: {
        segment: 'Non-technical owner',
        motivations: ['stop making mistakes on invoices', 'look more professional', 'get help with paperwork'],
        situations: ['runs a small family bakery', 'owns a local repair shop', 'is a retired teacher who tutors'],
        pains: ['writes invoices in a word processor', 'is unsure what fields an invoice needs', 'is afraid of doing taxes wrong'],
        triggers: ['a nephew recommended trying software', 'a customer asked for a proper invoice', 'saw an advert'],
        prior_experience: ['finds most software confusing', 'has never signed up for a SaaS product'],
      },
      'mobile-rushed': {
        segment: 'On-the-go tradesperson',
        motivations: ['send invoices from the job site', 'get paid before leaving the customer', 'avoid evening paperwork'],
        situations: ['is a self-employed electrician', 'is a mobile hairdresser', 'runs a one-van moving business'],
        pains: ['writes invoices at night after work', 'forgets small jobs', 'has only a phone during the day'],
        triggers: ['has five minutes between two jobs', 'a customer asked for an invoice by email', 'saw a social media ad'],
        prior_experience: ['does almost everything on the phone', 'gave up on apps that need a laptop'],
      },
      skeptic: {
        segment: 'Cautious finance lead',
        motivations: ['replace a legacy tool safely', 'avoid lock-in', 'protect client data'],
        situations: ['is the finance lead at a 12-person nonprofit', 'handles money at a small architecture firm', 'is a controller at a family business'],
        pains: ['current tool is being discontinued', 'auditors flagged messy records', 'reconciliation takes days'],
        triggers: ['comparing three alternatives this week', 'the board asked for a recommendation', 'a vendor contract ends next month'],
        prior_experience: ['was once billed after cancelling a trial', 'reads refund terms before buying anything'],
      },
    },
  }),
  ecommerce: T({
    id: 'ecommerce',
    description: 'Online shoppers buying a physical product',
    product_noun: 'product',
    currency: 'EUR',
    default_task: 'You want to buy a product that fits your need and budget. Find a suitable one and complete the purchase if you are comfortable doing so.',
    flavors: {
      'price-sensitive': { segment: 'Deal hunter', motivations: ['get the best price'], situations: ['a student furnishing a flat'], pains: ['limited monthly budget'], triggers: ['saw a discount code'], prior_experience: ['compares prices on three sites'] },
      'goal-focused': { segment: 'Replacement buyer', motivations: ['replace something broken today'], situations: ['a parent whose kettle just broke'], pains: ['needs it by tomorrow'], triggers: ['old one stopped working'], prior_experience: ['buys online weekly'] },
      novice: { segment: 'First-time online shopper', motivations: ['buy safely online'], situations: ['a retiree trying online shopping'], pains: ['worries about scams'], triggers: ['a grandchild suggested it'], prior_experience: ['usually shops in person'] },
      'mobile-rushed': { segment: 'Commuter shopper', motivations: ['order during the commute'], situations: ['a nurse on a train between shifts'], pains: ['only has a phone'], triggers: ['remembered it on the train'], prior_experience: ['uses mobile wallets'] },
      skeptic: { segment: 'Returns-conscious buyer', motivations: ['buy with a safe return path'], situations: ['a buyer who was burned by a fake shop'], pains: ['has been scammed before'], triggers: ['reading reviews'], prior_experience: ['checks return policies first'] },
    },
  }),
  'developer-tool': T({
    id: 'developer-tool',
    description: 'Developers evaluating a technical tool or API',
    product_noun: 'developer tool',
    currency: 'USD',
    default_task: 'You need a tool for the technical problem in your situation. Work out if this product fits and, if it does, create an account and get to a working first step.',
    flavors: {
      'price-sensitive': { segment: 'Indie hacker', motivations: ['ship a side project cheaply'], situations: ['a solo developer building a side project'], pains: ['cannot justify another subscription'], triggers: ['hit the limit of a free tier'], prior_experience: ['prefers open-source'] },
      'goal-focused': { segment: 'Staff engineer', motivations: ['unblock the team this sprint'], situations: ['a staff engineer at a scale-up'], pains: ['team loses hours to flaky tooling'], triggers: ['an incident last week'], prior_experience: ['evaluates tools for the org'] },
      novice: { segment: 'Bootcamp graduate', motivations: ['learn the tool for a first job'], situations: ['a junior developer in their first month'], pains: ['docs assume too much'], triggers: ['a senior told them to try it'], prior_experience: ['has used only tutorials'] },
      'mobile-rushed': { segment: 'On-call engineer', motivations: ['check a fix from the phone'], situations: ['an engineer on call at a weekend event'], pains: ['only has a phone'], triggers: ['an alert fired'], prior_experience: ['uses GitHub mobile'] },
      skeptic: { segment: 'Security reviewer', motivations: ['approve only compliant vendors'], situations: ['a security engineer at a fintech'], pains: ['must justify every vendor'], triggers: ['a procurement review'], prior_experience: ['reads DPAs and SOC 2 reports'] },
    },
  }),
  'local-service': T({
    id: 'local-service',
    description: 'Customers booking a local service online',
    product_noun: 'service',
    currency: 'EUR',
    default_task: 'You need the service described in your situation. Find out what it costs and book it if it suits you.',
    flavors: {
      'price-sensitive': { segment: 'Budget household', motivations: ['keep the bill low'], situations: ['a family on a tight budget'], pains: ['cannot afford surprises'], triggers: ['got a high quote elsewhere'], prior_experience: ['always asks for a quote'] },
      'goal-focused': { segment: 'Urgent fixer', motivations: ['get it fixed this week'], situations: ['a homeowner with a leaking pipe'], pains: ['water damage is getting worse'], triggers: ['the leak got worse overnight'], prior_experience: ['books services online'] },
      novice: { segment: 'Phone-first customer', motivations: ['book without confusion'], situations: ['an elderly resident'], pains: ['finds booking widgets hard'], triggers: ['a neighbour recommended the business'], prior_experience: ['usually calls to book'] },
      'mobile-rushed': { segment: 'Busy parent', motivations: ['book during the school run'], situations: ['a parent with two children'], pains: ['no time at a desk'], triggers: ['remembered while waiting at school'], prior_experience: ['books everything on the phone'] },
      skeptic: { segment: 'Reviews-first customer', motivations: ['hire someone trustworthy'], situations: ['a homeowner who had a bad contractor'], pains: ['was overcharged before'], triggers: ['comparing three providers'], prior_experience: ['reads cancellation terms'] },
    },
  }),
  'subscription-app': T({
    id: 'subscription-app',
    description: 'Consumers considering a subscription app',
    product_noun: 'app',
    currency: 'EUR',
    default_task: 'You are looking for an app that helps with your situation. Decide whether it is worth it and start a subscription or trial if it is.',
    flavors: {
      'price-sensitive': { segment: 'Subscription-fatigued', motivations: ['avoid another monthly fee'], situations: ['a student with four subscriptions'], pains: ['subscriptions add up'], triggers: ['a friend shared a referral'], prior_experience: ['cancels trials before they bill'] },
      'goal-focused': { segment: 'Habit builder', motivations: ['start a new habit today'], situations: ['a professional starting a fitness plan'], pains: ['keeps skipping workouts'], triggers: ['New Year resolution'], prior_experience: ['pays for apps that work'] },
      novice: { segment: 'App newcomer', motivations: ['try something new safely'], situations: ['a retiree with a new smartphone'], pains: ['unsure how subscriptions work'], triggers: ['a TV advert'], prior_experience: ['has few apps installed'] },
      'mobile-rushed': { segment: 'Scroll-and-go', motivations: ['decide in a minute'], situations: ['a commuter scrolling social media'], pains: ['short attention span'], triggers: ['clicked an ad'], prior_experience: ['installs and deletes apps quickly'] },
      skeptic: { segment: 'Privacy-minded', motivations: ['keep personal data private'], situations: ['a journalist careful about data'], pains: ['apps sell data'], triggers: ['read a privacy article'], prior_experience: ['reads privacy policies'] },
    },
  }),
};

/** Fictional first names. Combined with a last initial; never a real, identifiable person. */
export const FIRST_NAMES = [
  'Marta', 'Jonas', 'Aisha', 'Tomás', 'Mei', 'Lars', 'Priya', 'Karim', 'Sofia', 'Emeka',
  'Hana', 'Diego', 'Ingrid', 'Yusuf', 'Chloé', 'Ravi', 'Noor', 'Mateo', 'Freya', 'Kenji',
  'Leila', 'Bram', 'Amara', 'Oskar', 'Lucía', 'Tariq', 'Elin', 'Samir', 'Zoe', 'Piotr',
];
export const LAST_INITIALS = 'ABCDEFGHJKLMNPRSTVW'.split('');
