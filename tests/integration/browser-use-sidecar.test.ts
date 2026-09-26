import { describe, expect, it } from 'vitest';
import { startDemoStore } from '../../src/demo-store/server.js';
import { generatePopulation } from '../../src/personas/generate.js';
import { runSession } from '../../src/simulator/session.js';
import { tmp } from '../helpers.js';

/**
 * Real Browser Use + real Chromium + the bundled demo store, through the full session
 * pipeline. Opt-in: set BA_TEST_BROWSER_USE_PYTHON to a Python that has
 * `browser-use>=0.13` installed. Uses the sidecar's deterministic "scripted" model, so no
 * LLM or key is needed.
 */
const py = process.env.BA_TEST_BROWSER_USE_PYTHON;

describe.skipIf(!py)('Browser Use reference sidecar (opt-in)', () => {
  it('drives a real browser and returns evidence in the Buyer Arena contract', async () => {
    const store = await startDemoStore('candidate');
    process.env.BA_BU_LLM = 'scripted';
    process.env.BA_BU_NO_SANDBOX = process.env.BA_BU_NO_SANDBOX ?? '1';
    process.env.BUYER_ARENA_ENGINE_OFFLINE_SAFE = '1'; // scripted model: no network
    try {
      const res = await runSession({
        root: tmp(),
        population: generatePopulation({ template: 'saas', size: 1, seed: 7 }),
        task: {
          id: 't',
          instruction: 'Find the pricing page.',
          success: { url_pattern: '/pricing$' },
          checkout_url_pattern: '/checkout',
        },
        variants: [{ name: 'current', url: store.url }],
        engineCommand: `"${py}" examples/sidecars/browser_use_sidecar.py`,
        timeoutMs: 120_000,
      });
      const run = res.runs[0];
      expect(run?.policy).toMatch(/^external:/);
      expect(run?.status).toBe('completed');
      expect(run?.events.some((e) => e.type === 'navigate' && e.url.endsWith('/pricing'))).toBe(true);
    } finally {
      delete process.env.BUYER_ARENA_ENGINE_OFFLINE_SAFE;
      await store.close();
    }
  }, 180_000);
});
