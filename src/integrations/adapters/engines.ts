import type { EvidenceEnvelopeV1 } from '../../evidence/envelope.js';
import { chromiumExecutable } from '../../core/browser.js';
import { OPENCODE_MIN_VERSION } from '../../providers/opencode.js';
import { compareVersions, findExecutable, runTool } from '../exec.js';
import { detectOnPath, type Integration } from '../sdk.js';

/**
 * Browser engines and model gateways. Their output is not imported as findings: journeys
 * produced by any engine become the same Buyer Arena run records (src/engines/external.ts),
 * so evidence looks identical whichever engine produced it.
 */
const noNormalize = (): EvidenceEnvelopeV1[] => [];

export const playwright: Integration = {
  manifest: {
    id: 'playwright',
    name: 'Playwright',
    version: '1.0.0',
    status: 'builtin',
    modes: ['native'],
    capabilities: ['browser-engine'],
    offline_safe: true,
    network_required: false,
    execution_risk: 'low',
    upstream: {
      url: 'https://github.com/microsoft/playwright',
      license: 'Apache-2.0',
      method: 'npm dependency (built-in engine)',
    },
  },
  async detect() {
    const c = chromiumExecutable();
    return {
      installed: c.exists,
      path: c.path || undefined,
      version: null,
      note: c.exists
        ? `Chromium (${c.source})`
        : 'run `npx playwright install chromium` or set BUYER_ARENA_CHROMIUM_PATH',
    };
  },
  normalize: noNormalize,
};

async function pythonModuleVersion(
  module: string,
): Promise<{ installed: boolean; version: string | null; path?: string }> {
  const py = findExecutable(['python3', 'python']);
  if (!py) return { installed: false, version: null };
  // Reads package metadata only (importlib.metadata); does not import the package.
  const r = await runTool(
    py,
    ['-c', `import importlib.metadata as m; print(m.version(${JSON.stringify(module)}))`],
    { timeoutMs: 10_000 },
  );
  const v = r.code === 0 ? r.stdout.trim() : '';
  return v ? { installed: true, version: v, path: py } : { installed: false, version: null };
}

export const browserUse: Integration = {
  manifest: {
    id: 'browser-use',
    name: 'Browser Use',
    version: '1.0.0',
    status: 'adapter',
    modes: ['sidecar'],
    capabilities: ['browser-engine'],
    offline_safe: false,
    network_required: true,
    execution_risk: 'medium',
    upstream: {
      url: 'https://github.com/browser-use/browser-use',
      license: 'MIT',
      method: 'reference sidecar over the external-engine stdin/stdout contract',
    },
    notes:
      'Reference sidecar: examples/sidecars/browser_use_sidecar.py (restricts allowed_domains to the start origin, telemetry off). Needs Python ≥ 3.11, `pip install browser-use`, and a model it can call (Ollama works offline).',
  },
  async detect() {
    const v = await pythonModuleVersion('browser-use');
    return { ...v, note: v.installed ? 'python package found' : 'pip install browser-use (Python ≥ 3.11)' };
  },
  normalize: noNormalize,
};

export const stagehand: Integration = {
  manifest: {
    id: 'stagehand',
    name: 'Stagehand',
    version: '1.0.0',
    status: 'experimental',
    modes: ['sidecar'],
    capabilities: ['browser-engine'],
    offline_safe: false,
    network_required: true,
    execution_risk: 'medium',
    upstream: {
      url: 'https://github.com/browserbase/stagehand',
      license: 'MIT',
      method: 'reference sidecar (Stagehand v4 API, local browser only)',
    },
    notes:
      'Reference sidecar: examples/sidecars/stagehand-sidecar.mjs (v4: localBrowser.launch + Stagehand.create; never a Browserbase browser). Needs `npm i @browserbasehq/stagehand@4` (Node ≥ 22.18) and a model API key.',
  },
  async detect() {
    return {
      installed: false,
      version: null,
      note: 'sidecar: install @browserbasehq/stagehand@4 next to the sidecar script',
    };
  },
  normalize: noNormalize,
};

export const opencodeIntegration: Integration = {
  manifest: {
    id: 'opencode',
    name: 'OpenCode',
    version: '1.0.0',
    status: 'adapter',
    modes: ['native'],
    capabilities: ['model-gateway', 'coding-agent'],
    offline_safe: false,
    network_required: true,
    execution_risk: 'medium',
    upstream: {
      url: 'https://github.com/anomalyco/opencode',
      license: 'MIT',
      method: '`opencode run --format json` as a model provider (`--buyer opencode:<provider>/<model>`)',
    },
    executables: ['opencode'],
    notes: `Needs opencode ≥ ${OPENCODE_MIN_VERSION}. OpenCode manages its own providers; Buyer Arena never reads its credential store. Local models (ollama/…) work under OFFLINE.`,
  },
  async detect() {
    const d = await detectOnPath(['opencode']);
    if (d.installed && d.version && compareVersions(d.version, OPENCODE_MIN_VERSION) < 0)
      return {
        ...d,
        note: `version ${d.version} is below the safe minimum ${OPENCODE_MIN_VERSION}: refused`,
      };
    return d;
  },
  normalize: noNormalize,
};
