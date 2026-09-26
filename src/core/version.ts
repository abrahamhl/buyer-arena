import { readFileSync } from 'node:fs';

let cached: string | null | undefined;

/** Buyer Arena's own version (package.json), used as `source_version` in its evidence. */
export function buyerArenaVersion(): string | null {
  if (cached !== undefined) return cached;
  try {
    cached =
      (
        JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
          version?: string;
        }
      ).version ?? null;
  } catch {
    cached = null;
  }
  return cached;
}
