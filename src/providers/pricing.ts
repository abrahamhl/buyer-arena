import type { ModelPricing } from './types.js';

/**
 * Indicative list prices in USD per million tokens. Used ONLY for budget enforcement and
 * cost estimates; unknown models fall back to a deliberately pessimistic price so a
 * budget cap errs on the side of stopping early. Override with --price-in / --price-out.
 */
const TABLE: [RegExp, ModelPricing][] = [
  [/haiku/i, { input: 1, output: 5, cached_input: 0.1 }],
  [/sonnet/i, { input: 3, output: 15, cached_input: 0.3 }],
  [/opus/i, { input: 15, output: 75, cached_input: 1.5 }],
  [/gpt-4o-mini|gpt-4\.1-mini|gpt-5-mini/i, { input: 0.6, output: 2.4, cached_input: 0.15 }],
  [/gpt-4o|gpt-4\.1|gpt-5/i, { input: 5, output: 20, cached_input: 1.25 }],
];

export const PESSIMISTIC_PRICING: ModelPricing = { input: 15, output: 75, cached_input: 15 };
export const FREE_PRICING: ModelPricing = { input: 0, output: 0, cached_input: 0 };

export function lookupPricing(model: string): ModelPricing {
  for (const [re, p] of TABLE) if (re.test(model)) return p;
  return PESSIMISTIC_PRICING;
}

export function costUsd(p: ModelPricing, input: number, output: number, cached = 0): number {
  const uncached = Math.max(0, input - cached);
  return (uncached * p.input + cached * (p.cached_input ?? p.input) + output * p.output) / 1_000_000;
}

/** Rough upper-bound token estimate (≈3.5 chars/token for English prose + JSON). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
