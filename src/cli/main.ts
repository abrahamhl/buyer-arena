#!/usr/bin/env node
import { existsSync, readFileSync, accessSync, constants } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { Command, Option } from 'commander';
import { chromium } from 'playwright';
import YAML from 'yaml';
import { analyzeSession } from '../analysis.js';
import { loadConfig } from '../config.js';
import { calibrate, calibrationError, CalibrationInputSchema } from '../calibration/calibration.js';
import { readJson, readStructured, writeFileAtomic } from '../core/fs.js';
import { c, log } from '../core/log.js';
import { TaskSchema, type Population, type RunRecord, type Task } from '../core/types.js';
import { startDemoStore, type DemoVariant } from '../demo-store/server.js';
import { generatePopulation, loadPopulation, savePopulation } from '../personas/generate.js';
import { TEMPLATES } from '../personas/templates.js';
import { createProvider, detectProviders } from '../providers/index.js';
import { writeReports } from '../reports/index.js';
import { terminalSummary } from '../reports/terminal.js';
import { buildStory } from '../stories/story.js';
import { DEFAULT_ROOT, loadManifest, loadRuns, type SessionOptions } from '../simulator/session.js';
import {
  assertTarget,
  DEMO_TASK,
  listSessions,
  openInBrowser,
  resolveSession,
  resumeSession,
  runDemo,
  runPipeline,
  type PipelineResult,
} from '../workflow.js';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  version: string;
};
const program = new Command();
program
  .name('buyer-arena')
  .description('Test your product with synthetic buyers before real customers find the problems.')
  .version(pkg.version);

/* ───────────── shared options ───────────── */

interface RunFlags {
  population?: string;
  template: string;
  size: string;
  seed: string;
  task?: string;
  successText?: string;
  successUrl?: string;
  instruction?: string;
  buyer: string;
  auditor?: string;
  engineCmd?: string;
  maxBuyers?: string;
  maxParallel?: string;
  maxSteps?: string;
  timeout?: string;
  budget?: string;
  session?: string;
  trace: 'off' | 'failed' | 'all';
  screenshots: boolean;
  headed?: boolean;
  open?: boolean;
  root: string;
}

function withRunOptions(cmd: Command): Command {
  return cmd
    .option(
      '-p, --population <file>',
      'population YAML/JSON (default: generate from --template/--size/--seed)',
    )
    .option('--template <id>', `population template (${Object.keys(TEMPLATES).join(', ')})`, 'saas')
    .option('--size <n>', 'buyers to generate when no --population', '20')
    .option('--seed <n>', 'population seed', '42')
    .option('--task <file>', 'task YAML/JSON (instruction + success criteria)')
    .option('--success-text <regex>', 'goal reached when page text matches')
    .option('--success-url <regex>', 'goal reached when URL matches')
    .option('--instruction <text>', 'task given to every buyer (never mention variants)')
    .option(
      '--buyer <spec>',
      'buyer engine: heuristic | anthropic:<model> | openai:<model> | lmstudio:<model> | ollama:<model>',
      'heuristic',
    )
    .option('--auditor <spec>', 'optional LLM for the five auditors (default: deterministic)')
    .option(
      '--engine-cmd <command>',
      'delegate journeys to an external engine (Browser Use, Browser Harness…) — see docs/INTEGRATIONS.md',
    )
    .option('--max-buyers <n>', 'hard cap on buyers per variant')
    .option('--max-parallel <n>', 'concurrent browser journeys (default 4, LLM 2)')
    .option('--max-steps <n>', 'hard cap on steps per journey')
    .option('--timeout <ms>', 'per-journey timeout in ms')
    .option('--budget <usd>', 'hard USD cap on LLM spend for the session (default 1.00 when an LLM is used)')
    .option('--session <id>', 'session id (re-using an id resumes it)')
    .addOption(
      new Option('--trace <mode>', 'Playwright traces to keep')
        .choices(['off', 'failed', 'all'])
        .default('failed'),
    )
    .option('--no-screenshots', 'skip per-step screenshots')
    .option('--headed', 'show the browser')
    .option('--open', 'open the HTML report when done')
    .option('--root <dir>', 'working directory for sessions', DEFAULT_ROOT);
}

