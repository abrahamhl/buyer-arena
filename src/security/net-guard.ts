import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { TargetNotAllowedError } from '../core/errors.js';

/**
 * Network trust boundary. Every submitted URL is treated as hostile: it may point at loopback,
 * the private network, a cloud metadata endpoint, or a hostname that resolves (or later
 * re-resolves) to one of those.
 *
 * The WHATWG URL parser already normalises decimal / octal / hex IPv4 forms
 * (`http://2130706433/` → `127.0.0.1`), so checks run on `URL.hostname`, never on raw input.
 */

/** True when this process serves untrusted users (hosted mode). Local-only escape hatches are refused. */
export const hostedMode = () => process.env.BUYER_ARENA_HOSTED === '1';

const v4 = (ip: string): number[] | undefined => {
  const p = ip.split('.').map(Number);
  return p.length === 4 && p.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? p : undefined;
};

const inV4 = (p: number[], base: string, bits: number): boolean => {
  const b = v4(base) as number[];
  const toInt = (x: number[]) => ((x[0]! << 24) >>> 0) + (x[1]! << 16) + (x[2]! << 8) + x[3]!;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (toInt(p) & mask) >>> 0 === (toInt(b) & mask) >>> 0;
};

const V4_BLOCKS: [string, number, string][] = [
  ['0.0.0.0', 8, 'unspecified'],
  ['10.0.0.0', 8, 'private (RFC 1918)'],
  ['100.64.0.0', 10, 'carrier-grade NAT (includes 100.100.100.200 metadata)'],
  ['127.0.0.0', 8, 'loopback'],
  ['169.254.0.0', 16, 'link-local (includes 169.254.169.254 cloud metadata)'],
  ['172.16.0.0', 12, 'private (RFC 1918)'],
  ['192.0.0.0', 24, 'IETF protocol assignments'],
  ['192.0.2.0', 24, 'documentation'],
  ['192.88.99.0', 24, '6to4 relay'],
  ['192.168.0.0', 16, 'private (RFC 1918)'],
  ['198.18.0.0', 15, 'benchmarking'],
  ['198.51.100.0', 24, 'documentation'],
  ['203.0.113.0', 24, 'documentation'],
  ['224.0.0.0', 4, 'multicast'],
  ['240.0.0.0', 4, 'reserved / broadcast'],
];

/** Expand an IPv6 literal into 8 hextets. Returns undefined for malformed input. */
function hextets(ip: string): number[] | undefined {
  let s = ip.toLowerCase().replace(/^\[|\]$/g, '');
  const zone = s.indexOf('%');
  if (zone >= 0) s = s.slice(0, zone);
  // Embedded IPv4 tail (::ffff:1.2.3.4)
  const tail = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const p = v4(tail[1] as string);
    if (!p) return undefined;
    s =
      s.slice(0, -tail[1]!.length) +
      `${((p[0]! << 8) | p[1]!).toString(16)}:${((p[2]! << 8) | p[3]!).toString(16)}`;
  }
  const [head, rest] = s.split('::') as [string, string | undefined];
  const a = head ? head.split(':') : [];
  const b = rest !== undefined && rest !== '' ? rest.split(':') : [];
  if (s.split('::').length > 2) return undefined;
  const fill = rest === undefined ? 0 : 8 - a.length - b.length;
  if (fill < 0) return undefined;
  const all = [...a, ...Array<string>(fill).fill('0'), ...b];
  if (all.length !== 8) return undefined;
  const out = all.map((h) => parseInt(h || '0', 16));
  return out.every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffff) ? out : undefined;
}

/**
 * Why an IP address must not be reached from an untrusted target, or undefined when it is a
 * public unicast address.
 */
export function blockedAddressReason(ip: string): string | undefined {
  const fam = isIP(ip.replace(/^\[|\]$/g, '').split('%')[0] as string);
  if (fam === 4) {
    const p = v4(ip) as number[];
    for (const [base, bits, why] of V4_BLOCKS) if (inV4(p, base, bits)) return why;
    return undefined;
  }
  if (fam !== 6) return 'not an IP address';
  const h = hextets(ip);
  if (!h) return 'malformed IPv6 address';
  const embedded = (hi: number, lo: number) =>
    `${h[hi]! >> 8}.${h[hi]! & 255}.${h[lo]! >> 8}.${h[lo]! & 255}`;
  if (h.every((x) => x === 0)) return 'unspecified';
  if (h.slice(0, 7).every((x) => x === 0) && h[7] === 1) return 'loopback';
  // IPv4-mapped / IPv4-compatible / NAT64 / 6to4: judge the embedded IPv4 address.
  if (h.slice(0, 5).every((x) => x === 0) && (h[5] === 0xffff || h[5] === 0)) {
    const inner = blockedAddressReason(embedded(6, 7));
    return inner ? `IPv4-mapped ${inner}` : undefined;
  }
  if (h[0] === 0x64 && h[1] === 0xff9b) {
    const inner = blockedAddressReason(embedded(6, 7));
    return inner ? `NAT64 ${inner}` : undefined;
  }
  if (h[0] === 0x2002) {
    const inner = blockedAddressReason(embedded(1, 2));
    return inner ? `6to4 ${inner}` : undefined;
  }
  if ((h[0]! & 0xfe00) === 0xfc00) return 'unique local (includes fd00:ec2::254 metadata)';
  if ((h[0]! & 0xffc0) === 0xfe80) return 'link-local';
  if ((h[0]! & 0xffc0) === 0xfec0) return 'site-local (deprecated)';
  if ((h[0]! & 0xff00) === 0xff00) return 'multicast';
  if (h[0] === 0x2001 && h[1] === 0x0db8) return 'documentation';
  if (h[0] === 0x0100 && h[1] === 0 && h[2] === 0 && h[3] === 0) return 'discard-only';
  return undefined;
}

