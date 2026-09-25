import { afterEach, describe, expect, it } from 'vitest';
import {
  classifyHost,
  describeLedger,
  isLocalEndpoint,
  NetworkLedger,
  NetworkPolicyError,
  resolvePolicy,
  withNetworkScope,
  type NetworkPolicy,
} from '../../src/policy/network.js';
import { postJson } from '../../src/providers/http.js';
import { createProvider, CostMeter, meteredComplete } from '../../src/providers/index.js';

const policy = (
  mode: NetworkPolicy['mode'],
  strict = true,
  allowProviders: string[] = [],
): NetworkPolicy => ({
  mode,
  source: strict ? 'flag' : 'default',
  strict,
  allowProviders,
});

describe('host classification (no DNS)', () => {
  it.each([
    ['localhost', 'loopback'],
    ['app.localhost', 'loopback'],
    ['127.0.0.1', 'loopback'],
    ['[::1]', 'loopback'],
    ['0.0.0.0', 'loopback'],
    ['10.1.2.3', 'private'],
    ['172.20.0.5', 'private'],
    ['192.168.1.10', 'private'],
    ['fd00::1', 'private'],
    ['100.100.1.1', 'private'],
    ['example.com', 'public'],
    ['localhost.evil.com', 'public'],
    ['8.8.8.8', 'public'],
    ['172.32.0.1', 'public'],
  ])('%s → %s', (host, cls) => expect(classifyHost(host)).toBe(cls));

  it('declared private hosts are private, and URLs are accepted', () => {
    process.env.BUYER_ARENA_PRIVATE_HOSTS = 'staging.internal';
    expect(classifyHost('http://staging.internal:8080/x')).toBe('private');
    delete process.env.BUYER_ARENA_PRIVATE_HOSTS;
    expect(isLocalEndpoint('http://localhost:1234/v1')).toBe(true);
    expect(isLocalEndpoint('https://localhost.attacker.io/v1')).toBe(false);
  });
});

describe('network policy', () => {
  afterEach(() => {
    delete process.env.BUYER_ARENA_NETWORK;
  });

  it('OFFLINE allows loopback targets and local models, refuses public, LAN and cloud models', () => {
    const l = new NetworkLedger(policy('offline'));
    expect(l.check('http://127.0.0.1:3000/', 'browser', { explicit: true })).toBe('loopback');
    expect(l.check('http://localhost:11434/v1/chat/completions', 'model', { explicit: true })).toBe(
      'loopback',
    );
    expect(() => l.check('https://example.com/', 'browser', { explicit: true })).toThrow(NetworkPolicyError);
    expect(() => l.check('http://192.168.1.4/', 'browser', { explicit: true })).toThrow(/OFFLINE/);
    expect(() => l.check('https://api.anthropic.com/v1/messages', 'model', { explicit: true })).toThrow(
      /OFFLINE/,
    );
    const snap = l.snapshot();
    expect(snap.denied).toHaveLength(3);
    expect(snap.stayed_local).toBe(true);
    expect(describeLedger(snap)).toMatch(/nothing left this machine/);
  });

  it('LOCAL allows the private network but no public host', () => {
    const l = new NetworkLedger(policy('local'));
    expect(l.check('http://10.0.0.2:8080/', 'browser', { explicit: true })).toBe('private');
    expect(() => l.check('https://example.com/', 'browser', { explicit: true })).toThrow(/LOCAL/);
  });

  it('HYBRID sends data only to model providers, and honours the allow list', () => {
    const l = new NetworkLedger(policy('hybrid', true, ['anthropic']));
    expect(
      l.check('https://api.anthropic.com/v1/messages', 'model', { explicit: true, provider: 'anthropic' }),
    ).toBe('public');
    expect(() =>
      l.check('https://openrouter.ai/api/v1/chat/completions', 'model', {
        explicit: true,
        provider: 'openrouter',
      }),
    ).toThrow(/not in the allowed list/);
    expect(() => l.check('https://example.com/', 'browser', { explicit: true })).toThrow(/HYBRID/);
  });

  it('the non-strict default escalates only for explicit targets, and records the escalation', () => {
    const l = new NetworkLedger(policy('local', false));
    const seen: string[] = [];
    l.onEscalate = (e) => seen.push(`${e.to}:${e.host}`);
    expect(() => l.check('https://tracker.example/', 'browser')).toThrow(/explicitly requested/);
    l.check('https://shop.example/', 'browser', { explicit: true });
    expect(l.effectiveMode).toBe('online');
    expect(seen).toEqual(['online:shop.example']);
    expect(l.snapshot().stayed_local).toBe(false);
  });

  it('resolves flag > BUYER_ARENA_OFFLINE > BUYER_ARENA_NETWORK > config > default', () => {
    // vitest.config.ts sets BUYER_ARENA_OFFLINE=1 for the whole suite.
    expect(resolvePolicy()).toMatchObject({ mode: 'offline', source: 'env', strict: true });
    expect(resolvePolicy({ flag: 'hybrid' })).toMatchObject({ mode: 'hybrid', source: 'flag' });
    const saved = process.env.BUYER_ARENA_OFFLINE;
    delete process.env.BUYER_ARENA_OFFLINE;
    try {
      process.env.BUYER_ARENA_NETWORK = 'local';
      expect(resolvePolicy({ config: { mode: 'online' } })).toMatchObject({ mode: 'local', source: 'env' });
      delete process.env.BUYER_ARENA_NETWORK;
      expect(resolvePolicy({ config: { mode: 'online' } })).toMatchObject({
        mode: 'online',
        source: 'config',
      });
      expect(resolvePolicy()).toMatchObject({ mode: 'local', source: 'default', strict: false });
      expect(() => resolvePolicy({ flag: 'airplane' })).toThrow(/unknown network mode/);
    } finally {
      process.env.BUYER_ARENA_OFFLINE = saved;
    }
  });

  it('provider HTTP calls are refused before any byte is sent, and recorded when allowed', async () => {
    const l = new NetworkLedger(policy('offline'));
    await withNetworkScope(l, async () => {
      await expect(
        postJson('https://api.openai.com/v1/chat/completions', {}, {}, undefined, 1000, {
          provider: 'openai',
          model: 'gpt-x',
        }),
      ).rejects.toThrow(NetworkPolicyError);
    });
    expect(l.snapshot().providers).toHaveLength(0);
  });

  it('OFFLINE still refuses a paid provider even when it is proxied through loopback', async () => {
    process.env.BUYER_ARENA_ANTHROPIC_BASE_URL = 'http://127.0.0.1:9';
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    try {
      const p = createProvider('anthropic:claude-haiku-4-5');
      await expect(
        meteredComplete(p, new CostMeter(), {
          system: 's',
          messages: [{ role: 'user', content: 'x' }],
          maxTokens: 5,
        }),
      ).rejects.toThrow(/offline/);
    } finally {
      delete process.env.BUYER_ARENA_ANTHROPIC_BASE_URL;
      delete process.env.ANTHROPIC_API_KEY;
    }
  });
});