function loadTask(f: RunFlags, fallback?: Task): Task {
  if (f.task) return TaskSchema.parse(readStructured(f.task));
  if (f.successText || f.successUrl) {
    return TaskSchema.parse({
      id: 'custom',
      instruction: f.instruction ?? TEMPLATES[f.template]?.default_task ?? DEMO_TASK.instruction,
      success: { text_pattern: f.successText, url_pattern: f.successUrl },
    });
  }
  if (fallback) return fallback;
  throw new Error(
    'How do we know a buyer succeeded? Pass --success-text "<regex>", --success-url "<regex>" or --task <file>.',
  );
}

function loadPop(f: RunFlags): Population {
  return f.population
    ? loadPopulation(f.population)
    : generatePopulation({ template: f.template, size: Number(f.size), seed: Number(f.seed) });
}

const num = (v?: string) => (v === undefined ? undefined : Number(v));

/** Fill flags the user did not pass explicitly from buyer-arena.yaml (if present). */
function applyConfig<T extends RunFlags>(f: T, cmd: Command): T & { variants?: Record<string, string> } {
  const cfg = loadConfig();
  if (!cfg) return f;
  const unset = (k: string) => cmd.getOptionValueSource(k) !== 'cli';
  const out: T & { variants?: Record<string, string> } = { ...f, variants: cfg.variants };
  const set = (k: keyof RunFlags, v: string | number | undefined) => {
    if (v !== undefined && unset(k)) (out as Record<string, unknown>)[k] = String(v);
  };
  set('population', cfg.population);
  set('task', cfg.task);
  set('buyer', cfg.buyer);
  set('auditor', cfg.auditor);
  set('maxBuyers', cfg.limits?.max_buyers);
  set('maxParallel', cfg.limits?.max_parallel);
  set('maxSteps', cfg.limits?.max_steps);
  set('timeout', cfg.limits?.timeout_ms);
  set('budget', cfg.limits?.budget_usd);
  return out;
}

function sessionOpts(f: RunFlags): Omit<SessionOptions, 'population' | 'task' | 'variants'> {
  return {
    root: f.root,
    sessionId: f.session,
    buyer: f.buyer,
    engineCommand: f.engineCmd,
    maxBuyers: num(f.maxBuyers),
    maxParallel: num(f.maxParallel),
    maxSteps: num(f.maxSteps),
    timeoutMs: num(f.timeout),
    budgetUsd: num(f.budget),
    trace: f.trace,
    screenshots: f.screenshots,
    headed: f.headed,
    onRun: progress,
  };
}

function progress(run: RunRecord, p: { done: number; total: number; skipped: boolean }): void {
  const mark = run.goal_completed
    ? c.green('✓')
    : run.status === 'error' || run.status === 'budget_exhausted'
      ? c.magenta('!')
      : c.red('✗');
  const why = run.goal_completed
    ? c.dim(`${run.steps} steps`)
    : c.dim((run.abandon_reason ?? run.status).slice(0, 70));
  log(
    `  ${c.dim(`[${String(p.done).padStart(3)}/${p.total}]`)} ${mark} ${run.variant.padEnd(10)} ${run.persona_id} ${run.segment.padEnd(26).slice(0, 26)} ${p.skipped ? c.dim('(resumed)') : why}`,
  );
}

/** Ctrl+C stops scheduling new buyers; completed journeys are kept for resume. */
function interruptible(): AbortController {
  const ac = new AbortController();
  process.once('SIGINT', () => {
    log(
      c.yellow(
        '\n  Interrupt received — finishing in-flight journeys. Completed ones are saved; resume with the same --session.',
      ),
    );
    ac.abort();
  });
  return ac;
}

