import { existsSync } from 'node:fs';
import { chromium, type Browser, type LaunchOptions } from 'playwright';

/**
 * The Chromium executable Buyer Arena will use.
 *
 * `BUYER_ARENA_CHROMIUM_PATH` points at an existing Chromium/Chrome binary. It is how
 * air-gapped machines (no `playwright install` download) and containers that ship a
 * different Chromium build run Buyer Arena. Unset → Playwright's own managed browser.
 */
export function chromiumExecutable(): { path: string; source: 'env' | 'playwright'; exists: boolean } {
  const env = process.env.BUYER_ARENA_CHROMIUM_PATH;
  if (env) return { path: env, source: 'env', exists: existsSync(env) };
  let path = '';
  try {
    path = chromium.executablePath();
  } catch {
    /* not installed */
  }
  return { path, source: 'playwright', exists: Boolean(path) && existsSync(path) };
}

/** The single place Buyer Arena starts a browser. */
export function launchChromium(opts: LaunchOptions = {}): Promise<Browser> {
  const env = process.env.BUYER_ARENA_CHROMIUM_PATH;
  return chromium.launch(env ? { ...opts, executablePath: env } : opts);
}
