import { afterEach, describe, expect, it } from 'vitest';
import { BudgetExceededError, ProviderError } from '../../src/core/errors.js';
import { mapPool } from '../../src/core/pool.js';
import { createProvider, CostMeter, MockProvider } from '../../src/providers/index.js';
import { redact } from '../../src/providers/http.js';
import { meteredComplete } from '../../src/providers/metered.js';
import { costUsd } from '../../src/providers/pricing.js';
import type { ChatProvider } from '../../src/providers/types.js';

const req = {
  system: 'sys',
  messages: [{ role: 'user' as const, content: 'x'.repeat(3500) }],
  maxTokens: 200,
};

describe('budget enforcement', () => {
  it('refuses a call BEFORE sending it when worst case would breach the budget; spend never exceeds cap', async () => {
    const p = new MockProvider(() => 'ok', 'mock', { input: 10, output: 50 });
    const meter = new CostMeter({ budgetUsd: 0.05 });
    let calls = 0;
    await expect(
      (async () => {
        for (;;) {
          await meteredComplete(p, meter, req);
          calls++;
        }
      })(),
    ).rejects.toBeInstanceOf(BudgetExceededError);
    expect(calls).toBeGreaterThan(0);
    expect(meter.spentUsd).toBeLessThanOrEqual(0.05);
    expect(p.calls).toBe(calls); // the refused call was never sent
  });

  it('enforces a max-calls cap', async () => {
    const meter = new CostMeter({ maxCalls: 2 });
    const p = new MockProvider(() => 'ok');
    await meteredComplete(p, meter, req);
    await meteredComplete(p, meter, req);
    await expect(meteredComplete(p, meter, req)).rejects.toThrow(/call limit/);
  });

  it('meters tokens, calls and cost', async () => {
    const meter = new CostMeter();
    const p = new MockProvider(() => 'hello world', 'm', { input: 1, output: 5 });
    await meteredComplete(p, meter, req);
    const [u] = meter.summary();
    expect(u!.calls).toBe(1);
    expect(u!.input_tokens).toBeGreaterThan(900);
    expect(u!.estimated_cost_usd).toBeCloseTo(
      costUsd({ input: 1, output: 5 }, u!.input_tokens, u!.output_tokens),
    );
  });
});

describe('provider failure', () => {
  it('retries retryable errors then succeeds', async () => {
    const p = new MockProvider((_, i) => (i < 2 ? new ProviderError('HTTP 529', true, 529) : 'ok'));
    const res = await meteredComplete(p, new CostMeter(), req, { retries: 2 });
    expect(res.text).toBe('ok');
    expect(p.calls).toBe(3);
  });

  it('does not retry non-retryable errors', async () => {
    const p = new MockProvider(() => new ProviderError('HTTP 401', false, 401));
    await expect(meteredComplete(p, new CostMeter(), req)).rejects.toThrow(/401/);
    expect(p.calls).toBe(1);
  });

  it('offline mode refuses paid providers without sending anything', async () => {
    expect(process.env.BUYER_ARENA_OFFLINE).toBe('1');
    let sent = false;
    const paid: ChatProvider = {
      name: 'paid',
      model: 'x',
      paid: true,
      pricing: { input: 1, output: 1 },
      complete: async () => (
        (sent = true),
        {
          text: '',
          usage: { input_tokens: 0, output_tokens: 0, cached_tokens: 0 },
          latency_ms: 0,
          model: 'x',
        }
      ),
    };
    await expect(meteredComplete(paid, new CostMeter(), req)).rejects.toThrow(/offline/);
    expect(sent).toBe(false);
  });
});

describe('provider factory & secrets', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('requires keys from the environment and never accepts unknown providers', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => createProvider('anthropic:claude-haiku-4-5')).toThrow(/ANTHROPIC_API_KEY/);
    expect(() => createProvider('nope:x')).toThrow(/unknown provider/);
    expect(createProvider('ollama:llama3.1').paid).toBe(false);
  });

  it('redacts credentials from error text', () => {
    const s = redact('x-api-key: sk-ant-abcdefghijklmnop authorization: Bearer abc.def api_key=zzz');
    expect(s).not.toMatch(/abcdefghijklmnop|abc\.def|zzz/);
  });
});

describe('bounded concurrency', () => {
  it('never runs more than the limit at once', async () => {
    let active = 0;
    let peak = 0;
    await mapPool(
      Array.from({ length: 20 }, (_, i) => i),
      3,
      async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
      },
    );
    expect(peak).toBe(3);
  });

  it('stops scheduling after abort', async () => {
    const ac = new AbortController();
    let started = 0;
    await mapPool(
      Array.from({ length: 50 }, (_, i) => i),
      2,
      async (i) => {
        started++;
        if (i === 3) ac.abort();
        await new Promise((r) => setTimeout(r, 2));
      },
      ac.signal,
    );
    expect(started).toBeLessThan(10);
  });
});