function finish(res: PipelineResult, open?: boolean): void {
  log(terminalSummary(res.analysis));
  const rel = (p: string) => relative(process.cwd(), p) || p;
  log(`  ${c.bold('Report')}      ${rel(res.reports.html)}`);
  log(`  ${c.bold('ROI backlog')} ${rel(res.reports.backlog)}`);
  log(
    `  ${c.bold('Session')}     ${res.session.manifest.session_id} ${c.dim(`(${res.session.executed} run, ${res.session.skipped} resumed, status ${res.session.manifest.status})`)}`,
  );
  const usage = res.session.manifest.usage;
  if (usage.length)
    log(
      `  ${c.bold('LLM cost')}    ≈ $${usage.reduce((s, u) => s + u.estimated_cost_usd, 0).toFixed(4)} ${c.dim(usage.map((u) => `${u.provider}:${u.model} ${u.calls} calls`).join(', '))}`,
    );
  log('');
  if (open) openInBrowser(res.reports.html);
  if (res.session.manifest.status === 'interrupted' || res.session.manifest.status === 'budget_exhausted')
    process.exitCode = 2;
}

/* ───────────── commands ───────────── */

program
  .command('demo')
  .description(
    'Start the bundled demo product (baseline + candidate), run 20 synthetic buyers against both, write the report',
  )
  .option('--size <n>', 'buyers', '20')
  .option('--seed <n>', 'population seed', '42')
  .option('--max-parallel <n>', 'concurrent journeys', '4')
  .option('--session <id>', 'session id (re-using an id resumes it)')
  .option('--no-screenshots', 'skip screenshots')
  .option('--open', 'open the report in your browser')
  .option('--root <dir>', 'sessions directory', DEFAULT_ROOT)
  .action(
    async (f: {
      size: string;
      seed: string;
      maxParallel: string;
      session?: string;
      screenshots: boolean;
      open?: boolean;
      root: string;
    }) => {
      log(c.bold('\n  BUYER ARENA — demo'));
      log(
        c.dim(
          `  Tallybird (fictional SaaS) · baseline vs candidate · ${f.size} synthetic buyers · seed ${f.seed} · no paid APIs\n`,
        ),
      );
      const ac = interruptible();
      const res = await runDemo({
        size: Number(f.size),
        seed: Number(f.seed),
        maxParallel: Number(f.maxParallel),
        sessionId: f.session,
        screenshots: f.screenshots,
        root: f.root,
        onRun: progress,
        signal: ac.signal,
      });
      finish(res, f.open);
    },
  );

withRunOptions(
  program
    .command('run')
    .description('Run a synthetic population against one URL')
    .requiredOption('-u, --url <url>', 'target URL (only this origin is visited)')
    .option('--variant <name>', 'label for this version', 'current'),
).action(async (flags: RunFlags & { url: string; variant: string }, cmd: Command) => {
  const f = applyConfig(flags, cmd);
  const ac = interruptible();
  const res = await runPipeline({
    ...sessionOpts(f),
    population: loadPop(f),
    task: loadTask(f),
    variants: [{ name: f.variant, url: assertTarget(f.url) }],
    auditor: f.auditor,
    signal: ac.signal,
  });
  finish(res, f.open);
});

withRunOptions(
  program
    .command('compare')
    .description('Run the SAME seeded population against a baseline and a candidate and compare')
    .option('-b, --baseline <url>', 'baseline URL (or variants.baseline in buyer-arena.yaml)')
    .option('-c, --candidate <url>', 'candidate URL (or variants.candidate in buyer-arena.yaml)'),
).action(async (flags: RunFlags & { baseline?: string; candidate?: string }, cmd: Command) => {
  const f = applyConfig(flags, cmd);
  const baseline = f.baseline ?? f.variants?.baseline;
  const candidate = f.candidate ?? f.variants?.candidate;
  if (!baseline || !candidate)
    throw new Error('compare needs --baseline <url> and --candidate <url> (or variants in buyer-arena.yaml)');
  const ac = interruptible();
  const res = await runPipeline({
    ...sessionOpts(f),
    population: loadPop(f),
    task: loadTask(f),
    variants: [
      { name: 'baseline', url: assertTarget(baseline) },
      { name: 'candidate', url: assertTarget(candidate) },
    ],
    auditor: f.auditor,
    signal: ac.signal,
  });
  finish(res, f.open);
});

