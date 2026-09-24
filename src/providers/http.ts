import { ProviderError } from '../core/errors.js';

/** Remove anything that looks like a credential before it can reach logs or telemetry. */
export function redact(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***')
    .replace(/(x-api-key|authorization|api[_-]?key)(["':=\s]+)(Bearer\s+)?[^\s"',}]+/gi, '$1$2$3***');
}

export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
  timeoutMs = 60_000,
): Promise<unknown> {
  const host = new URL(url).host;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  signal?.addEventListener('abort', () => ctrl.abort(), { once: true });
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (err) {
    throw new ProviderError(`network error calling ${host}: ${redact(String(err))}`, true);
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  if (!res.ok) {
    const retryable = res.status === 429 || res.status >= 500;
    throw new ProviderError(`HTTP ${res.status} from ${host}: ${redact(text.slice(0, 300))}`, retryable, res.status);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError(`non-JSON response from ${host}`, false);
  }
}
