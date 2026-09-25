import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { BudgetExceededError } from '../core/errors.js';
import { ensureDir, readJson, writeJson } from '../core/fs.js';
import { mapPool } from '../core/pool.js';
import { RunRecordSchema, type Population, type RunRecord, type Task, type Usage } from '../core/types.js';
import { CostMeter } from '../providers/metered.js';
import { createProvider } from '../providers/index.js';
import type { ChatProvider } from '../providers/types.js';
import { assertNoLeak, buildBrief, buildStory } from '../stories/story.js';
import { HeuristicBuyer, stepBudget } from './heuristic.js';
import { runExternalJourney } from '../engines/external.js';
import { runJourney, type TraceMode } from './journey.js';
import { LlmBuyer } from './llm-policy.js';
import type { BuyerPolicy } from './policy.js';

export interface Variant {
  name: string;
  url: string;
}

export interface SessionOptions {
  root?: string;
  sessionId?: string;
  population: Population;
  task: Task;
  variants: Variant[];
  /** 'heuristic' (default, free) or a provider spec like 'anthropic:claude-haiku-4-5'. */
  buyer?: string;
  /** Pre-built provider (tests / programmatic use). Overrides `buyer` spec parsing. */
  provider?: ChatProvider;
  maxBuyers?: number;
  maxParallel?: number;
  maxSteps?: number;
  timeoutMs?: number;
  budgetUsd?: number;
  trace?: TraceMode;
  screenshots?: boolean;
  headed?: boolean;
  /**
   * Delegate each journey to an external engine command (Browser Use, Browser Harness…)
   * instead of the built-in Playwright runner. See src/engines/external.ts for the contract.
   */
  engineCommand?: string;
  /** Network emulation for every journey in this session (segment runs). */
  network?: 'slow3g';
  /** Allow resuming with different variant URLs (e.g. demo stores on new ephemeral ports). */
  allowTargetChange?: boolean;
  /** Extra terms that must never reach a buyer (hypotheses, change descriptions…). */
  forbiddenTerms?: string[];
  signal?: AbortSignal;
  onRun?: (run: RunRecord, progress: { done: number; total: number; skipped: boolean }) => void;
}

export interface SessionManifest {
  session_id: string;
  created_at: string;
  updated_at: string;
  template: string;
  seed: number;
  population_size: number;
  task: Task;
  variants: Variant[];
  buyer: string;
  limits: {
    maxBuyers: number;
    maxParallel: number;
    maxSteps?: number;
    timeoutMs: number;
    budgetUsd?: number;
  };
  status: 'running' | 'complete' | 'interrupted' | 'budget_exhausted' | 'failed';
  /** Hash of task, population, variants and buyer. A resume must match it. */
  fingerprint?: string;
  /** Options needed to resume faithfully. */
  options?: { engineCommand?: string; forbiddenTerms?: string[]; trace?: TraceMode; screenshots?: boolean };
  runs_total: number;
  runs_done: number;
  usage: Usage[];
}

export interface SessionResult {
  dir: string;
  manifest: SessionManifest;
  runs: RunRecord[];
  executed: number;
  skipped: number;
}

export const DEFAULT_ROOT = '.buyer-arena';

export function sessionsDir(root = DEFAULT_ROOT): string {
  return resolve(root, 'sessions');
}

