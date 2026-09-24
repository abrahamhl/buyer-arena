import { ProviderError } from '../core/errors.js';
import { postJson } from './http.js';
import { lookupPricing } from './pricing.js';
import type { ChatProvider, ChatRequest, ChatResponse, ModelPricing } from './types.js';

interface AnthropicResponse {
  model?: string;
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number };
}

export class AnthropicProvider implements ChatProvider {
  readonly name = 'anthropic';
  readonly paid = true;
  readonly pricing: ModelPricing;
  private readonly baseUrl: string;

  constructor(
    readonly model: string,
    private readonly apiKey: string,
    opts: { baseUrl?: string; pricing?: ModelPricing } = {},
  ) {
    if (!apiKey) throw new ProviderError('ANTHROPIC_API_KEY is not set', false);
    this.baseUrl = (opts.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '');
    this.pricing = opts.pricing ?? lookupPricing(model);
  }

  async complete(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    const started = Date.now();
    const json = (await postJson(
      `${this.baseUrl}/v1/messages`,
      { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      {
        model: this.model,
        max_tokens: req.maxTokens,
        temperature: req.temperature ?? 0,
        system: req.system,
        messages: req.messages,
      },
      signal,
    )) as AnthropicResponse;
    const text = (json.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
    return {
      text,
      model: json.model ?? this.model,
      latency_ms: Date.now() - started,
      usage: {
        input_tokens: json.usage?.input_tokens ?? 0,
        output_tokens: json.usage?.output_tokens ?? 0,
        cached_tokens: json.usage?.cache_read_input_tokens ?? 0,
      },
    };
  }
}
