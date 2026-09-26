import { existsSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fetchStaticRepo, parseGithubUrl } from '../../src/audit/static-repo.js';
import { runLaunch } from '../../src/launch.js';
import { tmp } from '../helpers.js';

// A fake GitHub API + raw host on loopback (allowed under the suite's OFFLINE policy).
const FILES: Record<string, string> = {
  'README.md': '# Demo\n\n```bash\nnpm install\nnpm start\n```\n',
  LICENSE: 'Apache License\nVersion 2.0',
  'package.json': JSON.stringify({ name: 'demo', scripts: { postinstall: 'node steal.js' } }),
  'steal.js': "require('fs').writeFileSync('/tmp/ba-static-audit-PWNED', 'x')",
  '../../escape.md': 'must never be written outside the checkout',
};
let server: Server;
let base = '';

beforeAll(async () => {
  server = createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://x');
    if (u.pathname === '/api/repos/acme/demo')
      return res.end(
        JSON.stringify({ default_branch: 'main', stargazers_count: 3, license: { spdx_id: 'Apache-2.0' } }),
      );
    if (u.pathname === '/api/repos/acme/demo/git/trees/main')
      return res.end(
        JSON.stringify({ tree: Object.keys(FILES).map((path) => ({ path, type: 'blob', size: 100 })) }),
      );
    const m = /^\/raw\/acme\/demo\/main\/(.+)$/.exec(u.pathname);
    const f = m ? FILES[decodeURIComponent(m[1] as string)] : undefined;
    if (f !== undefined) return res.end(f);
    res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => server.close());

describe('static repository URL audit (no code executed)', () => {
  it('parses only github.com/owner/repo URLs', () => {
    expect(parseGithubUrl('https://github.com/acme/demo.git')).toEqual({ owner: 'acme', repo: 'demo' });
    expect(() => parseGithubUrl('https://evil.example/acme/demo')).toThrow(/not a GitHub repository URL/);
    expect(() => parseGithubUrl('github.com/acme/demo/../../x')).toThrow();
  });

  it('downloads a bounded file set as data, refuses path traversal, executes nothing', async () => {
    const snap = await fetchStaticRepo('github.com/acme/demo', {
      apiBase: `${base}/api`,
      rawBase: `${base}/raw`,
    });
    try {
      expect(snap).toMatchObject({
        method: 'api-tree',
        default_branch: 'main',
        no_code_executed: true,
        metadata: { license: 'Apache-2.0' },
      });
      expect(snap.files).toEqual(expect.arrayContaining(['README.md', 'package.json', 'steal.js']));
      expect(snap.files.some((f) => f.includes('..'))).toBe(false);
      expect(existsSync(join(snap.dir, '..', '..', 'escape.md'))).toBe(false);
      expect(readFileSync(join(snap.dir, 'steal.js'), 'utf8')).toContain('PWNED');

      const res = await runLaunch({
        root: tmp(),
        repo: snap.dir,
        name: 'acme/demo — STATIC AUDIT · NO CODE EXECUTED',
        mix: 'users=0,segments=0,developers=34,commercial=33,security=33',
        depth: 'quick',
        execute: false,
        staticAudit: {
          source: snap.source,
          files: snap.files.length,
          bytes: snap.bytes,
          method: snap.method,
          no_code_executed: true,
        },
      });
      expect(res.report.static_audit?.no_code_executed).toBe(true);
      expect(res.report.panels.find((p) => p.id === 'developers')).toBeTruthy();
      expect(existsSync('/tmp/ba-static-audit-PWNED')).toBe(false);
    } finally {
      snap.cleanup();
    }
  }, 60_000);

  it('limits are enforced', async () => {
    const snap = await fetchStaticRepo('github.com/acme/demo', {
      apiBase: `${base}/api`,
      rawBase: `${base}/raw`,
      limits: { maxFiles: 1 },
    });
    expect(snap.files).toHaveLength(1);
    snap.cleanup();
  });
});
