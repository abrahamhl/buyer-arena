import { mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cacheable, ResponseCache } from '../../src/models/cache.js';
import {
  describeSpec,
  isDynamicOpenRouterModel,
  loadCatalog,
  normalizeModelsDev,
  STALE_DAYS,
} from '../../src/models/catalog.js';
import { route, RoutingError, runCascade } from '../../src/models/router.js';
import { NetworkLedger, withNetworkScope } from '../../src/policy/network.js';
import { CostMeter, createProvider, meteredComplete, MockProvider } from '../../src/providers/index.js';
import { OpenRouterProvider } from '../../src/providers/openrouter.js';
import type { ChatRequest } from '../../src/providers/types.js';

const MODELS_DEV = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    env: ['ANTHROPIC_API_KEY'],
    npm: '@ai-sdk/anthropic',
    doc: 'x',
    models: {
      'claude-haiku-4-5': {
        id: 'claude-haiku-4-5',
        name: 'Haiku',
        attachment: true,
        tool_call: true,
        structured_output: true,
        modalities: { input: ['text', 'image'], output: ['text'] },
        cost: { input: 1, output: 5, cache_read: 0.1 },
        limit: { context: 200000, output: 64000 },
      },
    },
  },
  groq: {
    id: 'groq',
    models: {
      'llama-3.3-70b': {
        id: 'llama-3.3-70b',
        tool_call: true,
        cost: { input: 0.59, output: 0.79 },
        limit: { context: 131072, output: 32768 },
      },
    },
  },
};

function snapshot(ageDays: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'ba-cat-'));
  const file = join(dir, 'models-dev.json');
  const fetched = new Date(Date.now() - ageDays * 86_400_000).toISOString();
  writeFileSync(
    file,
    JSON.stringify({ fetched_at: fetched, url: 'https://models.dev/api.json', doc: MODELS_DEV }),
  );
  return file;
}

describe('model catalog', () => {
  it('works with no snapshot (built-in only)', () => {
    const c = loadCatalog({ snapshotFile: '/nonexistent/models-dev.json' });
    expect(c.version).toBe('builtin');
    expect(c.models.length).toBeGreaterThan(0);
  });

  it('normalises Models.dev, maps known providers, keeps others namespaced', () => {
    const list = normalizeModelsDev(MODELS_DEV);
    expect(list.find((m) => m.spec === 'anthropic:claude-haiku-4-5')).toMatchObject({
      pricing: { input: 1, output: 5, cached_input: 0.1 },
      context: 200000,
      vision: true,
      structured_output: true,
      pricing_source: 'models.dev',
    });
    expect(list.find((m) => m.provider === 'models.dev/groq')).toBeTruthy();
    expect(normalizeModelsDev('garbage')).toEqual([]);
  });

  it('caches a snapshot with a timestamp and flags stale prices', () => {
    const fresh = loadCatalog({ snapshotFile: snapshot(1) });
    expect(fresh.models_dev).toMatchObject({ stale: false, models: 2 });
    expect(fresh.version).toMatch(/^models\.dev@\d{4}-\d{2}-\d{2}\+builtin$/);
    expect(loadCatalog({ snapshotFile: snapshot(STALE_DAYS + 5) }).models_dev?.stale).toBe(true);
  });

  it('manual overrides win over catalog prices', () => {
    const c = loadCatalog({
      snapshotFile: snapshot(1),
      overrides: { 'anthropic:claude-haiku-4-5': { input: 0.5, output: 2 } },
    });
    expect(c.models.find((m) => m.spec === 'anthropic:claude-haiku-4-5')).toMatchObject({
      pricing: { input: 0.5, output: 2 },
      pricing_source: 'override',
    });
  });

  it('openai-compatible is local exactly when its endpoint is loopback/LAN', () => {
    process.env.OPENAI_BASE_URL = 'http://127.0.0.1:8000/v1';
    expect(describeSpec('openai-compatible:qwen')).toMatchObject({
      locality: 'local',
      pricing_source: 'free-local',
    });
    expect(
      route(
        { purpose: 'buyer', pinned: 'openai-compatible:qwen', policy: 'offline' },
        loadCatalog({ snapshotFile: '/x' }),
      ).selected,
    ).toBe('openai-compatible:qwen');
    process.env.OPENAI_BASE_URL = 'https://gateway.example.com/v1';
    expect(describeSpec('openai-compatible:qwen').locality).toBe('cloud');
    delete process.env.OPENAI_BASE_URL;
  });

  it('local specs are free and local; OpenRouter auto/free routes are dynamic', () => {
    expect(describeSpec('ollama:llama3.1')).toMatchObject({
      locality: 'local',
      pricing: { input: 0, output: 0 },
    });
    expect(describeSpec('openrouter:openrouter/auto').dynamic).toBe(true);
    expect(isDynamicOpenRouterModel('meta-llama/llama-3.3-70b-instruct:free')).toBe(true);
    expect(isDynamicOpenRouterModel('anthropic/claude-haiku-4.5')).toBe(false);
  });
});

