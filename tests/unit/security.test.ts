import { createServer, request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { generatePopulation } from '../../src/personas/generate.js';
import { dockerArgs, executionMode } from '../../src/sandbox/docker.js';
import { egressPolicy, startEgressProxy, type EgressProxy } from '../../src/security/egress-proxy.js';
import {
  assertPublicUrl,
  blockedAddressReason,
  resolveRedirectChain,
  scrubbedEnv,
} from '../../src/security/net-guard.js';
import { runSession } from '../../src/simulator/session.js';
import { DEMO_TASK } from '../../src/workflow.js';
import { tmp } from '../helpers.js';

const publicResolver = async () => ['93.184.216.34'];

describe('address classification (SSRF)', () => {
  it.each([
    '127.0.0.1',
    '127.255.255.254',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.100.100.200',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    '::ffff:127.0.0.1',
    '::ffff:169.254.169.254',
    '::ffff:7f00:1',
    'fd00:ec2::254',
    'fe80::1',
    'fc00::1',
    '64:ff9b::a9fe:a9fe',
    '2002:a9fe:a9fe::1',
  ])('blocks %s', (ip) => expect(blockedAddressReason(ip)).toBeTruthy());

  it.each(['93.184.216.34', '8.8.8.8', '1.1.1.1', '2606:4700::1111', '172.32.0.1', '::ffff:8.8.8.8'])(
    'allows public %s',
    (ip) => expect(blockedAddressReason(ip)).toBeUndefined(),
  );
});

describe('assertPublicUrl', () => {
  it.each([
    'http://localhost/',
    'http://app.localhost/',
    'http://127.0.0.1/',
    'http://2130706433/', // decimal 127.0.0.1
    'http://0x7f.0.0.1/', // hex
    'http://0177.0.0.1/', // octal
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://169.254.169.254/latest/meta-data/',
    'http://metadata.google.internal/computeMetadata/v1/',
    'http://printer.local/',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'ftp://example.com/',
    'gopher://example.com/',
    'http://user:pass@example.com/',
    'not a url',
  ])('refuses %s', async (u) => {
    await expect(assertPublicUrl(u, publicResolver)).rejects.toThrow();
  });

  it('accepts a public hostname', async () => {
    const t = await assertPublicUrl('https://example.com/pricing', publicResolver);
    expect(t.addresses).toEqual(['93.184.216.34']);
    expect(t.port).toBe(443);
  });

  it('refuses a hostname when ANY of its addresses is private', async () => {
    await expect(
      assertPublicUrl('https://mixed.example/', async () => ['93.184.216.34', '10.0.0.5']),
    ).rejects.toThrow(/10\.0\.0\.5/);
  });

  it('refuses a hostname that does not resolve', async () => {
    await expect(
      assertPublicUrl('https://nx.example/', async () => {
        throw new Error('ENOTFOUND');
      }),
    ).rejects.toThrow(/does not resolve/);
  });
});

describe('redirect chain', () => {
  it('refuses a public URL that redirects to cloud metadata', async () => {
    const fake = (async (u: string | URL) =>
      new Response(null, {
        status: 302,
        headers: { location: String(u).includes('example.com') ? 'http://169.254.169.254/latest/' : '/' },
      })) as typeof fetch;
    await expect(
      resolveRedirectChain('https://example.com/', { resolver: publicResolver, fetchImpl: fake }),
    ).rejects.toThrow(/169\.254\.169\.254/);
  });

  it('refuses redirect loops', async () => {
    const fake = (async () =>
      new Response(null, { status: 302, headers: { location: '/again' } })) as typeof fetch;
    await expect(
      resolveRedirectChain('https://example.com/', { resolver: publicResolver, fetchImpl: fake, maxHops: 3 }),
    ).rejects.toThrow(/too many redirects/);
  });
});

describe('egress proxy', () => {
  let target: Server;
  let internal: Server;
  let targetUrl = '';
  let internalUrl = '';
  let internalHits = 0;
  let proxy: EgressProxy | undefined;

  beforeAll(async () => {
    const listen = async (h: Parameters<typeof createServer>[1]): Promise<[Server, string]> => {
      const s = createServer(h);
      await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
      return [s, `http://127.0.0.1:${(s.address() as AddressInfo).port}`];
    };
    [internal, internalUrl] = await listen((_q, r) => {
      internalHits++;
      r.end('{"AccessKeyId":"SECRET"}');
    });
    [target, targetUrl] = await listen((q, r) => {
      if (q.url === '/steal') return r.writeHead(302, { location: `${internalUrl}/latest/meta-data/` }).end();
      r.writeHead(200, { 'content-type': 'text/html' }).end(
        '<h1>Tiny SaaS</h1><p>Plans from €5/month</p><a href="/steal">Start free trial</a><img src="/steal" alt="">',
      );
    });
  });
  afterEach(async () => {
    await proxy?.close();
    proxy = undefined;
  });
  afterAll(async () => {
    await new Promise((r) => target.close(r));
    await new Promise((r) => internal.close(r));
  });

  const viaProxy = (p: EgressProxy, url: string) =>
    new Promise<number>((resolve, reject) => {
      const pu = new URL(p.url);
      const req = request({ host: pu.hostname, port: pu.port, path: url, method: 'GET' }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on('error', reject);
      req.end();
    });
  const connectVia = (p: EgressProxy, hostPort: string) =>
    new Promise<number>((resolve, reject) => {
      const pu = new URL(p.url);
      const req = request({ host: pu.hostname, port: pu.port, method: 'CONNECT', path: hostPort });
      req.on('connect', (res, socket) => {
        socket.destroy();
        resolve(res.statusCode ?? 0);
      });
      req.on('response', (res) => resolve(res.statusCode ?? 0));
      req.on('error', reject);
      req.end();
    });

  it('forwards the explicit target and blocks everything private', async () => {
    proxy = await startEgressProxy(egressPolicy({ explicit: [targetUrl] }));
    expect(await viaProxy(proxy, `${targetUrl}/`)).toBe(200);
    const before = internalHits;
    expect(await viaProxy(proxy, `${internalUrl}/latest/meta-data/`)).toBe(403);
    expect(await viaProxy(proxy, 'http://169.254.169.254/latest/meta-data/')).toBe(403);
    expect(await connectVia(proxy, new URL(internalUrl).host)).toBe(403);
    expect(internalHits).toBe(before);
    expect(proxy.blocked.length).toBeGreaterThanOrEqual(3);
  });

  it('pins the first resolution (DNS rebinding cannot swap in a private address)', async () => {
    let calls = 0;
    const rebinding = async () => (++calls === 1 ? ['93.184.216.34'] : ['127.0.0.1']);
    const decide = egressPolicy({ resolver: rebinding });
    const a = await decide('rebind.example', 443);
    const b = await decide('rebind.example', 443);
    expect(a).toEqual({ ok: true, address: '93.184.216.34' });
    expect(b).toEqual(a);
    expect(calls).toBe(1);
  });

  it('a real browser journey cannot follow a redirect into the private network', async () => {
    const before = internalHits;
    const res = await runSession({
      root: tmp(),
      population: generatePopulation({ template: 'saas', size: 1, seed: 1 }),
      task: { ...DEMO_TASK, success: { text_pattern: 'never-matches-xyz' } },
      variants: [{ name: 'current', url: targetUrl }],
      maxSteps: 4,
      timeoutMs: 30_000,
      screenshots: false,
      trace: 'off',
    });
    expect(internalHits).toBe(before);
    expect(res.manifest.egress?.guard).toBe(true);
    expect(res.manifest.egress?.blocked.some((b) => b.port === Number(new URL(internalUrl).port))).toBe(true);
  });
});

describe('hosted mode and MODE C', () => {
  afterEach(() => {
    delete process.env.BUYER_ARENA_HOSTED;
  });

  it('hosted mode refuses a loopback target before any browser starts', async () => {
    process.env.BUYER_ARENA_HOSTED = '1';
    await expect(
      runSession({
        root: tmp(),
        population: generatePopulation({ template: 'saas', size: 1, seed: 1 }),
        task: DEMO_TASK,
        variants: [{ name: 'current', url: 'http://127.0.0.1:9/' }],
      }),
    ).rejects.toThrow(/loopback/);
  });

  it('hosted mode refuses external engines (they bypass the egress guard)', async () => {
    process.env.BUYER_ARENA_HOSTED = '1';
    await expect(
      runSession({
        root: tmp(),
        population: generatePopulation({ template: 'saas', size: 1, seed: 1 }),
        task: DEMO_TASK,
        variants: [{ name: 'current', url: 'https://example.com/' }],
        engineCommand: 'node x.mjs',
      }),
    ).rejects.toThrow(/external engines/);
  });

  it('never runs repository code on the host in hosted mode or for a remote repo', () => {
    process.env.BUYER_ARENA_HOSTED = '1';
    expect(() => executionMode({ remoteRepo: false })).toThrow(/hosted mode/);
    delete process.env.BUYER_ARENA_HOSTED;
    expect(() => executionMode({ remoteRepo: true })).toThrow(/untrusted code/);
    expect(executionMode({ remoteRepo: false })).toBe('host');
    expect(executionMode({ requested: 'docker', remoteRepo: true })).toBe('docker');
  });

  it('the sandbox command carries every isolation flag', () => {
    const a = dockerArgs('/tmp/clone', { cmd: 'npm test', network: false }, 'ba-x');
    const s = a.join(' ');
    for (const flag of [
      '--rm',
      '--user 1000:1000',
      '--cap-drop ALL',
      '--security-opt no-new-privileges',
      '--read-only',
      '--network none',
      '--pids-limit',
      '--memory',
      '--cpus',
    ])
      expect(s).toContain(flag);
    expect(s).not.toMatch(/docker\.sock|--privileged|-v \/:|--env-file/);
    expect(dockerArgs('/w', { cmd: 'npm ci', network: true }, 'n').join(' ')).toContain('--network bridge');
  });

  it('untrusted child processes never receive provider keys or tokens', () => {
    const saved = { ...process.env };
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-should-not-leak';
    process.env.GITHUB_TOKEN = 'ghp_should_not_leak';
    process.env.AWS_SECRET_ACCESS_KEY = 'x';
    const env = scrubbedEnv();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(env.CI).toBe('1');
    for (const k of ['ANTHROPIC_API_KEY', 'GITHUB_TOKEN', 'AWS_SECRET_ACCESS_KEY'])
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
  });
});
