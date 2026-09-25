import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFileAtomic } from '../core/fs.js';
import { currentLedger } from '../policy/network.js';
import { lookupPricing, PESSIMISTIC_PRICING } from '../providers/pricing.js';
import type { ModelPricing } from '../providers/types.js';

/**
 * Model catalog. Three layers, later wins:
 *   1. built-in: providers Buyer Arena ships adapters for + an indicative price table
 *   2. Models.dev snapshot (OPTIONAL, cached locally; only `models refresh` downloads it)
 *   3. overrides from buyer-arena.yaml `models.overrides` (your negotiated prices, context…)
 * Buyer Arena works with layer 1 alone. Remote prices are never trusted forever: a snapshot
 * older than STALE_DAYS is reported as stale and its prices are flagged.
 */
export type Locality = 'local' | 'cloud' | 'delegated';
export type PricingSource = 'override' | 'models.dev' | 'builtin-table' | 'free-local' | 'unknown';

export interface ModelInfo {
  /** Buyer Arena provider spec: `<provider>:<model>` — what --buyer / --auditor accept. */
  spec: string;
  provider: string;
  model: string;
  name?: string;
  locality: Locality;
  pricing: ModelPricing | null;
  pricing_source: PricingSource;
  context?: number;
  output_limit?: number;
  vision?: boolean;
  tools?: boolean;
  structured_output?: boolean;
  reasoning?: boolean;
  open_weights?: boolean;
  /** Provider picks the model at request time (e.g. openrouter/auto): not reproducible. */
  dynamic?: boolean;
  source: 'builtin' | 'models.dev' | 'override' | 'discovered';
}

export interface Catalog {
  version: string;
  models_dev?: { fetched_at: string; stale: boolean; providers: number; models: number };
  models: ModelInfo[];
}

export const STALE_DAYS = 30;
export const MODELS_DEV_URL = 'https://models.dev/api.json';

/** Buyer Arena provider ids ↔ Models.dev provider ids (only where adapters exist). */
const PROVIDER_MAP: Record<string, string> = {
  anthropic: 'anthropic',
  openai: 'openai',
  openrouter: 'openrouter',
};

export function cacheDir(): string {
  const base =
    process.env.BUYER_ARENA_CACHE_DIR ??
    (process.env.XDG_CACHE_HOME
      ? join(process.env.XDG_CACHE_HOME, 'buyer-arena')
      : join(homedir(), '.cache', 'buyer-arena'));
  return base;
}
export const snapshotPath = () => join(cacheDir(), 'models-dev.json');

const BUILTIN: ModelInfo[] = [
  {
    spec: 'anthropic:claude-haiku-4-5',
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    locality: 'cloud',
    vision: true,
    tools: true,
    context: 200_000,
  },
  {
    spec: 'anthropic:claude-sonnet-5',
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    locality: 'cloud',
    vision: true,
    tools: true,
  },
  {
    spec: 'anthropic:claude-opus-5-5',
    provider: 'anthropic',
    model: 'claude-opus-5-5',
    locality: 'cloud',
    vision: true,
    tools: true,
  },
  {
    spec: 'openai:gpt-4o-mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
    locality: 'cloud',
    vision: true,
    tools: true,
    structured_output: true,
    context: 128_000,
  },
].map((m) => ({
  ...m,
  pricing: lookupPricing(m.model),
  pricing_source: lookupPricing(m.model) === PESSIMISTIC_PRICING ? 'unknown' : 'builtin-table',
  source: 'builtin',
})) as ModelInfo[];

interface ModelsDevModel {
  id?: string;
  name?: string;
  attachment?: boolean;
  reasoning?: boolean;
  tool_call?: boolean;
  structured_output?: boolean;
  open_weights?: boolean;
  modalities?: { input?: string[]; output?: string[] };
  cost?: { input?: number; output?: number; cache_read?: number };
  limit?: { context?: number; output?: number };
}
interface ModelsDevProvider {
  id?: string;
  name?: string;
  models?: Record<string, ModelsDevModel>;
}

/** Normalise a Models.dev `api.json` document. Unknown providers are kept for discovery. */
export function normalizeModelsDev(doc: unknown): ModelInfo[] {
  if (!doc || typeof doc !== 'object') return [];
  const out: ModelInfo[] = [];
  for (const [pid, p] of Object.entries(doc as Record<string, ModelsDevProvider>)) {
    if (!p || typeof p !== 'object' || !p.models || typeof p.models !== 'object') continue;
    const provider = Object.entries(PROVIDER_MAP).find(([, v]) => v === pid)?.[0] ?? `models.dev/${pid}`;
    for (const [mid, m] of Object.entries(p.models)) {
      if (!m || typeof m !== 'object') continue;
      const cost = m.cost;
      const pricing =
        cost && typeof cost.input === 'number' && typeof cost.output === 'number'
          ? {
              input: cost.input,
              output: cost.output,
              cached_input: typeof cost.cache_read === 'number' ? cost.cache_read : undefined,
            }
          : null;
      out.push({
        spec: `${provider}:${m.id ?? mid}`,
        provider,
        model: m.id ?? mid,
        name: m.name,
        locality: 'cloud',
        pricing,
        pricing_source: pricing ? 'models.dev' : 'unknown',
        context: m.limit?.context,
        output_limit: m.limit?.output,
        vision: m.modalities?.input?.includes('image') ?? m.attachment,
        tools: m.tool_call,
        structured_output: m.structured_output,
        reasoning: m.reasoning,
        open_weights: m.open_weights,
        source: 'models.dev',
      });
    }
  }
  return out;
}

