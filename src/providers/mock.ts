import { ProviderError } from '../core/errors.js';
import { estimateTokens } from './pricing.js';
import type { ChatProvider, ChatRequest, ChatResponse, ModelPricing } from './types.js';

export type MockResponder = (req: ChatRequest, callIndex: number) => string | Error;

/**
 * Deterministic in-process provider. Reports token usage like a real provider so
 * budgets, metering and failure handling can be tested with zero spend.
 */
export class MockProvider implements ChatProvider {
  readonly name = 'mock';
  readonly paid = false;
  calls = 0;
  constructor(
    private readonly responder: MockResponder,
    readonly model = 'mock-1',
    readonly pricing: ModelPricing = { input: 1, output: 5 },
  ) {}

  async complete(req: ChatRequest): Promise<ChatResponse> {
    const i = this.calls++;
    const out = this.responder(req, i);
    if (out instanceof Error) throw out instanceof ProviderError ? out : new ProviderError(out.message, false);
    const input = req.system + req.messages.map((m) => m.content).join('\n');
    return {
      text: out,
      model: this.model,
      latency_ms: 1,
      usage: { input_tokens: estimateTokens(input), output_tokens: estimateTokens(out), cached_tokens: 0 },
    };
  }
}
