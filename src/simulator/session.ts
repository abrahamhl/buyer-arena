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
  status: 'running' | 'complete' | 'interrupted' | 'budget_exhausted';
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
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
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
      if (existsSync(f)) out.push(RunRecordSchema.parse(readJson(f)));
    }
  }
  return out.sort((a, b) => a.variant.localeCompare(b.variant) || a.persona_id.localeCompare(b.persona_id));
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
  const meter = new CostMeter({ budgetUsd: o.budgetUsd ?? (isLlm ? 1 : undefined) });
  const provider = isLlm ? (o.provider ?? createProvider(o.buyer as string)) : undefined;
  const buyerName = provider ? `llm:${provider.name}:${provider.model}` : 'heuristic';

  const manifestPath = join(dir, 'session.json');
  const prior = existsSync(manifestPath) ? readJson<SessionManifest>(manifestPath) : undefined;
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
  };
  writeJson(manifestPath, manifest);
  writeJson(join(dir, 'population.json'), o.population);

  // Interleave variants per persona so an interrupted session stays balanced.
  const jobs = personas.flatMap((persona) => o.variants.map((variant) => ({ persona, variant })));
  const forbidden = [...o.variants.map((v) => v.name), 'hypothesis', 'variant', ...(o.forbiddenTerms ?? [])];

  let browserP: Promise<Browser> | undefined;
  const results: RunRecord[] = [];
  let executed = 0;
  let skipped = 0;
  let budgetHit = false;
  const internal = new AbortController();
  o.signal?.addEventListener('abort', () => internal.abort(), { once: true });

  try {
    await mapPool(
      jobs,
      maxParallel,
      async ({ persona, variant }) => {
        const outDir = runDir(dir, variant.name, persona.persona_id);
        const existing = join(outDir, 'run.json');
        if (existsSync(existing)) {
          const prev = RunRecordSchema.parse(readJson(existing));
          if (isFinal(prev)) {
            results.push(prev);
            skipped++;
            o.onRun?.(prev, { done: results.length, total: jobs.length, skipped: true });
            return;
          }
        }
        if (budgetHit || internal.signal.aborted) return;
        browserP ??= chromium.launch({ headless: !o.headed });
        const browser = await browserP;
        const story = buildStory(persona, o.population.template);
        const brief = buildBrief(persona, story, o.task, variant.url);
        assertNoLeak(brief, forbidden);
        const runId = `${variant.name}-${persona.persona_id}`;
        let policy: BuyerPolicy = new HeuristicBuyer();
        let runUsage: Usage | undefined;
        if (provider) {
          policy = new LlmBuyer({
            provider,
            meter,
            onUsage: (res) => {
              runUsage = addUsage(runUsage, new CostMeter().record(provider, res));
            },
          });
        }
        const run = await runJourney({
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
        });
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
    if (!(err instanceof BudgetExceededError)) throw err;
    budgetHit = true;
  } finally {
    if (browserP) await (await browserP.catch(() => undefined))?.close().catch(() => undefined);
  }

  const done = results.filter(isFinal).length;
  manifest.runs_done = done;
  manifest.updated_at = new Date().toISOString();
  manifest.usage = mergeUsage(prior?.usage ?? [], meter.summary());
  manifest.status = budgetHit ? 'budget_exhausted' : done >= jobs.length ? 'complete' : 'interrupted';
  writeJson(manifestPath, manifest);
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
