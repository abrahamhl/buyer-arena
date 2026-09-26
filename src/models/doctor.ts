import { classifyHost, currentLedger, type HostClass } from '../policy/network.js';
import { describeSpec, loadCatalog, type Catalog, type ModelInfo } from './catalog.js';

export interface ModelEndpointStatus {
  provider: string;
  endpoint: string | null;
  /** true/false for probed local endpoints; null = not probed (cloud: probing would send a request). */
  reachable: boolean | null;
  models: string[];
  locality: 'local' | 'cloud' | 'delegated';
  configured: boolean;
  privacy: string;
  price: string;
  context: string;
  note?: string;
}

const boundary = (cls: HostClass | null, host: string | null): string =>
  cls === 'loopback'
    ? 'stays on this machine'
    : cls === 'private'
      ? `private network (${host})`
      : host
        ? `leaves this machine → ${host}`
        : '—';

async function probe(
  base: string,
  timeoutMs = 1500,
): Promise<{ ok: boolean; models: string[]; note?: string }> {
  const url = `${base.replace(/\/$/, '')}/models`;
  // Probing is local-only by construction: callers only probe loopback/private endpoints.
  currentLedger().check(url, 'model', { explicit: true });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return { ok: false, models: [], note: `HTTP ${res.status}` };
    const j = (await res.json()) as { data?: { id?: string }[] };
    return {
      ok: true,
      models: (j.data ?? [])
        .map((m) => m.id ?? '')
        .filter(Boolean)
        .slice(0, 20),
    };
  } catch (err) {
    return {
      ok: false,
      models: [],
      note: ctrl.signal.aborted
        ? 'timeout'
        : /fetch failed|ECONNREFUSED/.test(String(err))
          ? 'not running'
          : String(err).slice(0, 80),
    };
  } finally {
    clearTimeout(timer);
  }
}

const priceOf = (m: ModelInfo | undefined, local: boolean): string =>
  local
    ? '$0 (local)'
    : m?.pricing
      ? `$${m.pricing.input}/$${m.pricing.output} per 1M (${m.pricing_source})`
      : 'unknown';

/**
 * Model doctor. Local endpoints (LM Studio, Ollama, OpenAI-compatible on loopback/LAN) are
 * probed with GET /models. Cloud endpoints are never contacted: we only say whether a key
 * is configured, so `doctor --models` sends nothing anywhere.
 */
export async function modelDoctor(
  o: { catalog?: Catalog; probe?: boolean } = {},
): Promise<ModelEndpointStatus[]> {
  const env = process.env;
  const catalog = o.catalog ?? loadCatalog();
  const out: ModelEndpointStatus[] = [];
  const local = async (provider: string, base: string, configured: boolean) => {
    const cls = classifyHost(base);
    const host = new URL(base).host;
    if (cls === 'public') {
      out.push({
        provider,
        endpoint: base,
        reachable: null,
        models: [],
        locality: 'cloud',
        configured,
        privacy: boundary(cls, host),
        price: 'unknown',
        context: '—',
        note: 'public endpoint: not probed',
      });
      return;
    }
    const p =
      o.probe === false
        ? { ok: false, models: [], note: 'not probed' }
        : await probe(base).catch((e: unknown) => ({
            ok: false,
            models: [] as string[],
            note: String(e).slice(0, 80),
          }));
    out.push({
      provider,
      endpoint: base,
      reachable: o.probe === false ? null : p.ok,
      models: p.models,
      locality: 'local',
      configured,
      privacy: boundary(cls, host),
      price: '$0 (local)',
      context: '—',
      note: p.note,
    });
  };
  await local('lmstudio', env.LMSTUDIO_BASE_URL ?? 'http://localhost:1234/v1', true);
  await local('ollama', env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1', true);
  if (env.OPENAI_BASE_URL) await local('openai-compatible', env.OPENAI_BASE_URL, true);
  const cloud = (provider: string, key: string | undefined, base: string, spec: string) => {
    const m = catalog.models.find((x) => x.spec === spec) ?? describeSpec(spec, catalog);
    out.push({
      provider,
      endpoint: base,
      reachable: null,
      models: key ? [spec.split(':').slice(1).join(':')] : [],
      locality: 'cloud',
      configured: Boolean(key),
      privacy: boundary('public', new URL(base).host),
      price: priceOf(m, false),
      context: m.context ? `${m.context.toLocaleString('en')} tokens` : 'unknown',
      note: key ? 'key present (not probed: no request sent)' : 'no key',
    });
  };
  cloud(
    'anthropic',
    env.ANTHROPIC_API_KEY,
    env.BUYER_ARENA_ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com',
    'anthropic:claude-haiku-4-5',
  );
  cloud('openai', env.OPENAI_API_KEY, 'https://api.openai.com/v1', 'openai:gpt-4o-mini');
  cloud(
    'openrouter',
    env.OPENROUTER_API_KEY,
    env.BUYER_ARENA_OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    'openrouter:openrouter/auto',
  );
  return out;
}
