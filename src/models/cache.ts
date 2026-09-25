import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeFileAtomic } from '../core/fs.js';
import { canonicalJson, sha256 } from '../evidence/envelope.js';
import type { ChatProvider, ChatRequest, ChatResponse } from '../providers/types.js';
import { isDynamicOpenRouterModel } from './catalog.js';

/**
 * Exact response cache.
 *
 * Key = provider + endpoint + requested model + digest(system) + digest(messages) +
 * temperature + max tokens + cache schema version. A cached answer is reused ONLY for the
 * identical request to the identical model configuration. Never cached:
 *   - temperature > 0 (the answer is a sample, re-asking is the point)
 *   - dynamic routes and floating aliases (`openrouter/auto`, `:free`, `*-latest`), because
 *     the model behind the name can change between calls
 *   - responses whose returned model differs from the one requested (silent substitution)
 */
export const CACHE_SCHEMA = 'resp-v1';

export interface CacheStats {
  hits: number;
  misses: number;
  skipped: number;
  writes: number;
}

interface Entry {
  schema: string;
  key: string;
  created_at: string;
  provider: string;
  model: string;
  response: ChatResponse;
}

export function cacheable(provider: ChatProvider, req: ChatRequest): { ok: boolean; why?: string } {
  if ((req.temperature ?? 0) > 0) return { ok: false, why: 'temperature > 0' };
  if (/(^|[-/:])latest$/.test(provider.model) || isDynamicOpenRouterModel(provider.model))
    return { ok: false, why: 'floating model alias / dynamic route' };
  return { ok: true };
}

export function cacheKey(provider: ChatProvider & { baseUrl?: string }, req: ChatRequest): string {
  return sha256(
    canonicalJson({
      v: CACHE_SCHEMA,
      provider: provider.name,
      endpoint: provider.baseUrl ?? null,
      model: provider.model,
      system: sha256(req.system),
      messages: sha256(canonicalJson(req.messages)),
      temperature: req.temperature ?? 0,
      max_tokens: req.maxTokens,
    }),
  ).slice(7);
}

export class ResponseCache {
  readonly stats: CacheStats = { hits: 0, misses: 0, skipped: 0, writes: 0 };
  constructor(readonly dir: string) {}

  private file(key: string): string {
    return join(this.dir, key.slice(0, 2), `${key}.json`);
  }

  get(provider: ChatProvider, req: ChatRequest): ChatResponse | undefined {
    if (!cacheable(provider, req).ok) {
      this.stats.skipped++;
      return undefined;
    }
    const key = cacheKey(provider, req);
    const f = this.file(key);
    if (!existsSync(f)) {
      this.stats.misses++;
      return undefined;
    }
    try {
      const e = JSON.parse(readFileSync(f, 'utf8')) as Entry;
      if (
        e.schema !== CACHE_SCHEMA ||
        e.key !== key ||
        e.provider !== provider.name ||
        e.model !== provider.model
      ) {
        this.stats.misses++;
        return undefined;
      }
      this.stats.hits++;
      // A hit costs nothing and took no time: report it honestly.
      return { ...e.response, latency_ms: 0, usage: { input_tokens: 0, output_tokens: 0, cached_tokens: 0 } };
    } catch {
      this.stats.misses++;
      return undefined;
    }
  }

  put(provider: ChatProvider, req: ChatRequest, res: ChatResponse): void {
    if (!cacheable(provider, req).ok) return;
    if (res.model && res.model !== provider.model && !res.model.startsWith(provider.model)) return;
    const key = cacheKey(provider, req);
    const e: Entry = {
      schema: CACHE_SCHEMA,
      key,
      created_at: new Date().toISOString(),
      provider: provider.name,
      model: provider.model,
      response: res,
    };
    writeFileAtomic(this.file(key), JSON.stringify(e));
    this.stats.writes++;
  }
}