export function newSessionId(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  // Random suffix: two sessions started in the same second must never share a directory.
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${randomBytes(2).toString('hex')}`;
}

function fingerprintOf(o: SessionOptions, buyer: string, withUrls: boolean): string {
  const payload = JSON.stringify({
    task: o.task,
    template: o.population.template,
    seed: o.population.seed,
    personas: o.population.personas.map((x) => x.persona_id),
    variants: o.variants.map((v) => (withUrls ? `${v.name}=${v.url}` : v.name)),
    buyer,
    engine: o.engineCommand ?? null,
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

export function runDir(sessionDir: string, variant: string, personaId: string): string {
  return join(sessionDir, 'runs', variant, personaId);
}

export function loadRuns(sessionDir: string): RunRecord[] {
  const base = join(sessionDir, 'runs');
  if (!existsSync(base)) return [];
  const out: RunRecord[] = [];
  for (const variant of readdirSync(base)) {
    for (const persona of readdirSync(join(base, variant))) {
      const f = join(base, variant, persona, 'run.json');
      const rec = existsSync(f) ? readRun(f) : undefined;
      if (rec) out.push(rec);
    }
  }
  return out.sort((a, b) => a.variant.localeCompare(b.variant) || a.persona_id.localeCompare(b.persona_id));
}

/** Tolerant reader: an unreadable or invalid record counts as "not done" instead of crashing. */
function readRun(f: string): RunRecord | undefined {
  try {
    const r = RunRecordSchema.safeParse(readJson(f));
    return r.success ? r.data : undefined;
  } catch {
    return undefined;
  }
}

/** A run counts as done (and is skipped on resume) only if it reached a terminal, non-error state. */
const isFinal = (r: RunRecord) => r.status !== 'error' && r.status !== 'budget_exhausted';

/**
 * Run every (variant × persona) journey with bounded concurrency. Completed journeys are
 * persisted atomically; calling again with the same sessionId resumes where it stopped.
 */
export async function runSession(o: SessionOptions): Promise<SessionResult> {
  const sessionId = o.sessionId ?? newSessionId();
  const dir = join(sessionsDir(o.root), sessionId);
  ensureDir(dir);
  const maxBuyers = Math.min(o.maxBuyers ?? o.population.personas.length, o.population.personas.length);
  const personas = o.population.personas.slice(0, maxBuyers);
  const isLlm =
    Boolean(o.provider) || (o.buyer !== undefined && o.buyer !== 'heuristic' && o.buyer !== 'mock');
  const maxParallel = Math.max(1, o.maxParallel ?? (isLlm ? 2 : 4));
  const timeoutMs = o.timeoutMs ?? (isLlm ? 180_000 : 60_000);
  const provider = isLlm ? (o.provider ?? createProvider(o.buyer as string)) : undefined;
  const buyerName = provider ? `llm:${provider.name}:${provider.model}` : 'heuristic';

  const manifestPath = join(dir, 'session.json');
  const prior = existsSync(manifestPath) ? readJson<SessionManifest>(manifestPath) : undefined;
  const fingerprint = fingerprintOf(o, buyerName, !o.allowTargetChange);
  const priorFp = prior?.fingerprint;
  if (priorFp && !o.allowTargetChange && priorFp !== fingerprint) {
    throw new Error(
      `session "${sessionId}" was created with a different task, population, targets or buyer; results cannot be mixed. Use a new --session id.`,
    );
  }
  // Prior spend counts against the budget: resuming never grants a fresh budget.
  const priorSpend = (prior?.usage ?? []).reduce((a, u) => a + u.estimated_cost_usd, 0);
  const meter = new CostMeter({ budgetUsd: o.budgetUsd ?? (isLlm ? 1 : undefined) }, priorSpend);
  const manifest: SessionManifest = {
    session_id: sessionId,
    created_at: prior?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
    template: o.population.template,
    seed: o.population.seed,
    population_size: o.population.personas.length,
    task: o.task,
    variants: o.variants,
    buyer: buyerName,
    limits: { maxBuyers, maxParallel, maxSteps: o.maxSteps, timeoutMs, budgetUsd: meter.limits.budgetUsd },
    status: 'running',
    runs_total: personas.length * o.variants.length,
    runs_done: 0,
    usage: prior?.usage ?? [],
    fingerprint,
    options: {
      engineCommand: o.engineCommand,
      forbiddenTerms: o.forbiddenTerms,
      trace: o.trace,
      screenshots: o.screenshots,
    },
  };
  writeJson(manifestPath, manifest);
  writeJson(join(dir, 'population.json'), o.population);

  // Interleave variants per persona so an interrupted session stays balanced.
  const jobs = personas.flatMap((persona) => o.variants.map((variant) => ({ persona, variant })));
  const forbidden = [...o.variants.map((v) => v.name), 'hypothesis', 'variant', ...(o.forbiddenTerms ?? [])];
  // Fail fast, before any browser starts, if a brief would leak experiment information.
  for (const { persona, variant } of jobs) {
    assertNoLeak(
      buildBrief(persona, buildStory(persona, o.population.template), o.task, variant.url),
      forbidden,
    );
  }

  let browserP: Promise<Browser> | undefined;
  const results: RunRecord[] = [];
  let executed = 0;
  let skipped = 0;
  let budgetHit = false;
  const internal = new AbortController();
  if (o.signal?.aborted) internal.abort();
  else o.signal?.addEventListener('abort', () => internal.abort(), { once: true });
  let fatal: unknown;

  try {
    await mapPool(
      jobs,
      maxParallel,
      async ({ persona, variant }) => {
        const outDir = runDir(dir, variant.name, persona.persona_id);
        const existing = join(outDir, 'run.json');
        const prev = existsSync(existing) ? readRun(existing) : undefined;
        if (prev && isFinal(prev)) {
          results.push(prev);
          skipped++;
          o.onRun?.(prev, { done: results.length, total: jobs.length, skipped: true });
          return;
        }
        if (budgetHit || internal.signal.aborted || fatal) return;
        const story = buildStory(persona, o.population.template);
        const brief = buildBrief(persona, story, o.task, variant.url);
        const runId = `${variant.name}-${persona.persona_id}`;
        let policy: BuyerPolicy = new HeuristicBuyer();
        let runUsage: Usage | undefined;
        if (provider) {
          policy = new LlmBuyer({
            provider,
            meter,
            signal: internal.signal,
            onUsage: (res) => {
              runUsage = addUsage(runUsage, new CostMeter().record(provider, res));
            },
          });
        }
        const common = {
          brief,
          task: o.task,
          runId,
          sessionId,
          variant: variant.name,
          segment: persona.segment,
          archetype: persona.archetype,
          maxSteps: Math.min(o.maxSteps ?? Infinity, stepBudget(brief)),
          timeoutMs,
        };
        if (o.engineCommand) {
          const run = await runExternalJourney({ ...common, command: o.engineCommand });
          writeJson(existing, run);
          writeJson(join(outDir, 'story.json'), story);
          results.push(run);
          executed++;
          o.onRun?.(run, { done: results.length, total: jobs.length, skipped: false });
          return;
        }
        let browser: Browser;
        try {
          browserP ??= chromium.launch({ headless: !o.headed });
          browser = await browserP;
        } catch (err) {
          // A browser that cannot start is fatal for the whole session, not for one buyer.
          fatal ??= err;
          internal.abort();
          return;
        }
        const run = await safeJourney(common, () =>
          runJourney({
            browser,
            brief,
            task: o.task,
            policy,
            runId,
            sessionId,
            variant: variant.name,
            segment: persona.segment,
            archetype: persona.archetype,
            outDir,
            maxSteps: Math.min(o.maxSteps ?? Infinity, stepBudget(brief)),
            timeoutMs,
            trace: o.trace ?? 'failed',
            screenshots: o.screenshots ?? true,
            usage: () => runUsage,
            signal: internal.signal,
            network: o.network,
          }),
        );
        if (run.status === 'budget_exhausted') budgetHit = true;
        if (internal.signal.aborted && run.status === 'error') return; // interrupted mid-run: leave unrecorded
        writeJson(existing, run);
        writeJson(join(outDir, 'story.json'), story);
        results.push(run);
        executed++;
        manifest.runs_done = results.length;
        o.onRun?.(run, { done: results.length, total: jobs.length, skipped: false });
      },
      internal.signal,
    );
  } catch (err) {
    if (err instanceof BudgetExceededError) budgetHit = true;
    else fatal ??= err;
  } finally {
    // mapPool resolves only after every worker returned, so no journey still uses the browser.
    if (browserP) await (await browserP.catch(() => undefined))?.close().catch(() => undefined);
    const done = results.filter(isFinal).length;
    manifest.runs_done = done;
    manifest.updated_at = new Date().toISOString();
    manifest.usage = mergeUsage(prior?.usage ?? [], meter.summary());
    manifest.status = fatal
      ? 'failed'
      : budgetHit
        ? 'budget_exhausted'
        : done >= jobs.length
          ? 'complete'
          : 'interrupted';
    writeJson(manifestPath, manifest);
  }
  if (fatal) throw fatal;
  return {
    dir,
    manifest,
    runs: loadRuns(dir).filter((r) =>
      jobs.some((j) => j.variant.name === r.variant && j.persona.persona_id === r.persona_id),
    ),
    executed,
    skipped,
  };
}

/** Convert an unexpected exception inside one journey into an `error` record (retried on resume). */
async function safeJourney(
  c: {
    brief: { persona: { persona_id: string }; start_url: string };
    runId: string;
    sessionId: string;
    variant: string;
    segment: string;
    archetype: string;
  },
  fn: () => Promise<RunRecord>,
): Promise<RunRecord> {
  try {
    return await fn();
  } catch (err) {
    const now = new Date().toISOString();
    return {
      run_id: c.runId,
      session_id: c.sessionId,
      variant: c.variant,
      persona_id: c.brief.persona.persona_id,
      segment: c.segment,
      archetype: c.archetype,
      policy: 'unknown',
      status: 'error',
      goal_completed: false,
      steps: 0,
      elapsed_ms: 0,
      started_at: now,
      final_url: c.brief.start_url,
      url_history: [],
      milestones: {},
      events: [
        {
          id: `${c.runId}:e0`,
          seq: 0,
          step: 0,
          t: 0,
          type: 'error',
          url: c.brief.start_url,
          detail: String(err instanceof Error ? err.message : err).slice(0, 400),
        },
      ],
    };
  }
}

export function addUsage(p: Usage | undefined, u: Usage): Usage {
  if (!p) return { ...u };
  return {
    ...p,
    calls: p.calls + u.calls,
    input_tokens: p.input_tokens + u.input_tokens,
    output_tokens: p.output_tokens + u.output_tokens,
    cached_tokens: p.cached_tokens + u.cached_tokens,
    latency_ms: p.latency_ms + u.latency_ms,
    estimated_cost_usd: p.estimated_cost_usd + u.estimated_cost_usd,
  };
}

function mergeUsage(a: Usage[], b: Usage[]): Usage[] {
  const map = new Map<string, Usage>();
  for (const u of [...a, ...b])
    map.set(`${u.provider}:${u.model}`, addUsage(map.get(`${u.provider}:${u.model}`), u));
  return [...map.values()];
}

export function loadManifest(dir: string): SessionManifest {
  return readJson<SessionManifest>(join(dir, 'session.json'));
}
