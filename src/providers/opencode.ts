import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProviderError } from '../core/errors.js';
import { compareVersions, findExecutable, probeVersion, runTool, scrubbedEnv } from '../integrations/exec.js';
import { currentLedger } from '../policy/network.js';
import { PESSIMISTIC_PRICING } from './pricing.js';
import type { ChatProvider, ChatRequest, ChatResponse, ModelPricing } from './types.js';

/**
 * OpenCode as an OPTIONAL model gateway (https://github.com/anomalyco/opencode, MIT).
 *
 * Contract (verified 2026-09-25, docs/research/UPSTREAM_CONTRACTS.md §H):
 *   opencode run --format json --model <provider>/<model> --dir <dir> "<message>"
 * emits JSON lines: step_start · text · tool_use · step_finish (tokens, cost) · error.
 *
 * Guarantees:
 *   - Buyer Arena never reads OpenCode's credential store (~/.local/share/opencode/auth.json);
 *     OpenCode manages its own providers.
 *   - Never passes --auto / --yolo / --dangerously-skip-permissions. In `run`, permission
 *     requests are auto-rejected by OpenCode itself.
 *   - Runs in an empty temporary --dir, so the agent has no project files to act on.
 *   - Refuses OpenCode < 1.18.22 (GHSA-632h-h47v-g4x4, CSRF → arbitrary npm install).
 */
export const OPENCODE_MIN_VERSION = '1.18.22';
const LOCAL_PREFIXES = ['ollama/', 'lmstudio/', 'llama.cpp/', 'local/'];

interface OpenCodeEvent {
  type?: string;
  part?: {
    type?: string;
    text?: string;
    cost?: number;
    tokens?: {
      input?: number;
      output?: number;
      reasoning?: number;
      cache?: { read?: number; write?: number };
    };
  };
  error?: unknown;
}

export interface OpenCodeRunInfo {
  version: string | null;
  steps: number;
  tool_calls: number;
  /** Cost as reported by OpenCode's step_finish events (units per upstream: a number; assumed USD). */
  reported_cost: number;
  exit_code: number | null;
  duration_ms: number;
}

/** Parse `opencode run --format json` output. Exported for fixture tests. */
export function parseOpenCodeEvents(stdout: string): {
  text: string;
  input: number;
  output: number;
  cached: number;
  cost: number;
  steps: number;
  tools: number;
  errors: string[];
} {
  let text = '';
  let input = 0;
  let output = 0;
  let cached = 0;
  let cost = 0;
  let steps = 0;
  let tools = 0;
  const errors: string[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim().startsWith('{')) continue;
    let ev: OpenCodeEvent;
    try {
      ev = JSON.parse(line) as OpenCodeEvent;
    } catch {
      continue;
    }
    if (ev.type === 'text' && typeof ev.part?.text === 'string') text += ev.part.text;
    else if (ev.type === 'tool_use') tools++;
    else if (ev.type === 'step_finish') {
      steps++;
      const t = ev.part?.tokens;
      input += t?.input ?? 0;
      output += (t?.output ?? 0) + (t?.reasoning ?? 0);
      cached += t?.cache?.read ?? 0;
      cost += typeof ev.part?.cost === 'number' ? ev.part.cost : 0;
    } else if (ev.type === 'error')
      errors.push(typeof ev.error === 'string' ? ev.error : JSON.stringify(ev.error).slice(0, 300));
  }
  return { text, input, output, cached, cost, steps, tools, errors };
}

export class OpenCodeProvider implements ChatProvider {
  readonly name = 'opencode';
  readonly pricing: ModelPricing;
  readonly paid: boolean;
  readonly local: boolean;
  lastRun?: OpenCodeRunInfo;
  private version: string | null | undefined;

  constructor(
    /** OpenCode model id: `<provider>/<model>`, e.g. `anthropic/claude-haiku-4-5` or `ollama/llama3.1`. */
    readonly model: string,
    private readonly o: { pricing?: ModelPricing; executable?: string; timeoutMs?: number } = {},
  ) {
    if (!/^[\w.-]+\/[\w.:/-]+$/.test(model))
      throw new ProviderError(`opencode model must look like provider/model, got "${model}"`, false);
    this.local = LOCAL_PREFIXES.some((p) => model.startsWith(p));
    this.paid = !this.local;
    // OpenCode's price is unknown to us: budget reservation stays pessimistic unless overridden.
    this.pricing = o.pricing ?? (this.local ? { input: 0, output: 0, cached_input: 0 } : PESSIMISTIC_PRICING);
  }

  private async exe(): Promise<string> {
    const path = this.o.executable ?? findExecutable(['opencode']);
    if (!path)
      throw new ProviderError(
        'opencode is not installed (optional adapter; see `buyer-arena integrations list`)',
        false,
      );
    if (this.version === undefined) this.version = await probeVersion(path);
    if (!this.version || compareVersions(this.version, OPENCODE_MIN_VERSION) < 0)
      throw new ProviderError(
        `opencode ${this.version ?? '(unknown version)'} refused: need ≥ ${OPENCODE_MIN_VERSION} (security advisory GHSA-632h-h47v-g4x4)`,
        false,
      );
    return path;
  }

  async complete(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    const ledger = currentLedger();
    if (ledger.effectiveMode === 'offline' && !this.local)
      throw new ProviderError(
        `network policy OFFLINE: opencode model ${this.model} is not a local model`,
        false,
      );
    const path = await this.exe();
    const message = [
      `SYSTEM INSTRUCTIONS:\n${req.system}`,
      ...req.messages.map((m) => `${m.role.toUpperCase()}:\n${m.content}`),
      'Reply with text only. Do not use tools.',
    ].join('\n\n');
    const dir = mkdtempSync(join(tmpdir(), 'ba-opencode-'));
    const started = Date.now();
    try {
      if (signal?.aborted) throw new ProviderError('aborted', false);
      const r = await runTool(
        path,
        ['run', '--format', 'json', '--model', this.model, '--dir', dir, message],
        {
          cwd: dir,
          timeoutMs: this.o.timeoutMs ?? 180_000,
          env: scrubbedEnv([], {
            OPENCODE_DISABLE_AUTOUPDATE: '1',
            OPENCODE_DISABLE_CLAUDE_CODE: '1',
            OPENCODE_DISABLE_LSP_DOWNLOAD: '1',
          }),
        },
      );
      const p = parseOpenCodeEvents(r.stdout);
      this.lastRun = {
        version: this.version ?? null,
        steps: p.steps,
        tool_calls: p.tools,
        reported_cost: p.cost,
        exit_code: r.code,
        duration_ms: Date.now() - started,
      };
      ledger.recordProvider({
        provider: 'opencode',
        model: this.model,
        host: 'opencode (delegated)',
        locality: this.local ? 'local' : 'delegated',
        data: ['prompt'],
      });
      ledger.recordAdapter('opencode', !this.local);
      if (r.timedOut) throw new ProviderError('opencode timed out', true);
      if (r.code !== 0 || p.errors.length)
        throw new ProviderError(
          `opencode exited ${r.code}: ${(p.errors[0] ?? r.stderr).slice(0, 300)}`,
          false,
        );
      return {
        text: p.text,
        model: this.model,
        latency_ms: Date.now() - started,
        usage: { input_tokens: p.input, output_tokens: p.output, cached_tokens: p.cached },
      };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}
