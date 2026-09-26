// Proposed pricing shown on the website. Source of truth: docs/PRICING.md — site/qa.mjs fails the
// build if a price here is missing from that document. Nothing is on sale: no entity, no payments.
export const PLANS = [
  { key: 'community', price: 0, unit: 'forever', status: 'launch', licence: 'apache' },
  { key: 'starter', price: 29, unit: 'month', status: 'planned', licence: 'cloud', runs: 1000, over: 4 },
  { key: 'team', price: 249, unit: 'month', status: 'planned', licence: 'cloud', runs: 10000, over: 3 },
  { key: 'enterprise', price: 2500, from: true, unit: 'month', status: 'planned', licence: 'commercial' },
];

export const SERVICES = [
  { key: 'audit', price: 1900 },
  { key: 'agents', price: 4900, from: true },
  { key: 'calibration', price: 2900, from: true },
  { key: 'support', price: 500, from: true, unit: 'month' },
];

// Default inputs of the ROI calculator = the worked example in docs/PRICING.md §6.
export const ROI_DEFAULTS = {
  rounds: 2,
  roundCost: 1000,
  visitors: 20000,
  uplift: 0.1, // percentage points
  value: 40,
  confidence: 0.5,
  hours: 20,
  rate: 60,
  plan: 249,
};

/** Same formula as docs/PRICING.md §6 and site/app.js. Returns yearly euros. */
export function roi(i) {
  const a = i.rounds * i.roundCost;
  const b = i.visitors * (i.uplift / 100) * i.value * 12 * i.confidence;
  const c = i.hours * i.rate;
  const cost = i.plan * 12;
  const benefit = a + b + c;
  return { a, b, c, benefit, cost, net: benefit - cost, ratio: cost > 0 ? (benefit - cost) / cost : null };
}
