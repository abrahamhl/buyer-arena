import { browserUse, opencodeIntegration, playwright, stagehand } from './adapters/engines.js';
import { garak } from './adapters/garak.js';
import { gitleaks } from './adapters/gitleaks.js';
import { nuclei } from './adapters/nuclei.js';
import { deepeval, inspectAi, lmEval, otel, pyrit } from './adapters/priority-b.js';
import { promptfoo } from './adapters/promptfoo.js';
import { trivy } from './adapters/trivy.js';
import type { DetectResult, Integration, IntegrationManifest } from './sdk.js';

/** Every integration Buyer Arena knows about. Listing them needs no network and no install. */
export const INTEGRATIONS: Integration[] = [
  playwright,
  browserUse,
  stagehand,
  opencodeIntegration,
  promptfoo,
  garak,
  gitleaks,
  trivy,
  nuclei,
  deepeval,
  inspectAi,
  lmEval,
  pyrit,
  otel,
];

export function getIntegration(id: string): Integration {
  const i = INTEGRATIONS.find((x) => x.manifest.id === id);
  if (!i)
    throw new Error(
      `unknown integration "${id}". Known: ${INTEGRATIONS.map((x) => x.manifest.id).join(', ')}`,
    );
  return i;
}

export interface IntegrationRow extends IntegrationManifest {
  detected: DetectResult;
}

/** Manifests + local detection (PATH lookup / `--version`), in parallel, never network. */
export async function listIntegrations(o: { detect?: boolean } = {}): Promise<IntegrationRow[]> {
  return Promise.all(
    INTEGRATIONS.map(async (i) => ({
      ...i.manifest,
      detected:
        o.detect === false
          ? { installed: false, version: null, note: 'not probed' }
          : await i
              .detect()
              .catch((e: unknown) => ({ installed: false, version: null, note: String(e).slice(0, 80) })),
    })),
  );
}
