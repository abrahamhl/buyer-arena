import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ProviderError } from '../../src/core/errors.js';
import { AnthropicProvider } from '../../src/providers/anthropic.js';
import { OpenAICompatibleProvider } from '../../src/providers/openai-compatible.js';

/** A local fake of both APIs: verifies request shape and returns canned responses. No network, no spend. */
let server: Server;
let base = '';
const seen: { path: string; headers: IncomingMessage['headers']; body: Record<string, unknown> }[] = [];
let mode: 'ok' | '429' | '401' = 'ok';

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (d) => (raw += d));
    req.on('end', () => {
      seen.push({ path: req.url ?? '', headers: req.headers, body: JSON.parse(raw) });
      if (mode !== 'ok')
        return res.writeHead(Number(mode)).end('{"error":"x-api-key: sk-ant-SECRETSECRETSECRET"}');
      res.writeHead(200, { 'content-type': 'application/json' });
      if (req.url?.includes('/v1/messages')) {
        res.end(
          JSON.stringify({
            model: 'claude-test',
            content: [{ type: 'text', text: '{"action":"scroll","reason":"r"}' }],
            usage: { input_tokens: 120, output_tokens: 15, cache_read_input_tokens: 100 },
          }),
        );
      } else {
        res.end(
          JSON.stringify({
            model: 'local-test',
            choices: [{ message: { content: 'hi' } }],
            usage: { prompt_tokens: 50, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 10 } },
          }),
        );
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const req = { system: 'S', messages: [{ role: 'user' as const, content: 'U' }], maxTokens: 64 };

describe('HTTP provider adapters (against a local fake endpoint)', () => {
  it('Anthropic: sends key header + version, parses text and usage incl. cache reads', async () => {
    mode = 'ok';
    const p = new AnthropicProvider('claude-haiku-4-5', 'test-key', { baseUrl: base });
    const res = await p.complete(req);
    const last = seen.at(-1)!;
    expect(last.path).toBe('/v1/messages');
    expect(last.headers['x-api-key']).toBe('test-key');
    expect(last.headers['anthropic-version']).toBe('2023-06-01');
    expect(last.body).toMatchObject({ model: 'claude-haiku-4-5', system: 'S', max_tokens: 64 });
    expect(res.text).toContain('scroll');
    expect(res.usage).toEqual({ input_tokens: 120, output_tokens: 15, cached_tokens: 100 });
  });

  it('OpenAI-compatible (LM Studio / Ollama / vLLM): system message first, usage parsed, no auth header when keyless', async () => {
    mode = 'ok';
    const p = new OpenAICompatibleProvider('lmstudio', 'qwen', base, undefined, { local: true });
    const res = await p.complete(req);
    const last = seen.at(-1)!;
    expect(last.path).toBe('/chat/completions');
    expect(last.headers.authorization).toBeUndefined();
    expect((last.body.messages as { role: string }[])[0]!.role).toBe('system');
    expect(res.usage).toEqual({ input_tokens: 50, output_tokens: 5, cached_tokens: 10 });
    expect(p.paid).toBe(false);
    expect(p.pricing.input).toBe(0);
  });

  it('classifies 429 as retryable, 401 as fatal, and redacts secrets from error text', async () => {
    const p = new AnthropicProvider('claude-haiku-4-5', 'k', { baseUrl: base });
    mode = '429';
    const e429 = await p.complete(req).catch((e: unknown) => e);
    expect(e429).toBeInstanceOf(ProviderError);
    expect((e429 as ProviderError).retryable).toBe(true);
    mode = '401';
    const e401 = (await p.complete(req).catch((e: unknown) => e)) as ProviderError;
    expect(e401.retryable).toBe(false);
    expect(e401.message).not.toContain('SECRETSECRET');
    mode = 'ok';
  });
});