interface Snapshot {
  fetched_at: string;
  url: string;
  doc: unknown;
}

export function readSnapshot(file = snapshotPath()): Snapshot | undefined {
  if (!existsSync(file)) return undefined;
  try {
    const s = JSON.parse(readFileSync(file, 'utf8')) as Snapshot;
    return s && typeof s.fetched_at === 'string' ? s : undefined;
  } catch {
    return undefined;
  }
}

/** Download the Models.dev catalog. Needs HYBRID/ONLINE (or an explicit escalation). */
export async function refreshModelsDev(
  o: { url?: string; file?: string; timeoutMs?: number } = {},
): Promise<Snapshot> {
  const url = o.url ?? MODELS_DEV_URL;
  currentLedger().check(url, 'catalog', { explicit: true });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), o.timeoutMs ?? 20_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    const text = await res.text();
    if (text.length > 64 * 1024 * 1024) throw new Error('catalog larger than 64 MB; refusing');
    const doc = JSON.parse(text) as unknown;
    if (!normalizeModelsDev(doc).length) throw new Error('catalog has no recognisable models');
    const snap: Snapshot = { fetched_at: new Date().toISOString(), url, doc };
    writeFileAtomic(o.file ?? snapshotPath(), JSON.stringify(snap));
    return snap;
  } finally {
    clearTimeout(timer);
  }
}

export interface ModelOverride {
  input?: number;
  output?: number;
  cached_input?: number;
  context?: number;
  vision?: boolean;
  tools?: boolean;
  structured_output?: boolean;
}

/** Build the catalog from local sources only. Never touches the network. */
export function loadCatalog(
  o: {
    overrides?: Record<string, ModelOverride>;
    snapshotFile?: string;
    discovered?: ModelInfo[];
    now?: Date;
  } = {},
): Catalog {
  const byKey = new Map<string, ModelInfo>();
  for (const m of BUILTIN) byKey.set(m.spec, m);
  const snap = readSnapshot(o.snapshotFile);
  let md: Catalog['models_dev'];
  if (snap) {
    const list = normalizeModelsDev(snap.doc);
    const ageDays = ((o.now ?? new Date()).getTime() - new Date(snap.fetched_at).getTime()) / 86_400_000;
    md = {
      fetched_at: snap.fetched_at,
      stale: ageDays > STALE_DAYS,
      providers: new Set(list.map((m) => m.provider)).size,
      models: list.length,
    };
    for (const m of list) {
      const prev = byKey.get(m.spec);
      byKey.set(m.spec, prev ? { ...prev, ...definedOnly(m), source: 'models.dev' } : m);
    }
  }
  for (const m of o.discovered ?? []) if (!byKey.has(m.spec)) byKey.set(m.spec, m);
  for (const [spec, ov] of Object.entries(o.overrides ?? {})) {
    const [provider = spec, ...rest] = spec.split(':');
    const prev: ModelInfo = byKey.get(spec) ?? {
      spec,
      provider,
      model: rest.join(':'),
      locality: ['lmstudio', 'ollama'].includes(provider) ? 'local' : 'cloud',
      pricing: null,
      pricing_source: 'unknown',
      source: 'override',
    };
    const pricing =
      ov.input !== undefined && ov.output !== undefined
        ? { input: ov.input, output: ov.output, cached_input: ov.cached_input }
        : prev.pricing;
    byKey.set(spec, {
      ...prev,
      pricing,
      pricing_source: ov.input !== undefined ? 'override' : prev.pricing_source,
      context: ov.context ?? prev.context,
      vision: ov.vision ?? prev.vision,
      tools: ov.tools ?? prev.tools,
      structured_output: ov.structured_output ?? prev.structured_output,
      source: 'override',
    });
  }
  const models = [...byKey.values()].sort((a, b) => a.spec.localeCompare(b.spec));
  const version = md ? `models.dev@${md.fetched_at.slice(0, 10)}+builtin` : 'builtin';
  return { version, models_dev: md, models };
}

function definedOnly<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** A model the catalog does not list, described from its spec alone (local = free). */
export function describeSpec(spec: string, catalog?: Catalog): ModelInfo {
  const hit = catalog?.models.find((m) => m.spec === spec);
  if (hit) return hit;
  const [provider = spec, ...rest] = spec.split(':');
  const model = rest.join(':');
  const local = provider === 'lmstudio' || provider === 'ollama';
  const delegated = provider === 'opencode';
  const dynamic = provider === 'openrouter' && isDynamicOpenRouterModel(model);
  const table = lookupPricing(model);
  return {
    spec,
    provider,
    model,
    locality: local ? 'local' : delegated ? 'delegated' : 'cloud',
    pricing: local ? { input: 0, output: 0, cached_input: 0 } : table === PESSIMISTIC_PRICING ? null : table,
    pricing_source: local ? 'free-local' : table === PESSIMISTIC_PRICING ? 'unknown' : 'builtin-table',
    dynamic: dynamic || undefined,
    source: 'discovered',
  };
}

/** OpenRouter routes whose model is chosen by the router at request time. */
export function isDynamicOpenRouterModel(model: string): boolean {
  return (
    model === 'openrouter/auto' ||
    model.endsWith(':free') ||
    model.endsWith(':floor') ||
    model.endsWith(':nitro') ||
    model === 'auto'
  );
}
