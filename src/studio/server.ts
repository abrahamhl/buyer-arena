import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, resolve, sep } from 'node:path';
import { runLaunch } from '../launch.js';
import { allocate, DEFAULT_MIX, estimateSeconds, parseMix } from '../panels/mix.js';
import { PANELS, type ProgressEvent } from '../panels/types.js';
import { asset } from '../reports/html.js';
import { assertTarget } from '../workflow.js';
import { STUDIO_HTML } from './page.js';

export interface StudioOptions {
  root: string;
  port?: number;
  /** Repositories the studio may review. Default: the current directory only. */
  repos?: string[];
  argus?: string;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
};

const HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};

/**
 * Local launch studio. Security model:
 * - binds to 127.0.0.1 only; never 0.0.0.0
 * - Host header must be 127.0.0.1:<port> or localhost:<port> (blocks DNS rebinding)
 * - every API call needs the per-process random token; POSTs also need a same-origin Origin
 * - no cookies, no third-party requests, strict CSP
 * - only one run at a time; repositories limited to an allow-list; files served only from
 *   <root>/launch with path-traversal checks and a fixed set of file types
 */
export async function startStudio(o: StudioOptions): Promise<{ url: string; close(): Promise<void> }> {
  const token = randomBytes(24).toString('hex');
  const root = resolve(o.root);
  const launches = join(root, 'launch');
  const repos = (o.repos?.length ? o.repos : [process.cwd()]).map((r) => resolve(r));
  const clients = new Set<ServerResponse>();
  const history: ProgressEvent[] = [];
  let running: AbortController | null = null;
  let port = 0;

  const tokenOk = (t: string | null | undefined) => {
    if (!t || t.length !== token.length) return false;
    return timingSafeEqual(Buffer.from(t), Buffer.from(token));
  };
  const hostOk = (req: IncomingMessage) =>
    req.headers.host === `127.0.0.1:${port}` || req.headers.host === `localhost:${port}`;
  const originOk = (req: IncomingMessage) => {
    const or = req.headers.origin;
    return or === `http://127.0.0.1:${port}` || or === `http://localhost:${port}`;
  };
  const send = (res: ServerResponse, code: number, body: string | Buffer, type = 'application/json') => {
    res.writeHead(code, { ...HEADERS, 'Content-Type': type });
    res.end(body);
  };
  const json = (res: ServerResponse, code: number, v: unknown) => send(res, code, JSON.stringify(v));
  const broadcast = (e: ProgressEvent | { type: 'error'; message: string } | { type: 'reset' }) => {
    if (e.type !== 'reset' && e.type !== 'error') history.push(e);
    const line = `data: ${JSON.stringify(e)}\n\n`;
    for (const c of clients) c.write(line);
  };
  const readBody = (req: IncomingMessage) =>
    new Promise<string>((ok, bad) => {
      let s = '';
      req.on('data', (d: Buffer) => {
        s += d.toString('utf8');
        if (s.length > 16_384) {
          bad(new Error('body too large'));
          req.destroy();
        }
      });
      req.on('end', () => ok(s));
      req.on('error', bad);
    });

  const server = createServer((req, res) => {
    void (async () => {
      if (!hostOk(req)) return send(res, 421, 'misdirected', 'text/plain');
      const u = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
      const p = u.pathname;
      if (req.method === 'GET' && p === '/')
        return send(
          res,
          200,
          STUDIO_HTML(asset('fonts/inter-latin-wght.woff2').toString('base64')),
          TYPES['.html'],
        );
      if (p.startsWith('/api/')) {
        const t = req.headers['x-ba-token'];
        if (!tokenOk(typeof t === 'string' ? t : u.searchParams.get('token')))
          return json(res, 403, { error: 'bad token' });
        if (req.method === 'GET' && p === '/api/config')
          return json(res, 200, {
            panels: PANELS,
            mix: DEFAULT_MIX,
            repos,
            argus: Boolean(o.argus),
            running: Boolean(running),
          });
        if (req.method === 'GET' && p === '/api/plan') {
          try {
            const depth =
              (['quick', 'standard', 'deep'] as const).find((d) => d === u.searchParams.get('depth')) ??
              'standard';
            const size = Math.max(5, Math.min(200, Number(u.searchParams.get('size')) || 40));
            const allocations = allocate(parseMix(u.searchParams.get('mix') ?? undefined), size, depth);
            return json(res, 200, {
              allocations,
              estimate_s: estimateSeconds(allocations, { execute: false, compare: false }),
            });
          } catch (e) {
            return json(res, 400, { error: (e as Error).message });
          }
        }
        if (req.method === 'GET' && p === '/api/events') {
          res.writeHead(200, { ...HEADERS, 'Content-Type': 'text/event-stream', Connection: 'keep-alive' });
          for (const e of history) res.write(`data: ${JSON.stringify(e)}\n\n`);
          clients.add(res);
          req.on('close', () => clients.delete(res));
          return;
        }
        if (req.method !== 'POST' || !originOk(req)) return json(res, 403, { error: 'origin' });
        if (p === '/api/cancel') {
          running?.abort();
          return json(res, 200, { ok: true });
        }
        if (p === '/api/run') {
          if (running) return json(res, 409, { error: 'a run is already in progress' });
          let b: Record<string, unknown>;
          try {
            b = JSON.parse(await readBody(req)) as Record<string, unknown>;
          } catch {
            return json(res, 400, { error: 'invalid JSON' });
          }
          const repo = typeof b.repo === 'string' && b.repo ? resolve(b.repo) : undefined;
          if (repo && !repos.includes(repo))
            return json(res, 400, { error: 'repository not in the allow-list (start studio with --repo)' });
          const url = typeof b.url === 'string' && b.url ? b.url : undefined;
          try {
            if (url) assertTarget(url);
          } catch (e) {
            return json(res, 400, { error: (e as Error).message });
          }
          const mix: Record<string, number> = {};
          for (const id of PANELS)
            mix[id] = Math.max(
              0,
              Math.min(100, Number((b.mix as Record<string, unknown> | undefined)?.[id] ?? 0) || 0),
            );
          const size = Math.max(5, Math.min(200, Number(b.size) || 40));
          const depth = (['quick', 'standard', 'deep'] as const).find((d) => d === b.depth) ?? 'standard';
          running = new AbortController();
          history.length = 0;
          broadcast({ type: 'reset' });
          json(res, 202, { ok: true });
          try {
            const r = await runLaunch({
              root,
              repo,
              url,
              demo: Boolean(b.demo) && !url,
              mix: parseMix(PANELS.map((id) => id + '=' + String(mix[id])).join(',')),
              size,
              depth,
              execute: Boolean(b.execute),
              argus: b.argus && o.argus ? o.argus : undefined,
              emit: broadcast,
              signal: running.signal,
            });
            broadcast({ type: 'log', panel: 'users', line: `report → /launch/${r.report.id}/report.html` });
          } catch (e) {
            broadcast({ type: 'error', message: (e as Error).message });
          } finally {
            running = null;
          }
          return;
        }
        return json(res, 404, { error: 'not found' });
      }
      if (req.method === 'GET' && p.startsWith('/launch/')) {
        const rel = decodeURIComponent(p.slice('/launch/'.length));
        const file = resolve(launches, rel);
        const type = TYPES[extname(file).toLowerCase()];
        if (
          !type ||
          rel.includes('\0') ||
          !file.startsWith(launches + sep) ||
          !existsSync(file) ||
          !statSync(file).isFile()
        )
          return send(res, 404, 'not found', 'text/plain');
        return send(res, 200, readFileSync(file), type);
      }
      return send(res, 404, 'not found', 'text/plain');
    })().catch((e: unknown) => {
      if (!res.headersSent) send(res, 500, String((e as Error).message), 'text/plain');
    });
  });
  await new Promise<void>((ok) => server.listen(o.port ?? 0, '127.0.0.1', ok));
  port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}/#token=${token}`,
    close: () =>
      new Promise<void>((ok) => {
        running?.abort();
        for (const c of clients) c.end();
        server.close(() => ok());
      }),
  };
}
