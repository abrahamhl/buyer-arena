import type { ElementInfo, Observation, TextBlock } from '../browser/observe.js';
import { extractPrices } from '../browser/observe.js';
import type { BuyerBrief } from '../core/types.js';

export type Action =
  | { kind: 'click'; idx: number; reason: string }
  | { kind: 'dismiss'; idx?: number; reason: string }
  | { kind: 'fill_form'; fields: { idx: number; value: string }[]; submitIdx: number; reason: string }
  | { kind: 'scroll'; reason: string }
  | { kind: 'back'; reason: string }
  | { kind: 'abandon'; reason: string; objection?: string };

export interface BuyerMemory {
  /** Paths visited, in order (with repeats). */
  visited: string[];
  actions: { step: number; kind: Action['kind']; target?: string; url: string }[];
  /** Max scrollY reached per path. */
  depth: Record<string, number>;
  scrolls: Record<string, number>;
  pricesSeen: number[];
  trustSeen: string[];
  distrustSeen: string[];
  formErrors: number;
  menuOpened: Record<string, boolean>;
  backs: number;
  modalsDismissed: number;
  /** Stable hash-derived jitter source for tie breaking. */
  seed: number;
}

export function newMemory(seed: number): BuyerMemory {
  return {
    visited: [],
    actions: [],
    depth: {},
    scrolls: {},
    pricesSeen: [],
    trustSeen: [],
    distrustSeen: [],
    formErrors: 0,
    menuOpened: {},
    backs: 0,
    modalsDismissed: 0,
    seed,
  };
}

export interface DecideContext {
  brief: BuyerBrief;
  obs: Observation;
  memory: BuyerMemory;
  step: number;
  maxSteps: number;
}

export interface BuyerPolicy {
  readonly name: string;
  decide(ctx: DecideContext): Promise<{ action: Action; meta?: Record<string, unknown> }>;
}

export const pathOf = (url: string): string => {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
};

/** Text blocks the buyer has actually had on screen on this page (respects scroll depth). */
export function seenBlocks(obs: Observation, memory: BuyerMemory): TextBlock[] {
  const depth = Math.max(obs.scrollY, memory.depth[pathOf(obs.url)] ?? 0) + obs.viewport.height;
  return obs.blocks.filter(
    (b) => b.y < depth && (!obs.modalOpen || b.region === 'dialog' || b.y < obs.viewport.height),
  );
}

export function seenElements(obs: Observation, memory: BuyerMemory): ElementInfo[] {
  const depth = Math.max(obs.scrollY, memory.depth[pathOf(obs.url)] ?? 0) + obs.viewport.height;
  return obs.elements.filter((e) => e.y < depth);
}

export const TRUST_RE = /money.back|refund(?!able)|guarantee|cancel anytime|no card required/i;
export const DISTRUST_RE = /non-refundable|no refunds|all sales final/i;

export function pricesIn(blocks: TextBlock[]): number[] {
  // Only count prices in content, not e.g. "€19" in a select option label we have not opened.
  return blocks.flatMap((b) => extractPrices(b.text));
}
