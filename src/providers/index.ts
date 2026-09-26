import { ProviderError } from '../core/errors.js';
import { isLocalEndpoint } from '../policy/network.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';
import { OpenCodeProvider } from './opencode.js';
import { OpenRouterProvider } from './openrouter.js';
import type { ChatProvider, ModelPricing } from './types.js';

export * from './types.js';
export { CostMeter, meteredComplete } from './metered.js';
export { MockProvider } from './mock.js';

/**
 * Parse `provider:model` into a provider. Keys come only from the environment;
 * they are never accepted on the command line (shell history) or written to disk.
 */
export function createProvider(spec: string, pricing?: ModelPricing): ChatProvider {
  const idx = spec.indexOf(':');
  const kind = idx === -1 ? spec : spec.slice(0, idx);
  const model = idx === -1 ? '' : spec.slice(idx + 1);
  const env = process.env;
  const need = (m: string): string => {
    if (!m) throw new ProviderError(`provider spec "${spec}" needs a model, e.g. ${kind}:<model>`, false);
    return m;
  };
  switch (kind) {
    case 'anthropic':
      return new AnthropicProvider(model || 'claude-haiku-4-5', env.ANTHROPIC_API_KEY ?? '', {
        baseUrl: env.BUYER_ARENA_ANTHROPIC_BASE_URL,
        pricing,
      });
    case 'openai':
      if (!env.OPENAI_API_KEY) throw new ProviderError('OPENAI_API_KEY is not set', false);
      return new OpenAICompatibleProvider(
        'openai',
        model || 'gpt-4o-mini',
        'https://api.openai.com/v1',
        env.OPENAI_API_KEY,
        {
          pricing,
        },
      );
    case 'openai-compatible': {
      const base = env.OPENAI_BASE_URL;
      if (!base) throw new ProviderError('OPENAI_BASE_URL is not set', false);
      return new OpenAICompatibleProvider('openai-compatible', need(model), base, env.OPENAI_API_KEY, {
        local: isLocalEndpoint(base),
        pricing,
      });
    }
    case 'openrouter':
      return new OpenRouterProvider(need(model), env.OPENROUTER_API_KEY, {
        baseUrl: env.BUYER_ARENA_OPENROUTER_BASE_URL,
        pricing,
      });
    case 'opencode':
      return new OpenCodeProvider(need(model), { pricing });
    case 'lmstudio':
      return new OpenAICompatibleProvider(
        'lmstudio',
        need(model),
        env.LMSTUDIO_BASE_URL ?? 'http://localhost:1234/v1',
        undefined,
        {
          local: true,
          pricing,
        },
      );
    case 'ollama':
      return new OpenAICompatibleProvider(
        'ollama',
        need(model),
        env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
        undefined,
        {
          local: true,
          pricing,
        },
      );
    default:
      throw new ProviderError(
        `unknown provider "${kind}". Known: anthropic, openai, openai-compatible, openrouter, opencode, lmstudio, ollama`,
        false,
      );
  }
}

/** Which providers look configured, without making any network call. */
export function detectProviders(): { id: string; configured: boolean; note: string }[] {
  const env = process.env;
  return [
    { id: 'heuristic', configured: true, note: 'deterministic buyers + auditors (default, free, offline)' },
    { id: 'anthropic', configured: Boolean(env.ANTHROPIC_API_KEY), note: 'needs ANTHROPIC_API_KEY' },
    { id: 'openai', configured: Boolean(env.OPENAI_API_KEY), note: 'needs OPENAI_API_KEY' },
    {
      id: 'openai-compatible',
      configured: Boolean(env.OPENAI_BASE_URL),
      note: 'needs OPENAI_BASE_URL (vLLM, llama.cpp server, LocalAI, gateways)',
    },
    { id: 'openrouter', configured: Boolean(env.OPENROUTER_API_KEY), note: 'needs OPENROUTER_API_KEY' },
    {
      id: 'opencode',
      configured: false,
      note: 'optional adapter: needs the opencode CLI (see `integrations list`)',
    },
    {
      id: 'lmstudio',
      configured: true,
      note: `local ${env.LMSTUDIO_BASE_URL ?? 'http://localhost:1234/v1'} (not probed)`,
    },
    {
      id: 'ollama',
      configured: true,
      note: `local ${env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1'} (not probed)`,
    },
  ];
}