program
  .command('resume')
  .description('Resume an interrupted session (completed journeys are not re-run)')
  .argument('[session]', 'session id (default: latest)')
  .option('--root <dir>', 'sessions directory', DEFAULT_ROOT)
  .option('--open', 'open report')
  .action(async (id: string | undefined, f: { root: string; open?: boolean }) => {
    const dir = resolveSession(id, f.root);
    const ac = interruptible();
    finish(await resumeSession(dir, { onRun: progress, signal: ac.signal }), f.open);
  });

const population = program.command('population').description('Synthetic populations');
population
  .command('generate')
  .description('Generate a deterministic synthetic population (same seed → same population)')
  .option('--template <id>', `template (${Object.keys(TEMPLATES).join(', ')})`, 'saas')
  .option('--size <n>', 'number of buyers', '20')
  .option('--seed <n>', 'seed', '42')
  .option('-o, --out <file>', 'output .yaml or .json (default: stdout)')
  .option('--calibration <file>', 'aggregate-only calibration file (segment shares, objection shares)')
  .option('--stories', 'print each buyer story')
  .action(
    (f: {
      template: string;
      size: string;
      seed: string;
      out?: string;
      stories?: boolean;
      calibration?: string;
    }) => {
      const cal = f.calibration
        ? calibrate(CalibrationInputSchema.parse(readStructured(f.calibration)))
        : undefined;
      if (cal) for (const n of cal.notes) log(c.dim(`  ${n}`));
      const pop = generatePopulation({
        template: f.template,
        size: Number(f.size),
        seed: Number(f.seed),
        weights: cal?.weights,
        objectionRates: cal?.objection_rates,
      });
      if (f.out) {
        savePopulation(f.out, pop);
        log(
          `${c.green('✓')} ${pop.personas.length} buyers (${new Set(pop.personas.map((p) => p.archetype)).size} archetypes) → ${f.out}`,
        );
      } else if (!f.stories) process.stdout.write(YAML.stringify(pop));
      if (f.stories)
        for (const p of pop.personas)
          log(
            `\n${c.bold(`${p.persona_id} ${p.name}`)} ${c.dim(`· ${p.segment} · ${p.device.kind}`)}\n${buildStory(p, pop.template).narrative}`,
          );
    },
  );
population
  .command('templates')
  .description('List population templates')
  .action(() => {
    for (const t of Object.values(TEMPLATES))
      log(
        `${c.bold(t.id.padEnd(18))} ${t.description} ${c.dim(
          `[${Object.values(t.flavors)
            .map((x) => x.segment)
            .join(', ')}]`,
        )}`,
      );
  });

program
  .command('calibrate')
  .description('Compare a session’s simulated funnel with REAL aggregate funnel rates (no personal data)')
  .argument('<aggregates>', 'calibration YAML/JSON (see examples/calibration.yaml)')
  .option('--session <id>', 'session (default: latest)')
  .option('--variant <name>', 'variant to compare (default: last)')
  .option('--root <dir>', 'sessions directory', DEFAULT_ROOT)
  .action(async (file: string, f: { session?: string; variant?: string; root: string }) => {
    const input = CalibrationInputSchema.parse(readStructured(file));
    const a = await analyzeSession(resolveSession(f.session, f.root));
    const sim = a.summaries.find((s) => s.variant === (f.variant ?? a.backlog_variant));
    if (!sim) throw new Error('variant not found in session');
    const err = calibrationError(sim, input.funnel);
    log(
      c.dim(
        `\n  ${'STAGE'.padEnd(18)}${'SIMULATED'.padStart(10)}${'REAL'.padStart(8)}${'|ERROR|'.padStart(9)}${'REAL/SIM'.padStart(10)}`,
      ),
    );
    for (const r of err.rows)
      log(
        `  ${r.stage.padEnd(18)}${`${Math.round(r.simulated * 100)}%`.padStart(10)}${`${Math.round(r.real * 100)}%`.padStart(8)}${`${Math.round(r.abs_error * 100)}pp`.padStart(9)}${(r.correction === null ? '—' : r.correction.toFixed(2)).padStart(10)}`,
      );
    log(
      `\n  mean absolute error ${err.mean_abs_error === null ? '—' : `${Math.round(err.mean_abs_error * 100)}pp`} ${c.dim(`(source: ${input.source})`)}`,
    );
    log(
      c.dim(
        '  Correction factors are metadata for future calibration, not adjustments applied to results.\n',
      ),
    );
  });

