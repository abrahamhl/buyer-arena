import { ProviderError } from '../core/errors.js';
import { isDynamicOpenRouterModel } from '../models/catalog.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';
import type { ChatRequest, ChatResponse, ModelPricing } from './types.js';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * OpenRouter (OpenAI-compatible chat completions).
 *
 * Explicit model ids (`openrouter:anthropic/claude-haiku-4.5`) are the default and are what
 * reproducible runs must use. Dynamic routes (`openrouter/auto`, `:free`, `:floor`, `:nitro`)
 * are allowed but labelled DYNAMIC MODEL ROUTE; the model OpenRouter actually used is taken
 * from the response and recorded in usage, so reports show what really answered.
 */
export class OpenRouterProvider extends OpenAICompatibleProvider {
  readonly dynamic: boolean;
  /** Models that actually answered (differs from `model` on dynamic routes). */
  readonly servedModels = new Set<string>();

  constructor(
    model: string,
    apiKey: string | undefined,
    opts: { baseUrl?: string; pricing?: ModelPricing } = {},
  ) {
    if (!apiKey) throw new ProviderError('OPENROUTER_API_KEY is not set', false);
    if (!model)
      throw new ProviderError('openrouter needs a model, e.g. openrouter:anthropic/claude-haiku-4.5', false);
    // OpenRouter's app-attribution headers are optional; none are sent (nothing extra leaves).
    super('openrouter', model, opts.baseUrl ?? OPENROUTER_BASE_URL, apiKey, { pricing: opts.pricing });
    this.dynamic = isDynamicOpenRouterModel(model);
  }

  override async complete(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    const res = await super.complete(req, signal);
    this.servedModels.add(res.model);
    return res;
  }
}
