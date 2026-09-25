import { postJson } from './http.js';
import { FREE_PRICING, lookupPricing } from './pricing.js';
import type { ChatProvider, ChatRequest, ChatResponse, ModelPricing } from './types.js';

interface OpenAIResponse {
  model?: string;
  choices?: { message?: { content?: string } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
}

/** Works with OpenAI, LM Studio, Ollama (/v1), vLLM, llama.cpp server and other compatible endpoints. */
export class OpenAICompatibleProvider implements ChatProvider {
  readonly pricing: ModelPricing;
  readonly paid: boolean;

  constructor(
    readonly name: string,
    readonly model: string,
    readonly baseUrl: string,
    private readonly apiKey?: string,
    opts: { local?: boolean; pricing?: ModelPricing } = {},
  ) {
    this.paid = !opts.local;
    this.pricing = opts.pricing ?? (opts.local ? FREE_PRICING : lookupPricing(model));
  }

  async complete(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    const started = Date.now();
    const headers: Record<string, string> = {};
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
    const json = (await postJson(
      `${this.baseUrl.replace(/\/$/, '')}/chat/completions`,
      headers,
      {
        model: this.model,
        max_tokens: req.maxTokens,
        temperature: req.temperature ?? 0,
        messages: [{ role: 'system', content: req.system }, ...req.messages],
      },
      signal,
      this.paid ? 60_000 : 180_000,
      { provider: this.name, model: this.model },
    )) as OpenAIResponse;
    return {
      text: json.choices?.[0]?.message?.content ?? '',
      model: json.model ?? this.model,
      latency_ms: Date.now() - started,
      usage: {
        input_tokens: json.usage?.prompt_tokens ?? 0,
        output_tokens: json.usage?.completion_tokens ?? 0,
        cached_tokens: json.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      },
    };
  }
}