program
  .command('report')
  .description('Re-analyse a session and regenerate report.html + ROI_BACKLOG.md')
  .argument('[session]', 'session id or directory (default: latest)')
  .option('--root <dir>', 'sessions directory', DEFAULT_ROOT)
  .option('--open', 'open the report')
  .action(async (id: string | undefined, f: { root: string; open?: boolean }) => {
    const dir = resolveSession(id, f.root);
    const analysis = await analyzeSession(dir);
    const paths = writeReports(dir, analysis);
    log(terminalSummary(analysis));
    log(
      `  Report      ${relative(process.cwd(), paths.html)}\n  ROI backlog ${relative(process.cwd(), paths.backlog)}\n`,
    );
    if (f.open) openInBrowser(paths.html);
  });

program
  .command('audit')
  .description('Re-run the five auditors on a session (deterministic, or with an LLM via --auditor)')
  .argument('[session]', 'session id (default: latest)')
  .option('--auditor <spec>', 'LLM spec, e.g. anthropic:claude-haiku-4-5 (default: deterministic)')
  .option('--budget <usd>', 'hard USD cap for auditor calls', '0.50')
  .option('--root <dir>', 'sessions directory', DEFAULT_ROOT)
  .action(async (id: string | undefined, f: { auditor?: string; budget: string; root: string }) => {
    const dir = resolveSession(id, f.root);
    const analysis = await analyzeSession(dir, {
      auditorProvider: f.auditor ? createProvider(f.auditor) : undefined,
      auditorBudgetUsd: Number(f.budget),
    });
    writeReports(dir, analysis);
    const audit = analysis.audits[analysis.backlog_variant];
    if (!audit) return;
    log(`\n  ${c.bold('Auditors')} ${c.dim(audit.auditor_mode)} · variant ${analysis.backlog_variant}`);
    for (const a of ['ux', 'business', 'engineering', 'customer', 'redteam'] as const)
      log(
        `  ${a.padEnd(12)} ${audit.findings.filter((x) => x.auditor === a).length} findings${audit.degraded.some((d) => d.auditor === a) ? c.yellow(' (degraded → deterministic)') : ''}`,
      );
    log('');
    for (const it of audit.consensus) {
      log(`  ${c.bold(it.id)} ${it.title} ${c.dim(`[${it.severity}/${it.confidence}]`)}`);
      log(`    ${c.cyan('OBSERVED FACT')} ${it.observed_fact}`);
      log(`    ${c.yellow(it.claim.toUpperCase())} ${it.interpretation}`);
      for (const ch of it.challenges) log(`    ${c.red('RED TEAM')} ${ch.text}`);
      log(
        `    ${c.dim(`evidence: ${it.evidence_ids.slice(0, 4).join(', ')}${it.evidence_ids.length > 4 ? ` +${it.evidence_ids.length - 4}` : ''}`)}`,
      );
    }
    if (analysis.audit_usage?.length)
      log(`\n  cost ≈ $${analysis.audit_usage.reduce((s, u) => s + u.estimated_cost_usd, 0).toFixed(4)}`);
    log('');
  });

