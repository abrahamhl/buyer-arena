import { AsyncLocalStorage } from 'node:async_hooks';
import { isIP } from 'node:net';
import { z } from 'zod';

/**
 * Global network policy.
 *
 *   OFFLINE  loopback only. No cloud models, no public URLs, no remote metadata, no adapter
 *            network. Local models, localhost targets, local repos and cached catalogs work.
 *   LOCAL    loopback + private network (LAN, docker bridge, declared private hosts).
 *   HYBRID   LOCAL + public hosts for the selected model providers (and catalog metadata).
 *            Nothing else leaves the machine.
 *   ONLINE   any host, still within the per-feature safety rules (same-origin browsing…).
 *
 * A policy is STRICT when the user chose it (flag, env, config): anything outside it is
 * refused. With no choice made, Buyer Arena starts at LOCAL and escalates only for egress the
 * user explicitly asked for on this command (a public URL, a cloud `--buyer`); every
 * escalation is printed and recorded. Nothing ever escalates implicitly: there is no
 * telemetry and no automatic refresh.
 */
export const NetworkMode = z.enum(['offline', 'local', 'hybrid', 'online']);
export type NetworkMode = z.infer<typeof NetworkMode>;
const RANK: Record<NetworkMode, number> = { offline: 0, local: 1, hybrid: 2, online: 3 };

export type HostClass = 'loopback' | 'private' | 'public';
export type Purpose =
  'model' | 'browser' | 'adapter' | 'catalog' | 'package-registry' | 'repo-metadata' | 'security-probe';

export interface NetworkPolicy {
  mode: NetworkMode;
  source: 'flag' | 'env' | 'config' | 'default';
  strict: boolean;
  /** HYBRID: provider ids allowed to receive data. Empty = any provider the user configured. */
  allowProviders: string[];
}

export class NetworkPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkPolicyError';
  }
}

/* ─────────────────────────── host classification ─────────────────────────── */

function ipv4Class(ip: string): HostClass {
  const [a = 0, b = 0] = ip.split('.').map(Number);
  if (a === 127 || a === 0) return 'loopback';
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return 'private';
  if (a === 169 && b === 254) return 'private';
  if (a === 100 && b >= 64 && b <= 127) return 'private'; // CGNAT / tailnets
  return 'public';
}

function ipv6Class(ip: string): HostClass {
  const v = ip.toLowerCase();
  if (v === '::1' || v === '::') return 'loopback';
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
  if (mapped) return ipv4Class(mapped[1] as string);
  if (/^f[cd]/.test(v) || /^fe[89ab]/.test(v)) return 'private';
  return 'public';
}

