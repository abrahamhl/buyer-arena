import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ensureDir, writeFileAtomic, writeJson } from '../core/fs.js';
import { redact, secretFingerprint } from '../core/redact.js';
import { makeEvidence, type EvidenceEnvelopeV1 } from '../evidence/envelope.js';
import { writeEvidence } from '../evidence/store.js';
import { scrubbedEnv } from '../integrations/exec.js';
import {
  buildGraph,
  evaluateGates,
  na,
  renderGraphText,
  stagesFromEvidence,
  withRelease,
  type LifecycleGraph,
  type ReleaseGates,
  type StageResult,
  type StageStatus,
} from '../lifecycle/graph.js';
import { SECRET_PATTERNS } from '../panels/security.js';
import { currentLedger, type NetworkLedgerV1 } from '../policy/network.js';
import type { AgentRunEnvelope } from './envelope.js';

export interface AgentEvalCommands {
  install?: string;
  build?: string;
  test?: string;
  lint?: string;
}

export interface AgentEvalOptions {
  repo: string;
  before: string;
  after: string;
  meta?: AgentRunEnvelope;
  commands?: AgentEvalCommands;
  /** Extra environment variable NAMES passed to build/test (credentials are stripped by default). */
  envPass?: string[];
  timeoutMs?: number;
  root?: string;
  id?: string;
  gates?: ReleaseGates;
  /** Evidence produced elsewhere for the AFTER state (Promptfoo, Gitleaks, a buyer session…). */
  evidence?: EvidenceEnvelopeV1[];
  /** Buyer comparison already run against before/after deployments (completion rates 0..1). */
  buyer?: { before: number; after: number; session?: string; n?: number };
  emit?: (line: string) => void;
}

export interface CommandResult {
  step: keyof AgentEvalCommands;
  cmd: string;
  ok: boolean;
  code: number | null;
  ms: number;
  tail: string;
}

export interface DiffStats {
  files_changed: number;
  insertions: number;
  deletions: number;
  test_files_changed: number;
  test_files_deleted: number;
  skips_added: number;
  assertions_removed_net: number;
  todos_added: number;
  secrets_added: number;
  files: string[];
}

export interface AgentEvalReport {
  version: 1;
  id: string;
  generated_at: string;
  repo: string;
  before: string;
  after: string;
  agent: AgentRunEnvelope | null;
  /** Always false: the agent's own claims never enter the score. */
  self_report_used_in_score: false;
  diff: DiffStats;
  commands: { before: CommandResult[]; after: CommandResult[] };
  graph: LifecycleGraph;
  quality: { score: number; caps: string[]; formula: string };
  cost: { usd: number | null; tokens: number | null; usd_per_quality_point: number | null };
  evidence_count: number;
  network: NetworkLedgerV1;
  duration_ms: number;
}

const TEST_PATH =
  /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$|_test\.(go|py)$|(^|\/)test_[^/]+\.py$/i;