program
  .command('replay')
  .description('Replay a journey in the terminal (and optionally open its Playwright trace)')
  .argument('<run>', 'run id, e.g. baseline-p-004 (or <run>:e12 to highlight an event)')
  .option('--session <id>', 'session (default: latest)')
  .option('--trace', 'open the Playwright trace viewer')
  .option('--root <dir>', 'sessions directory', DEFAULT_ROOT)
  .action((ref: string, f: { session?: string; trace?: boolean; root: string }) => {
    const [runId, ev] = ref.includes(':') ? [ref.slice(0, ref.lastIndexOf(':')), ref] : [ref, undefined];
    const dir = resolveSession(f.session, f.root);
    const run = loadRuns(dir).find((r) => r.run_id === runId);
    if (!run) throw new Error(`run ${runId} not found in ${dir}. Try: buyer-arena status`);
    const story = join(dir, 'runs', run.variant, run.persona_id, 'story.json');
    log(`\n  ${c.bold(run.run_id)} ${c.dim(`· ${run.segment} · ${run.policy}`)}`);
    if (existsSync(story)) log(`  ${c.dim(readJson<{ narrative: string }>(story).narrative)}`);
    log(
      `  ${run.goal_completed ? c.green(`✓ completed in ${run.steps} steps`) : c.red(`✗ ${run.abandon_reason ?? run.status}`)}\n`,
    );
    for (const e of run.events) {
      if (e.type === 'observe') continue;
      const color =
        e.type === 'decision'
          ? c.bold
          : /error|abandon|objection/.test(e.type)
            ? c.red
            : e.type === 'milestone' || e.type === 'goal_complete'
              ? c.green
              : c.dim;
      const line = `  ${c.dim(e.id.split(':')[1]?.padEnd(4) ?? '')} ${c.dim(`#${String(e.step).padStart(2)}`)} ${e.type.padEnd(14)} ${color([e.target, e.detail].filter(Boolean).join(' — ').slice(0, 150))}`;
      log(e.id === ev ? c.yellow(`▶${line.slice(1)}`) : line);
    }
    const shots = join(dir, 'runs', run.variant, run.persona_id, 'shots');
    log(`\n  screenshots ${relative(process.cwd(), shots)}`);
    if (run.trace_path) {
      const trace = join(dir, 'runs', run.variant, run.persona_id, run.trace_path);
      log(`  trace       ${relative(process.cwd(), trace)}  ${c.dim('(npx playwright show-trace <file>)')}`);
      if (f.trace)
        spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['playwright', 'show-trace', trace], {
          stdio: 'inherit',
          shell: process.platform === 'win32',
        });
    }
    log('');
  });

program
  .command('status')
  .description('List sessions, progress and spend')
  .option('--root <dir>', 'sessions directory', DEFAULT_ROOT)
  .action((f: { root: string }) => {
    const sessions = listSessions(f.root);
    if (!sessions.length) return log('  no sessions yet — try `buyer-arena demo`');
    log(
      c.dim(`\n  ${'SESSION'.padEnd(24)}${'STATUS'.padEnd(18)}${'RUNS'.padEnd(10)}${'BUYER'.padEnd(34)}COST`),
    );
    for (const s of sessions.slice(0, 20)) {
      const m = loadManifest(s.dir);
      const done = loadRuns(s.dir).filter(
        (r) => r.status !== 'error' && r.status !== 'budget_exhausted',
      ).length;
      const cost = m.usage.reduce((a, u) => a + u.estimated_cost_usd, 0);
      const st = m.status === 'complete' ? c.green(m.status.padEnd(18)) : c.yellow(m.status.padEnd(18));
      log(
        `  ${m.session_id.padEnd(24)}${st}${`${done}/${m.runs_total}`.padEnd(10)}${m.buyer.padEnd(34)}${cost ? `$${cost.toFixed(4)}` : '$0'}`,
      );
    }
    log(c.dim('\n  resume: buyer-arena resume <session> · report: buyer-arena report <session>\n'));
  });