const BLOCKED_HOSTNAMES = [
  /^localhost$/,
  /\.localhost$/,
  /^metadata$/,
  /^metadata\.google\.internal$/,
  /\.internal$/,
  /\.local$/,
  /\.lan$/,
  /\.home\.arpa$/,
  /^instance-data$/,
];

export interface PublicTarget {
  url: URL;
  host: string;
  port: number;
  /** Every address the host resolved to at check time. All of them are public. */
  addresses: string[];
}

export type Resolver = (host: string) => Promise<string[]>;
export const systemResolver: Resolver = async (host) =>
  (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);

export const defaultPort = (u: URL) => Number(u.port || (u.protocol === 'https:' ? 443 : 80));

/** Protocol and shape checks that need no DNS. */
export function assertUrlShape(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new TargetNotAllowedError(`not a valid URL: ${raw}`);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:')
    throw new TargetNotAllowedError(`only http(s) targets are allowed (got ${u.protocol})`);
  if (u.username || u.password) throw new TargetNotAllowedError('URLs with embedded credentials are refused');
  return u;
}

/**
 * Resolve the host and require that EVERY address is public. A hostname with one public and
 * one private A record is refused: the browser may pick either.
 */
export async function assertPublicUrl(
  raw: string,
  resolver: Resolver = systemResolver,
): Promise<PublicTarget> {
  const url = assertUrlShape(raw);
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const port = defaultPort(url);
  if (BLOCKED_HOSTNAMES.some((re) => re.test(host)))
    throw new TargetNotAllowedError(`host ${host} is an internal name and is refused`);
  let addresses: string[];
  if (isIP(host)) addresses = [host];
  else {
    try {
      addresses = await resolver(host);
    } catch {
      throw new TargetNotAllowedError(`host ${host} does not resolve`);
    }
  }
  if (!addresses.length) throw new TargetNotAllowedError(`host ${host} does not resolve`);
  for (const a of addresses) {
    const why = blockedAddressReason(a);
    if (why) throw new TargetNotAllowedError(`host ${host} resolves to ${a} (${why}); refused`);
  }
  return { url, host, port, addresses };
}

/**
 * Follow the start URL's redirect chain by hand (never letting fetch follow it), validating
 * every hop. Returns the final URL and every host that the chain touched.
 */
export async function resolveRedirectChain(
  raw: string,
  opts: { resolver?: Resolver; maxHops?: number; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<{ final: string; hops: string[] }> {
  const f = opts.fetchImpl ?? fetch;
  const hops: string[] = [];
  let cur = raw;
  for (let i = 0; i <= (opts.maxHops ?? 5); i++) {
    await assertPublicUrl(cur, opts.resolver);
    hops.push(cur);
    let res: Response;
    try {
      res = await f(cur, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
      });
    } catch {
      return { final: cur, hops };
    }
    await res.body?.cancel().catch(() => undefined);
    const loc = res.headers.get('location');
    if (res.status < 300 || res.status >= 400 || !loc) return { final: cur, hops };
    cur = new URL(loc, cur).toString();
  }
  throw new TargetNotAllowedError(`too many redirects starting at ${raw}`);
}

/**
 * Environment for a child process that runs UNTRUSTED code (a repository's install or build
 * scripts). Only what a package manager needs survives; every credential-looking variable is
 * dropped, including the provider keys Buyer Arena itself may be using.
 */
export function scrubbedEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const KEEP = [
    'PATH',
    'Path',
    'HOME',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
    'TEMP',
    'TMP',
    'TMPDIR',
    'SystemRoot',
    'SYSTEMROOT',
    'ComSpec',
    'COMSPEC',
    'PATHEXT',
    'WINDIR',
    'LANG',
    'LC_ALL',
    'TERM',
    'SHELL',
    'PLAYWRIGHT_BROWSERS_PATH',
  ];
  const out: NodeJS.ProcessEnv = {};
  for (const k of KEEP) if (process.env[k] !== undefined) out[k] = process.env[k];
  return { ...out, CI: '1', NO_COLOR: '1', FORCE_COLOR: '0', npm_config_fund: 'false', ...extra };
}
