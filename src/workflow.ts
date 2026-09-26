import { spawn } from 'node:child_process';
import { currentLedger } from './policy/network.js';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { analyzeSession, type Analysis } from './analysis.js';
import { readJson, writeJson } from './core/fs.js';
import { TargetNotAllowedError } from './core/errors.js';
import { TaskSchema, type Population, type Task } from './core/types.js';
import { startDemoStore } from './demo-store/server.js';
import { generatePopulation } from './personas/generate.js';
import { createProvider } from './providers/index.js';
import { writeReports, type ReportPaths } from './reports/index.js';
import {
  DEFAULT_ROOT,
  loadManifest,
  runSession,
  sessionsDir,
  type SessionOptions,
  type SessionResult,
} from './simulator/session.js';

export const DEMO_TASK: Task = TaskSchema.parse({
  id: 'start-trial',
  instruction:
    'You need a tool that solves the problem described in your situation. Find out whether this product fits your budget and, if it does, start using it (a free trial or paid plan both count).',
  success: { text_pattern: "trial is active|you're all set" },
});

/** Only http(s) targets explicitly supplied by the user. Optionally restrict to loopback. */
export function assertTarget(url: string, opts: { localOnly?: boolean } = {}): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new TargetNotAllowedError(`not a valid URL: ${url}`);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:')
    throw new TargetNotAllowedError(`only http(s) targets are allowed: ${url}`);
  if (opts.localOnly && !/^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(u.hostname)) {
    throw new TargetNotAllowedError(
      `remote target ${u.hostname} refused (local-only mode; set BUYER_ARENA_ALLOW_REMOTE=1 to allow)`,
    );
  }
  // Global network policy: a public URL needs ONLINE (or an explicit escalation of the default).
  currentLedger().check(u.toString(), 'browser', { explicit: true });
  return u.toString();
}

export interface PipelineOptions extends Omit<SessionOptions, 'population' | 'task'> {
  population: Population;
  task: Task;
  auditor?: string;
  auditorBudgetUsd?: number;
}

export interface PipelineResult {
  session: SessionResult;
  analysis: Analysis;
  reports: ReportPaths;
}

/** run → analyse → audit → report. The single code path behind run, compare, demo and MCP. */
export async function runPipeline(o: PipelineOptions): Promise<PipelineResult> {
  const session = await runSession(o);
  const analysis = await analyzeSession(session.dir, {
    auditorProvider: o.auditor ? createProvider(o.auditor) : undefined,
    auditorBudgetUsd: o.auditorBudgetUsd,
  });
  const reports = writeReports(session.dir, analysis);
  writeJson(resolve(o.root ?? DEFAULT_ROOT, 'latest.json'), {
    session_id: session.manifest.session_id,
    dir: session.dir,
    report: reports.html,
  });
  return { session, analysis, reports };
}

export interface DemoOptions {
  size?: number;
  seed?: number;
  root?: string;
  sessionId?: string;
  maxParallel?: number;
  trace?: SessionOptions['trace'];
  screenshots?: boolean;
  onRun?: SessionOptions['onRun'];
  signal?: AbortSignal;
}

/** Start both demo variants on loopback, compare them with the same seeded population, write reports. */
export async function runDemo(o: DemoOptions = {}): Promise<PipelineResult> {
  const [baseline, candidate] = await Promise.all([startDemoStore('baseline'), startDemoStore('candidate')]);
  try {
    return await runPipeline({
      root: o.root,
      sessionId: o.sessionId,
      population: generatePopulation({ template: 'saas', size: o.size ?? 20, seed: o.seed ?? 42 }),
      task: DEMO_TASK,
      variants: [
        { name: 'baseline', url: baseline.url },
        { name: 'candidate', url: candidate.url },
      ],
      maxParallel: o.maxParallel,
      // Demo stores use fresh ephemeral ports each time; the product under test is the same.
      allowTargetChange: true,
      trace: o.trace ?? 'failed',
      screenshots: o.screenshots ?? true,
      onRun: o.onRun,
      signal: o.signal,
    });
  } finally {
    await Promise.all([baseline.close(), candidate.close()]);
  }
}

export function listSessions(root = DEFAULT_ROOT): { id: string; dir: string; mtime: number }[] {
  const base = sessionsDir(root);
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .map((id) => ({
      id,
      dir: join(base, id),
      mtime: existsSync(join(base, id, 'session.json'))
        ? statSync(join(base, id, 'session.json')).mtimeMs
        : 0,
    }))
    .filter((s) => s.mtime > 0)
    .sort((a, b) => b.mtime - a.mtime);
}

export function resolveSession(id: string | undefined, root = DEFAULT_ROOT): string {
  if (id) {
    const dir = existsSync(id) && existsSync(join(id, 'session.json')) ? id : join(sessionsDir(root), id);
    if (!existsSync(join(dir, 'session.json'))) throw new Error(`session not found: ${id}`);
    return dir;
  }
  const latest = resolve(root, 'latest.json');
  if (existsSync(latest)) {
    const dir = readJson<{ dir: string }>(latest).dir;
    if (existsSync(join(dir, 'session.json'))) return dir;
  }
  const s = listSessions(root)[0];
  if (!s) throw new Error('no sessions yet — run `buyer-arena demo` or `buyer-arena compare` first');
  return s.dir;
}

/** Resume an interrupted session using its stored manifest and population. */
export async function resumeSession(
  dir: string,
  extra: Partial<PipelineOptions> = {},
): Promise<PipelineResult> {
  const m = loadManifest(dir);
  const population = readJson<Population>(join(dir, 'population.json'));
  return runPipeline({
    root: resolve(dir, '..', '..'),
    sessionId: m.session_id,
    population,
    task: m.task,
    variants: m.variants,
    // Manifest stores "llm:<provider>:<model>"; the spec is "<provider>:<model>".
    buyer: m.buyer.startsWith('llm:') ? m.buyer.slice(4) : 'heuristic',
    maxBuyers: m.limits.maxBuyers,
    maxParallel: m.limits.maxParallel,
    maxSteps: m.limits.maxSteps,
    timeoutMs: m.limits.timeoutMs,
    budgetUsd: m.limits.budgetUsd,
    engineCommand: m.options?.engineCommand,
    forbiddenTerms: m.options?.forbiddenTerms,
    trace: m.options?.trace,
    screenshots: m.options?.screenshots,
    ...extra,
  });
}

export function openInBrowser(path: string): void {
  const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '""', path] : [path];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
}