program
  .command('doctor')
  .description('Check the environment (no network calls, no spend)')
  .option('--root <dir>', 'sessions directory', DEFAULT_ROOT)
  .action((f: { root: string }) => {
    const ok = (b: boolean) => (b ? c.green('✓') : c.red('✗'));
    const nodeOk = Number(process.versions.node.split('.')[0]) >= 20;
    log(`\n  ${ok(nodeOk)} Node.js ${process.versions.node} ${nodeOk ? '' : c.red('(need ≥ 20)')}`);
    let exe = '';
    try {
      exe = chromium.executablePath();
    } catch {
      /* not installed */
    }
    const hasBrowser = Boolean(exe) && existsSync(exe);
    log(
      `  ${ok(hasBrowser)} Playwright Chromium ${hasBrowser ? c.dim(exe) : c.yellow('missing → run: npx playwright install chromium')}`,
    );
    let writable = true;
    try {
      accessSync(resolve('.'), constants.W_OK);
    } catch {
      writable = false;
    }
    log(`  ${ok(writable)} writable working directory ${c.dim(resolve(f.root))}`);
    log(
      `  ${c.green('✓')} offline mode ${process.env.BUYER_ARENA_OFFLINE === '1' ? 'ON (paid providers refused)' : c.dim('off')}`,
    );
    log(c.dim('\n  Providers (detected from environment; keys are never printed):'));
    for (const p of detectProviders())
      log(`  ${p.configured ? c.green('●') : c.dim('○')} ${p.id.padEnd(18)} ${c.dim(p.note)}`);
    log(
      c.dim(
        '\n  Default buyers and auditors are deterministic and free. Use --buyer / --auditor to opt into an LLM.\n',
      ),
    );
    if (!nodeOk || !hasBrowser) process.exitCode = 1;
  });

program
  .command('init')
  .description('Scaffold buyer-arena.yaml, a population and a task in the current directory')
  .option('--template <id>', 'population template', 'saas')
  .option('--force', 'overwrite existing files')
  .action((f: { template: string; force?: boolean }) => {
    const files: [string, string][] = [
      [
        'buyer-arena.yaml',
        YAML.stringify({
          population: 'populations/buyers.yaml',
          task: 'tasks/start-trial.yaml',
          variants: { baseline: 'http://localhost:3000', candidate: 'http://localhost:3001' },
          buyer: 'heuristic',
          limits: { max_parallel: 4, max_steps: 18, timeout_ms: 60000, budget_usd: 1 },
        }),
      ],
      [
        'tasks/start-trial.yaml',
        YAML.stringify({
          ...DEMO_TASK,
          id: 'start-trial',
          success: { text_pattern: 'welcome|trial is active|order confirmed' },
        }),
      ],
    ];
    for (const [file, body] of files) {
      if (existsSync(file) && !f.force) {
        log(`  ${c.yellow('skip')} ${file} (exists; --force to overwrite)`);
        continue;
      }
      writeFileAtomic(file, `# Buyer Arena — ${file}\n${body}`);
      log(`  ${c.green('create')} ${file}`);
    }
    const popFile = 'populations/buyers.yaml';
    if (!existsSync(popFile) || f.force) {
      savePopulation(popFile, generatePopulation({ template: f.template, size: 20, seed: 42 }));
      log(`  ${c.green('create')} ${popFile}`);
    }
    log(
      c.dim(
        '\n  Next: start your baseline and candidate locally (edit the URLs in buyer-arena.yaml), then run\n    buyer-arena compare --open\n',
      ),
    );
  });

program
  .command('demo-store')
  .description('Serve the bundled demo product on localhost (for trying run/compare by hand)')
  .addOption(
    new Option('--variant <v>', 'variant').choices(['baseline', 'candidate', 'both']).default('both'),
  )
  .option('--port <n>', 'port for baseline (candidate uses port+1)', '4101')
  .action(async (f: { variant: DemoVariant | 'both'; port: string }) => {
    const port = Number(f.port);
    const vs: DemoVariant[] = f.variant === 'both' ? ['baseline', 'candidate'] : [f.variant];
    for (const [i, v] of vs.entries()) {
      const s = await startDemoStore(v, port + i);
      log(`  ${c.green('●')} ${v.padEnd(10)} ${s.url}`);
    }
    log(c.dim('  Ctrl+C to stop.'));
  });

program
  .command('mcp')
  .description('Start the Buyer Arena MCP server on stdio (for Claude Code, Cursor, Codex…)')
  .action(async () => {
    const { startMcpServer } = await import('../mcp/server.js');
    await startMcpServer();
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(c.red(`\n  error: ${err instanceof Error ? err.message : String(err)}\n`));
  process.exitCode = 1;
});