describe('model router', () => {
  const cat = loadCatalog({
    snapshotFile: '/nonexistent',
    discovered: [describeSpec('ollama:llama3.1'), describeSpec('openrouter:openrouter/auto')],
  });

  it('offline policy only ever selects local models, else the deterministic path', () => {
    const d = route({ purpose: 'buyer', policy: 'offline' }, cat);
    expect(d.selected).toBe('ollama:llama3.1');
    const none = route(
      { purpose: 'buyer', policy: 'offline' },
      loadCatalog({ snapshotFile: '/nonexistent' }),
    );
    expect(none).toMatchObject({ selected: 'heuristic', expected_cost_usd: 0 });
  });

  it('economy picks the cheapest, quality the highest tier within budget', () => {
    const e = route(
      { purpose: 'auditor', policy: 'economy', constraints: { denied_providers: ['ollama'] } },
      cat,
    );
    expect(e.selected).toBe('openai:gpt-4o-mini');
    const q = route(
      {
        purpose: 'critic',
        policy: 'quality',
        constraints: { max_cost_usd: 0.02, denied_providers: ['ollama'] },
      },
      cat,
    );
    expect(q.selected).toBe('anthropic:claude-sonnet-5');
    expect(q.rejected.find((r) => r.spec === 'anthropic:claude-opus-5-5')?.reasons.join()).toMatch(/max/);
  });

  it('never selects a dynamic route automatically', () => {
    const d = route(
      { purpose: 'buyer', policy: 'economy', constraints: { allowed_providers: ['openrouter'] } },
      cat,
    );
    expect(d.selected).toBe('heuristic');
  });

  it('explicit pinning is honoured exactly, or refused — never substituted', () => {
    const p = route({ purpose: 'judge', pinned: 'anthropic:claude-opus-5-5', policy: 'economy' }, cat);
    expect(p).toMatchObject({ selected: 'anthropic:claude-opus-5-5', pinned: true, fallbacks: [] });
    expect(() =>
      route({ purpose: 'judge', pinned: 'anthropic:claude-opus-5-5', policy: 'offline' }, cat),
    ).toThrow(RoutingError);
    const dyn = route({ purpose: 'buyer', pinned: 'openrouter:openrouter/auto' }, cat);
    expect(dyn.warnings.join()).toMatch(/NON-REPRODUCIBLE/);
    expect(() =>
      route({ purpose: 'buyer', pinned: 'openrouter:openrouter/auto', reproducible: true }, cat),
    ).toThrow(/dynamic/);
  });

  it('reproducible runs get no fallbacks; decisions are deterministic', () => {
    const a = route({ purpose: 'auditor', reproducible: true }, cat);
    expect(a.fallbacks).toEqual([]);
    expect(route({ purpose: 'auditor', reproducible: true }, cat)).toEqual(a);
  });

  it('cascade escalates only when a tier fails to produce an acceptable answer', async () => {
    const calls: string[] = [];
    const r = await runCascade<number>(
      [
        { tier: 'deterministic', run: async () => (calls.push('d'), undefined) },
        { tier: 'cheap', run: async () => (calls.push('c'), 0.3) },
        { tier: 'strong', run: async () => (calls.push('s'), 0.9) },
      ],
      (v) => v > 0.5,
    );
    expect(r).toMatchObject({ value: 0.9, tier: 'strong', escalations: 2 });
    const short = await runCascade<number>(
      [
        { tier: 'deterministic', run: async () => 1 },
        { tier: 'strong', run: async () => (calls.push('never'), 1) },
      ],
      () => true,
    );
    expect(short.escalations).toBe(0);
    expect(calls).not.toContain('never');
  });
});

