import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BudgetExceededError } from '../../src/core/errors.js';
import { generatePopulation } from '../../src/personas/generate.js';
import { CostMeter, MockProvider } from '../../src/providers/index.js';
import { meteredComplete } from '../../src/providers/metered.js';
import { runSession } from '../../src/simulator/session.js';
import { DEMO_TASK } from '../../src/workflow.js';
import { tmp } from '../helpers.js';

const listen = async (handler: Parameters<typeof createServer>[1]): Promise<[Server, string]> => {
  const s = createServer(handler);
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  return [s, `http://127.0.0.1:${(s.address() as AddressInfo).port}`];
};

let target: Server;
let foreign: Server;
let targetUrl = '';
let foreignUrl = '';
let foreignHits = 0;

beforeAll(async () => {
  [foreign, foreignUrl] = await listen((_req, res) => {
    foreignHits++;
    res
      .writeHead(200, { 'content-type': 'text/html' })
      .end('<h1>Somebody else’s site</h1><a href="/x">Start free trial</a>');
  });
  // A same-origin link that 302-redirects off-site: route() alone would not see the hop.
  [target, targetUrl] = await listen((req, res) => {
    if (req.url === '/go') return res.writeHead(302, { location: `${foreignUrl}/checkout` }).end();
    res
      .writeHead(200, { 'content-type': 'text/html' })
      .end('<h1>Tiny SaaS</h1><p>Plans from €5/month</p><a href="/go">Start free trial</a>');
  });
});
afterAll(async () => {
  await new Promise((r) => target.close(r));
  await new Promise((r) => foreign.close(r));
});

const pop = generatePopulation({ template: 'saas', size: 5, seed: 42 });

describe('safety and budget guarantees', () => {
  it('same-origin guard also stops redirect escapes', async () => {
    const res = await runSession({
      root: tmp(),
      sessionId: 'redir',
      population: { ...pop, personas: pop.personas.slice(1, 2) },
      task: DEMO_TASK,
      variants: [{ name: 'current', url: targetUrl }],
      screenshots: false,
      trace: 'off',
    });
    const run = res.runs[0]!;
    expect(run.events.some((e) => e.type === 'blocked_offsite')).toBe(true);
    expect(run.url_history.every((u) => u.startsWith(targetUrl))).toBe(true);
    expect(run.goal_completed).toBe(false);
    // The foreign origin may receive the redirected GET, but the buyer never acts there.
    expect(foreignHits).toBeLessThanOrEqual(3);
  });

  it('parallel calls cannot race past the budget (in-flight cost is reserved)', async () => {
    const slow = new MockProvider(() => 'ok', 'm', { input: 100, output: 100 });
    const orig = slow.complete.bind(slow);
    slow.complete = async (r) => {
      await new Promise((x) => setTimeout(x, 30));
      return orig(r);
    };
    const req = {
      system: 's',
      messages: [{ role: 'user' as const, content: 'x'.repeat(2000) }],
      maxTokens: 100,
    };
    const meter = new CostMeter({ budgetUsd: 0.25 });
    const settled = await Promise.allSettled(
      Array.from({ length: 10 }, () => meteredComplete(slow, meter, req)),
    );
    expect(settled.some((s) => s.status === 'rejected' && s.reason instanceof BudgetExceededError)).toBe(
      true,
    );
    expect(meter.spentUsd).toBeLessThanOrEqual(0.25);
  });

  it('resuming never grants a fresh budget (prior spend is carried in)', () => {
    const meter = new CostMeter({ budgetUsd: 1 }, 0.99);
    const p = new MockProvider(() => 'ok', 'm', { input: 10, output: 10 });
    expect(() =>
      meter.guard(p, { system: '', messages: [{ role: 'user', content: 'x'.repeat(4000) }], maxTokens: 500 }),
    ).toThrow(BudgetExceededError);
  });

  it('refuses to resume a session with a different target, and honours a pre-aborted signal', async () => {
    const root = tmp();
    const base = {
      root,
      sessionId: 'fp',
      population: { ...pop, personas: pop.personas.slice(0, 1) },
      task: DEMO_TASK,
      screenshots: false,
      trace: 'off' as const,
    };
    await runSession({ ...base, variants: [{ name: 'current', url: targetUrl }] });
    await expect(runSession({ ...base, variants: [{ name: 'current', url: foreignUrl }] })).rejects.toThrow(
      /different task, population, targets/,
    );

    const ac = new AbortController();
    ac.abort();
    const r = await runSession({
      ...base,
      sessionId: 'pre',
      variants: [{ name: 'current', url: targetUrl }],
      signal: ac.signal,
    });
    expect(r.executed).toBe(0);
    expect(r.manifest.status).toBe('interrupted');
  });
});