const SKIP_RE =
  /\b(it|test|describe)\.(skip|todo)\s*\(|\bx(it|describe|test)\s*\(|@pytest\.mark\.(skip|xfail)|@unittest\.skip|\bt\.Skip\(|#\[ignore\]|\.only\s*\(/;
const ASSERT_RE = /\b(expect|assert\w*|should)\s*[.(]/g;

function git(repo: string, args: string[]): Promise<{ code: number | null; out: string; err: string }> {
  return new Promise((res) => {
    const child = spawn('git', ['-C', repo, ...args], { shell: false, windowsHide: true });
    let out = '';
    let err = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr.on('data', (d: Buffer) => (err += d.toString()));
    child.on('error', (e) => res({ code: null, out, err: String(e) }));
    child.on('close', (code) => res({ code, out, err }));
  });
}

/** Resolve a ref to a full commit SHA. Refuses option-looking refs. */
export async function resolveCommit(repo: string, ref: string): Promise<string> {
  if (!ref || ref.startsWith('-') || /[\s;&|`$]/.test(ref)) throw new Error(`invalid git ref: ${ref}`);
  const r = await git(repo, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]);
  if (r.code !== 0) throw new Error(`unknown commit ${ref} in ${repo}`);
  return r.out.trim();
}

/** Static analysis of the change between two commits. Reads git objects only; runs no repo code. */
export async function analyzeDiff(
  repo: string,
  before: string,
  after: string,
): Promise<{ stats: DiffStats; evidence: EvidenceEnvelopeV1[] }> {
  const numstat = await git(repo, ['diff', '--numstat', '--no-renames', before, after]);
  const status = await git(repo, ['diff', '--name-status', '--no-renames', before, after]);
  const patch = await git(repo, ['diff', '-U0', '--no-color', '--no-ext-diff', before, after]);
  let insertions = 0;
  let deletions = 0;
  const files: string[] = [];
  for (const line of numstat.out.split('\n')) {
    const [a, d, f] = line.split('\t');
    if (!f) continue;
    files.push(f);
    insertions += Number(a) || 0;
    deletions += Number(d) || 0;
  }
  const deleted = status.out
    .split('\n')
    .filter((l) => l.startsWith('D\t'))
    .map((l) => l.slice(2));
  const evidence: EvidenceEnvelopeV1[] = [];
  const ts = new Date().toISOString();
  const base = {
    source: 'buyer-arena.agent-diff',
    source_version: null,
    source_kind: 'builtin' as const,
    target: { commit: after },
    deterministic: true,
    offline: true,
    network_accessed: false,
    provenance: { tool: 'git', version: null, config_digest: null, timestamp: ts },
  };
  let file = '';
  let line = 0;
  let skips = 0;
  let assertsAdded = 0;
  let assertsRemoved = 0;
  let todos = 0;
  let secrets = 0;
  for (const raw of patch.out.split('\n')) {
    if (raw.startsWith('+++ ')) {
      file = raw.slice(4).replace(/^b\//, '');
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(raw);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      const text = raw.slice(1);
      if (SKIP_RE.test(text) && TEST_PATH.test(file)) {
        skips++;
        evidence.push(
          makeEvidence({
            ...base,
            categories: ['quality', 'agent'],
            finding_type: 'tests.skip-added',
            title: 'A test was skipped, focused or marked expected-to-fail',
            severity: 'high',
            confidence: 0.9,
            claim_type: 'observed',
            passed: false,
            location: `${file}:${line}`,
            raw: { file, line, kind: 'skip' },
          }),
        );
      }
      assertsAdded += (text.match(ASSERT_RE) ?? []).length;
      if (/\b(TODO|FIXME|HACK|XXX)\b/.test(text)) todos++;
      for (const [name, re] of SECRET_PATTERNS) {
        const m = re.exec(text);
        if (!m) continue;
        secrets++;
        evidence.push(
          makeEvidence({
            ...base,
            categories: ['security'],
            finding_type: `secret.${name}`,
            title: `Possible ${name} added`,
            severity: 'critical',
            confidence: 0.7,
            claim_type: 'observed',
            passed: false,
            location: `${file}:${line}`,
            // The value is never stored: only a short fingerprint to correlate duplicates.
            attributes: { rule: name, fingerprint: secretFingerprint(m[0]) },
            raw: { file, line, rule: name, fp: secretFingerprint(m[0]) },
          }),
        );
        break;
      }
      line++;
    } else if (raw.startsWith('-') && !raw.startsWith('---')) {
      if (TEST_PATH.test(file)) assertsRemoved += (raw.match(ASSERT_RE) ?? []).length;
    }
  }
  const testDeleted = deleted.filter((f) => TEST_PATH.test(f));
  for (const f of testDeleted)
    evidence.push(
      makeEvidence({
        ...base,
        categories: ['quality', 'agent'],
        finding_type: 'tests.file-deleted',
        title: 'A test file was deleted',
        severity: 'high',
        confidence: 0.9,
        claim_type: 'observed',
        passed: false,
        location: f,
        raw: { file: f, kind: 'deleted-test' },
      }),
    );
  return {
    stats: {
      files_changed: files.length,
      insertions,
      deletions,
      test_files_changed: files.filter((f) => TEST_PATH.test(f)).length,
      test_files_deleted: testDeleted.length,
      skips_added: skips,
      assertions_removed_net: Math.max(0, assertsRemoved - assertsAdded),
      todos_added: todos,
      secrets_added: secrets,
      files: files.slice(0, 200),
    },
    evidence,
  };
}

/** Split a command line into argv (quotes supported). Never passed to a shell on POSIX. */
export function splitCommand(cmd: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q: string | null = null;
  for (const ch of cmd.trim()) {
    if (q) {
      if (ch === q) q = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") q = ch;
    else if (/\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function runCommand(
  step: keyof AgentEvalCommands,
  cmd: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<CommandResult> {
  const started = Date.now();
  const argv = splitCommand(cmd);
  return new Promise((res) => {
    // Windows cannot spawn npm.cmd & co without a shell (Node ≥ 18.20 / 20.12 security change).
    const child = spawn(argv[0] as string, argv.slice(1), {
      cwd,
      env,
      shell: process.platform === 'win32',
      windowsHide: true,
    });
    let tail = '';
    const on = (d: Buffer) => (tail = (tail + d.toString()).slice(-4000));
    child.stdout.on('data', on);
    child.stderr.on('data', on);
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    const done = (code: number | null) => {
      clearTimeout(timer);
      res({ step, cmd, ok: code === 0, code, ms: Date.now() - started, tail: redact(tail.slice(-800)) });
    };
    child.on('error', () => done(null));
    child.on('close', done);
  });
}

async function withWorktree<T>(repo: string, sha: string, fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'ba-agent-'));
  const add = await git(repo, ['worktree', 'add', '--detach', '--force', dir, sha]);
  if (add.code !== 0) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(`git worktree add failed: ${add.err.trim().slice(0, 300)}`);
  }
  try {
    return await fn(dir);
  } finally {
    await git(repo, ['worktree', 'remove', '--force', dir]);
    rmSync(dir, { recursive: true, force: true });
  }
}

const statusFrom = (before: CommandResult | undefined, after: CommandResult | undefined): StageStatus => {
  if (!after) return 'N/A';
  if (after.ok) return 'PASS';
  return before && !before.ok ? 'WARN' : 'FAIL';
};

function commandStage(stage: 'build' | 'test', b?: CommandResult, a?: CommandResult): StageResult {
  if (!a) return na(stage, `no ${stage} command configured`);
  const st = statusFrom(b, a);
  const summary =
    st === 'PASS'
      ? `\`${a.cmd}\` passes after the change${b && !b.ok ? ' (was failing before: fixed)' : ''}`
      : st === 'WARN'
        ? `\`${a.cmd}\` fails before and after (already broken; not caused by this change)`
        : `\`${a.cmd}\` passed before and FAILS after: regression`;
  return {
    stage,
    status: st,
    summary,
    evidence_refs: [`command:${a.cmd}`],
    metrics: { before_ok: b?.ok ?? null, after_ok: a.ok, after_ms: a.ms, exit_code: a.code },
  };
}

export const QUALITY_FORMULA =
  '100 − 35·[build regressed] − 35·[tests regressed] − 25·[critical security] − 15·[tests removed/skipped] − 5·[net assertions removed] − 10·[buyer regression >5pp]; any FAIL in build, test or security caps the score at 40';

export function qualityScore(
  graph: LifecycleGraph,
  d: DiffStats,
  buyerDeltaPp: number | undefined,
): AgentEvalReport['quality'] {
  const st = (s: string) => graph.stages.find((x) => x.stage === s)?.status;
  let score = 100;
  const caps: string[] = [];
  if (st('build') === 'FAIL') score -= 35;
  if (st('test') === 'FAIL') score -= 35;
  if (st('security') === 'FAIL') score -= 25;
  if (d.skips_added + d.test_files_deleted > 0) score -= 15;
  if (d.assertions_removed_net > 0) score -= 5;
  if (buyerDeltaPp !== undefined && buyerDeltaPp < -5) score -= 10;
  for (const s of ['build', 'test', 'security'])
    if (st(s) === 'FAIL') {
      caps.push(`${s} FAIL caps the score at 40`);
      score = Math.min(score, 40);
    }
  return { score: Math.max(0, score), caps, formula: QUALITY_FORMULA };
}

/**
 * Evaluate a change between two commits through the same evidence pipeline, whoever made it.
 * Repository code IS executed for build/test (in throw-away worktrees, with credentials
 * stripped from the environment). It is not sandboxed: run untrusted agent output in a
 * container.
 */
export async function runAgentEval(o: AgentEvalOptions): Promise<{ report: AgentEvalReport; dir: string }> {
  const t0 = Date.now();
  const emit = o.emit ?? (() => undefined);
  const repo = resolve(o.repo);
  const before = await resolveCommit(repo, o.before);
  const after = await resolveCommit(repo, o.after);
  const id = o.id ?? `agent-${after.slice(0, 8)}-${Date.now().toString(36)}`;
  if (!/^[A-Za-z0-9][\w.-]{0,80}$/.test(id)) throw new Error(`invalid id ${id}`);
  const dir = join(resolve(o.root ?? '.buyer-arena'), 'agent-eval', id);
  ensureDir(dir);
  const timeoutMs = o.timeoutMs ?? 600_000;
  const cmds = o.commands ?? {};

  emit(`diff ${before.slice(0, 8)}..${after.slice(0, 8)}`);
  const { stats, evidence: diffEvidence } = await analyzeDiff(repo, before, after);

  // Installing dependencies reaches a package registry: explicit, but policy-checked.
  if (cmds.install)
    currentLedger().check('https://registry.npmjs.org/', 'package-registry', { explicit: true });
  const env = scrubbedEnv(o.envPass ?? [], { BUYER_ARENA_AGENT_EVAL: '1' });
  const runSide = async (sha: string, label: string): Promise<CommandResult[]> =>
    withWorktree(repo, sha, async (wt) => {
      const out: CommandResult[] = [];
      for (const step of ['install', 'build', 'lint', 'test'] as const) {
        const cmd = cmds[step];
        if (!cmd) continue;
        emit(`[${label}] $ ${cmd}`);
        const r = await runCommand(step, cmd, wt, env, timeoutMs);
        out.push(r);
        if (step === 'install' && !r.ok) break;
      }
      return out;
    });
  const hasCmds = Boolean(cmds.build || cmds.test || cmds.lint);
  const beforeRes = hasCmds ? await runSide(before, 'before') : [];
  const afterRes = hasCmds ? await runSide(after, 'after') : [];
  const pick = (list: CommandResult[], s: keyof AgentEvalCommands) => list.find((r) => r.step === s);

  const evidence = [...diffEvidence, ...(o.evidence ?? [])];
  const fromEv = stagesFromEvidence(evidence);
  const codeStatus: StageStatus =
    stats.skips_added + stats.test_files_deleted > 0 || stats.secrets_added > 0
      ? 'FAIL'
      : stats.assertions_removed_net > 0 || stats.todos_added > 0
        ? 'WARN'
        : 'PASS';
  const code: StageResult = {
    stage: 'code',
    status: codeStatus,
    summary: `${stats.files_changed} files, +${stats.insertions}/−${stats.deletions}; tests skipped ${stats.skips_added}, test files deleted ${stats.test_files_deleted}, net assertions removed ${stats.assertions_removed_net}, TODOs ${stats.todos_added}`,
    evidence_refs: diffEvidence.filter((e) => e.categories.includes('quality')).map((e) => e.id),
    metrics: { ...stats, files: stats.files.length },
  };
  const buyerDelta = o.buyer ? (o.buyer.after - o.buyer.before) * 100 : undefined;
  const buyer: StageResult | undefined = o.buyer
    ? {
        stage: 'buyer',
        status: (buyerDelta as number) < -5 ? 'FAIL' : (buyerDelta as number) < 0 ? 'WARN' : 'PASS',
        summary: `synthetic goal completion ${Math.round(o.buyer.before * 100)}% → ${Math.round(o.buyer.after * 100)}% (${(buyerDelta as number) >= 0 ? '+' : ''}${(buyerDelta as number).toFixed(0)}pp${o.buyer.n ? `, n=${o.buyer.n}` : ''})`,
        evidence_refs: o.buyer.session ? [`session:${o.buyer.session}`] : [],
        metrics: { before: o.buyer.before, after: o.buyer.after, delta_pp: buyerDelta ?? null },
      }
    : undefined;
  const lint = pick(afterRes, 'lint');
  if (lint && !lint.ok && code.status === 'PASS') {
    code.status = pick(beforeRes, 'lint')?.ok === false ? 'PASS' : 'WARN';
    code.summary += `; lint ${code.status === 'WARN' ? 'regressed' : 'was already failing'}`;
  }
  let graph = buildGraph({
    spec: o.meta?.task?.description ? na('spec', 'task description recorded (not evaluated)') : undefined,
    code,
    build: commandStage('build', pick(beforeRes, 'build'), pick(afterRes, 'build')),
    test: commandStage('test', pick(beforeRes, 'test'), pick(afterRes, 'test')),
    ai_eval: fromEv.ai_eval,
    security: fromEv.security ?? {
      stage: 'security',
      status: 'PASS',
      summary: 'no secret patterns in added lines (built-in scan of the diff only)',
      evidence_refs: [],
    },
    accessibility: fromEv.accessibility,
    buyer,
  });
  const secCritical = evidence.filter(
    (e) => e.categories.includes('security') && e.severity === 'critical',
  ).length;
  const secHigh = evidence.filter((e) => e.categories.includes('security') && e.severity === 'high').length;
  const gates = o.gates
    ? evaluateGates(graph, o.gates, {
        security_critical: secCritical,
        security_high: secHigh,
        buyer_delta_pp: buyerDelta,
        tests_removed: stats.skips_added + stats.test_files_deleted,
        cost_usd: o.meta?.usage?.cost_usd,
      })
    : undefined;
  graph = withRelease(graph, gates);
  const quality = qualityScore(graph, stats, buyerDelta);
  const usd = o.meta?.usage?.cost_usd ?? null;
  const tokens = o.meta?.usage ? (o.meta.usage.input_tokens ?? 0) + (o.meta.usage.output_tokens ?? 0) : null;
  const report: AgentEvalReport = {
    version: 1,
    id,
    generated_at: new Date().toISOString(),
    repo: repo.split(/[\\/]/).pop() ?? repo,
    before,
    after,
    agent: o.meta ?? null,
    self_report_used_in_score: false,
    diff: stats,
    commands: { before: beforeRes, after: afterRes },
    graph,
    quality,
    cost: {
      usd,
      tokens,
      usd_per_quality_point: usd !== null && quality.score > 0 ? usd / quality.score : null,
    },
    evidence_count: evidence.length,
    network: currentLedger().snapshot(),
    duration_ms: Date.now() - t0,
  };
  writeJson(join(dir, 'agent-eval.json'), report);
  writeEvidence(join(dir, 'evidence.jsonl'), evidence);
  writeFileAtomic(join(dir, 'AGENT_EVAL.md'), renderAgentEvalMarkdown(report));
  return { report, dir };
}

export function renderAgentEvalMarkdown(r: AgentEvalReport): string {
  const who = r.agent?.agent
    ? `${r.agent.agent.name}${r.agent.model ? ` · ${r.agent.model}` : ''}`
    : 'unattributed change';
  return [
    `# Agent run evaluation — ${who}`,
    '',
    `\`${r.before.slice(0, 8)}\` → \`${r.after.slice(0, 8)}\` · output quality **${r.quality.score}/100** · ${r.graph.gates ? (r.graph.gates.passed ? 'gates **PASS**' : 'gates **FAIL**') : 'no gates'}`,
    '',
    '```',
    renderGraphText(r.graph),
    '```',
    '',
    `Quality formula: ${r.quality.formula}.`,
    r.quality.caps.length ? `Caps applied: ${r.quality.caps.join('; ')}.` : '',
    '',
    `Cost: ${r.cost.usd === null ? 'not reported' : `$${r.cost.usd.toFixed(4)}`} · tokens: ${r.cost.tokens ?? 'not reported'}.`,
    r.agent?.self_report
      ? `The agent reported success=${String(r.agent.self_report.success)}; this is recorded, never scored.`
      : '',
    '',
    'Build and test ran in throw-away git worktrees with credentials removed from the environment. They were not sandboxed.',
    '',
  ]
    .filter((l) => l !== undefined)
    .join('\n');
}

/** Compare several evaluations of the same `before` (patch A vs B vs C). */
export function compareAgentEvals(reports: AgentEvalReport[]): {
  rows: {
    id: string;
    agent: string;
    quality: number;
    gates: boolean | null;
    failing: string[];
    cost_usd: number | null;
  }[];
  same_baseline: boolean;
} {
  const rows = reports
    .map((r) => ({
      id: r.id,
      agent: r.agent?.agent?.name
        ? `${r.agent.agent.name}${r.agent.model ? `/${r.agent.model}` : ''}`
        : r.after.slice(0, 8),
      quality: r.quality.score,
      gates: r.graph.gates ? r.graph.gates.passed : null,
      failing: r.graph.stages.filter((s) => s.status === 'FAIL').map((s) => s.stage),
      cost_usd: r.cost.usd,
    }))
    .sort(
      (a, b) =>
        Number(b.gates ?? true) - Number(a.gates ?? true) ||
        b.quality - a.quality ||
        (a.cost_usd ?? Infinity) - (b.cost_usd ?? Infinity),
    );
  return { rows, same_baseline: new Set(reports.map((r) => r.before)).size <= 1 };
}