describe('exact response cache', () => {
  const req: ChatRequest = { system: 'sys', messages: [{ role: 'user', content: 'hi' }], maxTokens: 50 };

  it('hits only for the identical request to the identical model; hits cost nothing', async () => {
    const cache = new ResponseCache(mkdtempSync(join(tmpdir(), 'ba-cache-')));
    const a = new MockProvider(() => 'answer-a', 'model-a');
    const meter = new CostMeter();
    const first = await meteredComplete(a, meter, req, { cache });
    const second = await meteredComplete(a, meter, req, { cache });
    expect(second.text).toBe(first.text);
    expect(a.calls).toBe(1);
    expect(second.usage.input_tokens).toBe(0);
    expect(meter.economy.cache_hits).toBe(1);
    // Different model, prompt or params → no reuse.
    const b = new MockProvider(() => 'answer-b', 'model-b');
    expect((await meteredComplete(b, meter, req, { cache })).text).toBe('answer-b');
    expect((await meteredComplete(a, meter, { ...req, system: 'other' }, { cache })).text).toBe('answer-a');
    expect(a.calls).toBe(2);
    expect((await meteredComplete(a, meter, { ...req, maxTokens: 51 }, { cache })).text).toBe('answer-a');
    expect(a.calls).toBe(3);
  });

  it('never caches sampled or floating-alias requests', () => {
    expect(cacheable(new MockProvider(() => 'x', 'm'), { ...req, temperature: 0.7 }).ok).toBe(false);
    expect(cacheable(new MockProvider(() => 'x', 'claude-latest'), req).ok).toBe(false);
    expect(cacheable(new MockProvider(() => 'x', 'openrouter/auto'), req).ok).toBe(false);
  });

  it('does not store a response whose model differs from the one requested', async () => {
    const cache = new ResponseCache(mkdtempSync(join(tmpdir(), 'ba-cache-')));
    const p = new MockProvider(() => 'x', 'model-a');
    cache.put(p, req, {
      text: 'x',
      model: 'something-else',
      latency_ms: 1,
      usage: { input_tokens: 1, output_tokens: 1, cached_tokens: 0 },
    });
    expect(cache.get(p, req)).toBeUndefined();
  });
});

describe('budget exhaustion', () => {
  it('refuses the call that would exceed the budget before sending it', async () => {
    const p = new MockProvider(() => 'x'.repeat(10), 'm', { input: 1000, output: 1000 });
    const meter = new CostMeter({ budgetUsd: 0.001 });
    await expect(
      meteredComplete(p, meter, {
        system: 's',
        messages: [{ role: 'user', content: 'hello' }],
        maxTokens: 100,
      }),
    ).rejects.toThrow(/budget/);
    expect(p.calls).toBe(0);
  });
});

describe('OpenRouter provider', () => {
  it('needs a key, labels dynamic routes, records the model that actually answered', async () => {
    expect(() => createProvider('openrouter:anthropic/claude-haiku-4.5')).toThrow(/OPENROUTER_API_KEY/);
    const server = createServer((req, res) => {
      let body = '';
      req.on('data', (d) => (body += d));
      req.on('end', () => {
        const json = JSON.parse(body) as { model: string };
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            model: json.model === 'openrouter/auto' ? 'mistralai/mistral-small' : json.model,
            choices: [{ message: { content: 'ok' } }],
            usage: { prompt_tokens: 3, completion_tokens: 1 },
          }),
        );
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as { port: number }).port;
    try {
      const p = new OpenRouterProvider('openrouter/auto', 'test-key', {
        baseUrl: `http://127.0.0.1:${port}/api/v1`,
      });
      expect(p.dynamic).toBe(true);
      const ledger = new NetworkLedger({ mode: 'offline', source: 'flag', strict: true, allowProviders: [] });
      const res = await withNetworkScope(ledger, () =>
        p.complete({ system: 's', messages: [{ role: 'user', content: 'x' }], maxTokens: 5 }),
      );
      expect(res.model).toBe('mistralai/mistral-small');
      expect([...p.servedModels]).toEqual(['mistralai/mistral-small']);
      expect(ledger.snapshot().providers[0]).toMatchObject({
        provider: 'openrouter',
        locality: 'local',
        data: ['prompt'],
      });
      expect(new OpenRouterProvider('anthropic/claude-haiku-4.5', 'k').dynamic).toBe(false);
    } finally {
      server.close();
    }
  });
});
