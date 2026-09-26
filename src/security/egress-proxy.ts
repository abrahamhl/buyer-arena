import { createServer, request as httpRequest, type IncomingMessage, type Server } from 'node:http';
import { connect, isIP, type AddressInfo, type Socket } from 'node:net';
import { TargetNotAllowedError } from '../core/errors.js';
import { assertPublicUrl, defaultPort, hostedMode, systemResolver, type Resolver } from './net-guard.js';

/**
 * Egress guard for browser journeys.
 *
 * Chromium is launched with this process as its HTTP proxy (loopback included), so EVERY request
 * the page makes — sub-resources, redirect hops, fetch/XHR, WebSockets — reaches the network only
 * through `decide()`. The proxy resolves the hostname itself and connects to the address it
 * validated, so a hostname cannot re-resolve to a private address between check and use
 * (DNS rebinding). Addresses are pinned per host for the lifetime of the proxy.
 *
 * Playwright's `route()` layer (same-origin allow-list) stays in place above this; the proxy is
 * the layer that also sees redirect hops, which `route()` does not.
 */

export type Decision = { ok: true; address: string } | { ok: false; reason: string };
export type Decide = (host: string, port: number) => Promise<Decision>;

export interface EgressPolicyOptions {
  /** Origins the user supplied explicitly. Outside hosted mode they are reachable even when private (your own localhost or LAN staging). */
  explicit?: string[];
  resolver?: Resolver;
}

/** The default policy: explicit targets (local mode only) plus public unicast addresses. */
export function egressPolicy(o: EgressPolicyOptions = {}): Decide {
  const resolver = o.resolver ?? systemResolver;
  const hosted = hostedMode();
  const explicit = new Set(
    (o.explicit ?? []).map((u) => {
      const x = new URL(u);
      return `${x.hostname.replace(/^\[|\]$/g, '').toLowerCase()}:${defaultPort(x)}`;
    }),
  );
  const pinned = new Map<string, Promise<Decision>>();
  return (host, port) => {
    const h = host.replace(/^\[|\]$/g, '').toLowerCase();
    const key = `${h}:${port}`;
    let p = pinned.get(key);
    if (!p) {
      p = (async (): Promise<Decision> => {
        if (!hosted && explicit.has(key)) {
          const address = isIP(h) ? h : ((await resolver(h).catch(() => []))[0] ?? '');
          return address ? { ok: true, address } : { ok: false, reason: `${h} does not resolve` };
        }
        try {
          const t = await assertPublicUrl(`http://${isIP(h) === 6 ? `[${h}]` : h}:${port}/`, resolver);
          return { ok: true, address: t.addresses[0] as string };
        } catch (err) {
          return { ok: false, reason: err instanceof TargetNotAllowedError ? err.message : String(err) };
        }
      })();
      pinned.set(key, p);
    }
    return p;
  };
}

export interface EgressProxy {
  url: string;
  /** Chromium flags that force all traffic, loopback included, through the proxy. */
  chromiumArgs: string[];
  blocked: { host: string; port: number; reason: string }[];
  close(): Promise<void>;
}

const HOP_BY_HOP = /^(proxy-connection|proxy-authorization|connection|keep-alive|te|trailer|upgrade)$/i;

export async function startEgressProxy(decide: Decide): Promise<EgressProxy> {
  const blocked: EgressProxy['blocked'] = [];
  const sockets = new Set<Socket>();
  const deny = (host: string, port: number, reason: string) => {
    if (blocked.length < 200) blocked.push({ host, port, reason });
  };

  const server: Server = createServer((req: IncomingMessage, res) => {
    let target: URL;
    try {
      target = new URL(req.url ?? '');
      if (target.protocol !== 'http:') throw new Error('protocol');
    } catch {
      res.writeHead(400).end('bad proxy request');
      return;
    }
    const port = defaultPort(target);
    void decide(target.hostname, port).then((d) => {
      if (!d.ok) {
        deny(target.hostname, port, d.reason);
        res
          .writeHead(403, { 'content-type': 'text/plain' })
          .end(`Blocked by Buyer Arena egress guard: ${d.reason}`);
        return;
      }
      const headers: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(req.headers))
        if (v !== undefined && !HOP_BY_HOP.test(k)) headers[k] = v;
      const up = httpRequest(
        {
          host: d.address,
          port,
          method: req.method,
          path: target.pathname + target.search,
          headers,
          timeout: 60_000,
        },
        (upRes) => {
          const h: Record<string, string | string[]> = {};
          for (const [k, v] of Object.entries(upRes.headers))
            if (v !== undefined && !HOP_BY_HOP.test(k)) h[k] = v;
          res.writeHead(upRes.statusCode ?? 502, h);
          upRes.pipe(res);
        },
      );
      up.on('timeout', () => up.destroy());
      up.on('error', () => {
        if (!res.headersSent) res.writeHead(502).end('upstream error');
        else res.destroy();
      });
      req.pipe(up);
    });
  });

  server.on('connect', (req: IncomingMessage, client: Socket, head: Buffer) => {
    sockets.add(client);
    client.on('close', () => sockets.delete(client));
    client.on('error', () => client.destroy());
    const m = (req.url ?? '').match(/^\[?([^\]]+?)\]?:(\d{1,5})$/);
    if (!m) {
      client.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }
    const host = m[1] as string;
    const port = Number(m[2]);
    void decide(host, port).then((d) => {
      if (!d.ok) {
        deny(host, port, d.reason);
        client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
        return;
      }
      const up = connect(port, d.address, () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) up.write(head);
        up.pipe(client);
        client.pipe(up);
      });
      sockets.add(up);
      up.setTimeout(120_000, () => up.destroy());
      up.on('close', () => {
        sockets.delete(up);
        client.destroy();
      });
      up.on('error', () => client.destroy());
    });
  });
  server.on('connection', (s: Socket) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;
  return {
    url,
    chromiumArgs: [`--proxy-server=${url}`, '--proxy-bypass-list=<-loopback>'],
    blocked,
    close: () =>
      new Promise((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
      }),
  };
}

/** Launch Chromium behind the egress guard. `close()` shuts both down. */
export async function launchGuardedBrowser(
  explicit: string[],
  opts: { headless?: boolean } = {},
): Promise<{ browser: import('playwright').Browser; proxy?: EgressProxy; close(): Promise<void> }> {
  const { chromium } = await import('playwright');
  const guard = hostedMode() || process.env.BUYER_ARENA_EGRESS_GUARD !== '0';
  const proxy = guard ? await startEgressProxy(egressPolicy({ explicit })) : undefined;
  try {
    const browser = await chromium.launch({
      headless: opts.headless ?? true,
      args: proxy?.chromiumArgs ?? [],
    });
    return {
      browser,
      proxy,
      close: async () => {
        await browser.close().catch(() => undefined);
        await proxy?.close();
      },
    };
  } catch (err) {
    await proxy?.close();
    throw err;
  }
}
