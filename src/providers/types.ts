export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature?: number;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
}

export interface ChatResponse {
  text: string;
  usage: TokenUsage;
  latency_ms: number;
  model: string;
}

/** USD per million tokens. */
export interface ModelPricing {
  input: number;
  output: number;
  cached_input?: number;
}

export interface ChatProvider {
  readonly name: string;
  readonly model: string;
  readonly pricing: ModelPricing;
  /** True when calls cost real money (used by the offline guard). */
  readonly paid: boolean;
  complete(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse>;
}
