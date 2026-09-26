import { createHash } from 'node:crypto';

/** Remove anything that looks like a credential before it can reach logs, reports or evidence. */
export function redact(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***')
    .replace(/\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, 'gh*_***')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, 'AKIA***')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, 'xox*-***')
    .replace(
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
      '[PRIVATE KEY ***]',
    )
    .replace(
      /(x-api-key|authorization|api[_-]?key|token|secret|password)(["':=\s]+)(Bearer\s+)?[^\s"',}]+/gi,
      '$1$2$3***',
    );
}

/**
 * A short, salted-free fingerprint of a secret so two findings of the same secret can be
 * correlated WITHOUT storing it. 12 hex chars of SHA-256: enough to deduplicate, too short
 * to serve as a verification oracle for high-entropy secrets.
 */
export function secretFingerprint(value: string): string {
  return `fp:${createHash('sha256').update(value).digest('hex').slice(0, 12)}`;
}

/** Drop keys that hold secret material from an upstream record before it is hashed or kept. */
export function withoutSecretFields<T extends Record<string, unknown>>(rec: T, keys: string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  const deny = new Set(keys.map((k) => k.toLowerCase()));
  for (const [k, v] of Object.entries(rec)) if (!deny.has(k.toLowerCase())) out[k] = v;
  return out as Partial<T>;
}
