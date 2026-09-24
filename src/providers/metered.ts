import { BudgetExceededError, ProviderError } from '../core/errors.js';
import type { Usage } from '../core/types.js';
import { costUsd } from './pricing.js';
import type { ChatProvider, ChatRequest, ChatResponse } from './types.js';

export interface MeterLimits {
  /** Hard USD cap across the whole session. */
  budgetUsd?: number;
  /** Hard cap on number of provider calls. */
  maxCalls?: number;
}

/**
 * Tracks spend and refuses a call BEFORE sending it if its worst-case cost could breach
 * the budget. Worst-case cost is RESERVED while a call is in flight, so parallel buyers
 * cannot race past the cap, and prior spend (e.g. from a resumed session) is carried in.
 * The worst case uses a pessimistic token estimate (2 chars/token) plus max output tokens.
 */
export class CostMeter {
  private totals = new Map<string, Usage>();
  private reserved = 0;
  private inFlight = 0;
  constructor(
    readonly limits: MeterLimits = {},
    /** Spend already incurred before this meter existed (resume). */
    private readonly priorSpentUsd = 0,
  ) {}

  get spentUsd(): number {
    let s = this.priorSpentUsd;
    for (const u of this.totals.values()) s += u.estimated_cost_usd;
    return s;
  }
  get calls(): number {
    let n = 0;
    for (const u of this.totals.values()) n += u.calls;
    return n;
  }

  /** Check limits and reserve the call's worst-case cost. Returns the reservation to release. */
  reserve(provider: ChatProvider, req: ChatRequest): number {
    if (this.limits.maxCalls !== undefined && this.calls + this.inFlight >= this.limits.maxCalls) {
      throw new BudgetExceededError(`call limit reached (${this.limits.maxCalls})`);
    }
    const inputText = req.system + req.messages.map((m) => m.content).join('\n');
    // Pessimistic: 2 chars/token for input plus the full output allowance.
    const worst = costUsd(provider.pricing, Math.ceil(inputText.length / 2), req.maxTokens);
    const budget = this.limits.budgetUsd;
    if (budget !== undefined && this.spentUsd + this.reserved + worst > budget) {
      throw new BudgetExceededError(
        `budget $${budget.toFixed(4)} would be exceeded (spent $${this.spentUsd.toFixed(4)}, in flight $${this.reserved.toFixed(4)}, next call up to $${worst.toFixed(4)})`,
      );
    }
    this.reserved += worst;
    this.inFlight++;
    return worst;
  }

  release(reservation: number): void {
    this.reserved = Math.max(0, this.reserved - reservation);
    this.inFlight = Math.max(0, this.inFlight - 1);
  }

  /** Check limits without reserving. */
  guard(provider: ChatProvider, req: ChatRequest): void {
    this.release(this.reserve(provider, req));
  }

  record(provider: ChatProvider, res: ChatResponse): Usage {
    const key = `${provider.name}:${res.model}`;
    const prev = this.totals.get(key) ?? {
      provider: provider.name,
      model: res.model,
      calls: 0,
      input_tokens: 0,
      output_tokens: 0,
      cached_tokens: 0,
      latency_ms: 0,
      estimated_cost_usd: 0,
    };
    const cost = costUsd(
      provider.pricing,
      res.usage.input_tokens,
      res.usage.output_tokens,
      res.usage.cached_tokens,
    );
    const next: Usage = {
      ...prev,
      calls: prev.calls + 1,
      input_tokens: prev.input_tokens + res.usage.input_tokens,
      output_tokens: prev.output_tokens + res.usage.output_tokens,
      cached_tokens: prev.cached_tokens + res.usage.cached_tokens,
      latency_ms: prev.latency_ms + res.latency_ms,
      estimated_cost_usd: prev.estimated_cost_usd + cost,
    };
    this.totals.set(key, next);
    return next;
  }

  summary(): Usage[] {
    return [...this.totals.values()];
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wraps a provider with: offline guard, budget guard, bounded retries, usage metering.
 */
export async function meteredComplete(
  provider: ChatProvider,
  meter: CostMeter,
  req: ChatRequest,
  opts: { retries?: number; signal?: AbortSignal; onUsage?: (res: ChatResponse) => void } = {},
): Promise<ChatResponse> {
  if (provider.paid && process.env.BUYER_ARENA_OFFLINE === '1') {
    throw new ProviderError(`offline mode: refusing paid provider ${provider.name}`, false);
  }
  const retries = opts.retries ?? 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (opts.signal?.aborted) throw new ProviderError('aborted', false);
    const reservation = meter.reserve(provider, req);
    try {
      const res = await provider.complete(req, opts.signal);
      meter.record(provider, res);
      opts.onUsage?.(res);
      return res;
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof ProviderError ? err.retryable : false;
      if (!retryable || attempt === retries) break;
      await sleep(250 * 2 ** attempt);
    } finally {
      meter.release(reservation);
    }
  }
  throw lastErr instanceof Error ? lastErr : new ProviderError(String(lastErr), false);
}