function declaredPrivate(): string[] {
  return (process.env.BUYER_ARENA_PRIVATE_HOSTS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Classify a host WITHOUT DNS (resolving would itself be network access, and a public name
 * can resolve to anything). Names are public unless they are `localhost`/`*.localhost` or
 * listed in BUYER_ARENA_PRIVATE_HOSTS.
 */
export function classifyHost(hostOrUrl: string): HostClass {
  let host = hostOrUrl;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(hostOrUrl)) host = new URL(hostOrUrl).hostname;
  host = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (isIP(host) === 4) return ipv4Class(host);
  if (isIP(host) === 6) return ipv6Class(host);
  if (host === 'localhost' || host.endsWith('.localhost')) return 'loopback';
  if (declaredPrivate().includes(host)) return 'private';
  return 'public';
}

export const isLocalEndpoint = (url: string): boolean => {
  try {
    return classifyHost(url) !== 'public';
  } catch {
    return false;
  }
};

/** Least permissive mode in which a host may be contacted for a purpose. */
export function requiredMode(cls: HostClass, purpose: Purpose): NetworkMode {
  if (cls === 'loopback') return 'offline';
  if (cls === 'private') return 'local';
  return purpose === 'model' || purpose === 'catalog' ? 'hybrid' : 'online';
}

/* ─────────────────────────── ledger ─────────────────────────── */

export interface HostRecord {
  host: string;
  class: HostClass;
  purposes: Purpose[];
  count: number;
}
export interface ProviderRecord {
  provider: string;
  model: string;
  host: string;
  locality: 'local' | 'cloud' | 'delegated';
  calls: number;
  /** What kind of data was sent. Never the data itself. */
  data: string[];
}
export interface AdapterRecord {
  id: string;
  network_accessed: boolean;
  hosts: string[];
}

export const NetworkLedgerSchema = z.object({
  version: z.literal(1),
  policy: z.object({
    mode: NetworkMode,
    source: z.enum(['flag', 'env', 'config', 'default']),
    strict: z.boolean(),
    allow_providers: z.array(z.string()),
  }),
  effective_mode: NetworkMode,
  escalations: z.array(
    z.object({ to: NetworkMode, host: z.string(), purpose: z.string(), reason: z.string() }),
  ),
  hosts: z.array(
    z.object({ host: z.string(), class: z.string(), purposes: z.array(z.string()), count: z.number() }),
  ),
  providers: z.array(
    z.object({
      provider: z.string(),
      model: z.string(),
      host: z.string(),
      locality: z.enum(['local', 'cloud', 'delegated']),
      calls: z.number(),
      data: z.array(z.string()),
    }),
  ),
  adapters: z.array(z.object({ id: z.string(), network_accessed: z.boolean(), hosts: z.array(z.string()) })),
  denied: z.array(z.object({ host: z.string(), purpose: z.string(), reason: z.string() })),
  /** True when nothing left the machine (only loopback hosts, no cloud provider). */
  stayed_local: z.boolean(),
});
export type NetworkLedgerV1 = z.infer<typeof NetworkLedgerSchema>;

export class NetworkLedger {
  private hosts = new Map<string, HostRecord>();
  private providers = new Map<string, ProviderRecord>();
  private adapters = new Map<string, AdapterRecord>();
  private escalations: NetworkLedgerV1['escalations'] = [];
  private denied: NetworkLedgerV1['denied'] = [];
  private effective: NetworkMode;
  /** Called once per new escalation (CLI prints it on stderr). */
  onEscalate?: (e: NetworkLedgerV1['escalations'][number]) => void;

  constructor(readonly policy: NetworkPolicy) {
    this.effective = policy.mode;
  }

  get effectiveMode(): NetworkMode {
    return this.effective;
  }

  /**
   * Decide whether `url` may be contacted. Throws NetworkPolicyError when refused.
   * `explicit` = the user named this target/provider on this command (enables escalation
   * of a non-strict default policy).
   */
  check(url: string, purpose: Purpose, opts: { explicit?: boolean; provider?: string } = {}): HostClass {
    const u = new URL(url);
    if (u.protocol === 'file:' || u.protocol === 'data:' || u.protocol === 'about:') return 'loopback';
    const host = u.host;
    const cls = classifyHost(u.hostname);
    const need = requiredMode(cls, purpose);
    const refuse = (reason: string): never => {
      this.denied.push({ host, purpose, reason });
      throw new NetworkPolicyError(
        `network policy ${this.policy.mode.toUpperCase()} refuses ${purpose} access to ${host} (${cls}): ${reason}`,
      );
    };
    if (
      this.policy.mode === 'hybrid' &&
      purpose === 'model' &&
      cls === 'public' &&
      opts.provider &&
      this.policy.allowProviders.length > 0 &&
      !this.policy.allowProviders.includes(opts.provider)
    ) {
      refuse(
        `provider "${opts.provider}" is not in the allowed list (${this.policy.allowProviders.join(', ')})`,
      );
    }
    if (RANK[need] > RANK[this.effective]) {
      if (this.policy.strict) refuse(`needs ${need.toUpperCase()} or wider`);
      if (!opts.explicit)
        refuse(`needs ${need.toUpperCase()}; only explicitly requested targets may escalate`);
      const e = { to: need, host, purpose, reason: 'explicitly requested on this command' };
      this.escalations.push(e);
      this.effective = need;
      this.onEscalate?.(e);
    }
    this.contact(host, cls, purpose);
    return cls;
  }

  /** Record a contact that was already authorised (e.g. same-origin browser subrequests). */
  contact(host: string, cls: HostClass, purpose: Purpose): void {
    const prev = this.hosts.get(host) ?? { host, class: cls, purposes: [], count: 0 };
    if (!prev.purposes.includes(purpose)) prev.purposes.push(purpose);
    prev.count++;
    this.hosts.set(host, prev);
  }

  recordProvider(r: Omit<ProviderRecord, 'calls'>): void {
    const key = `${r.provider}|${r.model}|${r.host}`;
    const prev = this.providers.get(key) ?? { ...r, calls: 0, data: [] };
    prev.calls++;
    for (const d of r.data) if (!prev.data.includes(d)) prev.data.push(d);
    this.providers.set(key, prev);
  }

  recordAdapter(id: string, networkAccessed: boolean, hosts: string[] = []): void {
    const prev = this.adapters.get(id) ?? { id, network_accessed: false, hosts: [] };
    prev.network_accessed ||= networkAccessed;
    for (const h of hosts) if (!prev.hosts.includes(h)) prev.hosts.push(h);
    this.adapters.set(id, prev);
  }

  snapshot(): NetworkLedgerV1 {
    const hosts = [...this.hosts.values()].sort((a, b) => a.host.localeCompare(b.host));
    const providers = [...this.providers.values()];
    return {
      version: 1,
      policy: {
        mode: this.policy.mode,
        source: this.policy.source,
        strict: this.policy.strict,
        allow_providers: this.policy.allowProviders,
      },
      effective_mode: this.effective,
      escalations: [...this.escalations],
      hosts,
      providers,
      adapters: [...this.adapters.values()],
      denied: [...this.denied],
      stayed_local:
        hosts.every((h) => h.class === 'loopback') && providers.every((p) => p.locality === 'local'),
    };
  }
}

/* ─────────────────────────── resolution + scope ─────────────────────────── */

export function resolvePolicy(
  o: {
    flag?: string;
    config?: { mode?: string; allow_providers?: string[] };
    allowProviders?: string[];
  } = {},
): NetworkPolicy {
  const env = process.env;
  const parse = (v: string, where: string): NetworkMode => {
    const r = NetworkMode.safeParse(v.toLowerCase());
    if (!r.success)
      throw new NetworkPolicyError(`${where}: unknown network mode "${v}" (offline|local|hybrid|online)`);
    return r.data;
  };
  const allow = o.allowProviders ?? o.config?.allow_providers ?? [];
  if (o.flag)
    return { mode: parse(o.flag, '--network'), source: 'flag', strict: true, allowProviders: allow };
  // Backward compatible: BUYER_ARENA_OFFLINE=1 has always meant "nothing paid, nothing remote".
  if (env.BUYER_ARENA_OFFLINE === '1')
    return { mode: 'offline', source: 'env', strict: true, allowProviders: allow };
  if (env.BUYER_ARENA_NETWORK)
    return {
      mode: parse(env.BUYER_ARENA_NETWORK, 'BUYER_ARENA_NETWORK'),
      source: 'env',
      strict: true,
      allowProviders: allow,
    };
  if (o.config?.mode)
    return {
      mode: parse(o.config.mode, 'buyer-arena.yaml network.mode'),
      source: 'config',
      strict: true,
      allowProviders: allow,
    };
  return { mode: 'local', source: 'default', strict: false, allowProviders: allow };
}

const scope = new AsyncLocalStorage<NetworkLedger>();
let fallback: NetworkLedger | undefined;

/** The ledger for the current async scope (a command, a session, an MCP call). */
export function currentLedger(): NetworkLedger {
  const s = scope.getStore();
  if (s) return s;
  // Outside any scope (library use, tests): a process-wide ledger from env, re-resolved if env changed.
  const p = resolvePolicy();
  if (!fallback || fallback.policy.mode !== p.mode || fallback.policy.strict !== p.strict)
    fallback = new NetworkLedger(p);
  return fallback;
}

/** Bind a ledger to the rest of the current async flow (CLI preAction hook). */
export function enterNetworkScope(ledger: NetworkLedger): void {
  scope.enterWith(ledger);
}

export function withNetworkScope<T>(ledger: NetworkLedger, fn: () => T): T {
  return scope.run(ledger, fn);
}

/** Non-throwing variant of `check` for optional steps that degrade to "skipped". */
export function tryNetwork(
  url: string,
  purpose: Purpose,
  opts: { explicit?: boolean; provider?: string } = {},
): { ok: true } | { ok: false; reason: string } {
  try {
    currentLedger().check(url, purpose, opts);
    return { ok: true };
  } catch (err) {
    if (err instanceof NetworkPolicyError) return { ok: false, reason: err.message };
    throw err;
  }
}

/** One-line human summary of what left the machine. */
export function describeLedger(l: NetworkLedgerV1): string {
  const mode = l.effective_mode.toUpperCase();
  const cloud = l.providers.filter((p) => p.locality !== 'local');
  const remote = l.hosts.filter((h) => h.class !== 'loopback').map((h) => h.host);
  if (l.stayed_local) return `network ${mode} · nothing left this machine`;
  const parts = [];
  if (cloud.length) parts.push(`model data → ${cloud.map((p) => `${p.provider}:${p.model}`).join(', ')}`);
  if (remote.length) parts.push(`hosts contacted: ${remote.join(', ')}`);
  return `network ${mode} · ${parts.join(' · ')}`;
}
