import { spawn } from 'node:child_process';
import { tryNetwork } from '../policy/network.js';
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashSeed, Rng } from '../core/rng.js';
import { Repo, shellBlocks } from './repo.js';
import {
  check,
  panelScore,
  stars,
  type Check,
  type Emit,
  type Evidence,
  type PanelResult,
  type Reviewer,
} from './types.js';

export interface DevOptions {
  repo: string;
  participants: number;
  level: number;
  /** Actually install/build/run in a throw-away copy. Off by default: it executes the repo's code. */
  execute: boolean;
  seed: number;
  emit: Emit;
  signal?: AbortSignal;
}

/** Only these command shapes are ever executed from a README (never curl|sh, rm, sudo, …). */
const SAFE_CMD =
  /^(npm (ci|install|i|test|run [\w:.-]+)|pnpm (install|i|test|run [\w:.-]+|[\w:.-]+)|yarn( install| test| run [\w:.-]+| [\w:.-]+)?|npx playwright install( --with-deps)?( chromium)?)(\s+--?[\w-]+(=[\w.-]+)?)*$/;

interface Exec {
  cmd: string;
  ok: boolean;
  code: number | null;
  ms: number;
  tail: string;
}

function run(cmd: string, cwd: string, timeoutMs: number, emit: Emit, signal?: AbortSignal): Promise<Exec> {
  const started = Date.now();
  emit({ type: 'log', panel: 'developers', line: `$ ${cmd}` });
  return new Promise((resolve) => {
    const child = spawn(cmd, {
      cwd,
      shell: true,
      env: { ...process.env, CI: '1', NO_COLOR: '1', FORCE_COLOR: '0' },
    });
    let tail = '';
    const onData = (d: Buffer) => {
      tail = (tail + d.toString()).slice(-4000);
      const last = d.toString().trim().split('\n').pop();
      if (last) emit({ type: 'log', panel: 'developers', line: last.slice(0, 160) });
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const kill = () => {
      if (process.platform === 'win32' && child.pid)
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
      else child.kill('SIGKILL');
    };
    const timer = setTimeout(kill, timeoutMs);
    signal?.addEventListener('abort', kill, { once: true });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ cmd, ok: code === 0, code, ms: Date.now() - started, tail: tail.slice(-600) });
    });
    child.on('error', () => resolve({ cmd, ok: false, code: null, ms: Date.now() - started, tail }));
  });
}

export async function runDevelopers(o: DevOptions): Promise<PanelResult> {
  const t0 = Date.now();
  const repo = new Repo(o.repo);
  const checks: Check[] = [];
  const P = 'developers' as const;
  const total = o.execute ? 8 + o.level : 8;
  let done = 0;
  const tick = (label: string) => o.emit({ type: 'progress', panel: P, done: ++done, total, label });

  // 1 README
  const readme = repo.readme;
  const md = readme ? repo.text(readme) : '';
  const heads = [...md.matchAll(/^#{1,3}\s+(.+)$/gm)].map((m) => (m[1] ?? '').toLowerCase());
  const has = (re: RegExp) => heads.some((h) => re.test(h));
  const readmeScore = !readme
    ? 0
    : 25 +
      (md.length > 1500 ? 15 : 5) +
      (has(/quick ?start|getting started|install|empezar|instal/) ? 25 : 0) +
      (has(/usage|how it works|uso|cómo/) ? 15 : 0) +
      (/!\[[^\]]*\]\([^)]+\)/.test(md) ? 20 : 0);
  checks.push(
    check(
      P,
      'dev.readme',
      readmeScore,
      3,
      readme ? [{ kind: 'file', ref: `${readme}:1`, excerpt: md.split('\n')[0]?.slice(0, 120) }] : [],
      { sections: heads.length },
    ),
  );
  tick('README');

  // 2 Quick-start commands map to real scripts
  const pkg = repo.json<{ scripts?: Record<string, string>; engines?: Record<string, string> }>(
    'package.json',
  );
  const scripts = pkg?.scripts ?? {};
  const blocks = readme ? shellBlocks(md) : [];
  const npmRuns = blocks.filter((b) => /^(npm|pnpm|yarn) (run )?[\w:.-]+/.test(b.cmd));
  const broken = npmRuns.filter((b) => {
    const m = b.cmd.match(/^(?:npm|pnpm|yarn) run ([\w:.-]+)/);
    return m && !scripts[m[1] as string];
  });
  const qsScore =
    blocks.length === 0 ? 10 : npmRuns.length === 0 ? 50 : 100 - (broken.length / npmRuns.length) * 100;
  checks.push(
    check(
      P,
      'dev.quickstart',
      qsScore,
      3,
      [...broken, ...blocks.slice(0, 3)]
        .slice(0, 5)
        .map((b) => ({ kind: 'file', ref: `${readme}:${b.line}`, excerpt: b.cmd })),
      { commands: blocks.length, broken: broken.length },
    ),
  );
  tick('Quick start');

  // 3 Prerequisites stated and consistent
  const engines = pkg?.engines?.node;
  const nvmrc = repo.files.includes('.nvmrc') ? repo.text('.nvmrc').trim() : '';
  const mentions = repo.grep(/node(\.js)?\s*(≥|>=|v?\d{2})/i, readme ? [readme] : [], 3);
  const prereq = (engines ? 40 : 0) + (nvmrc ? 20 : 0) + (mentions.length ? 40 : 0);
  checks.push(
    check(
      P,
      'dev.prereqs',
      prereq,
      2,
      [
        ...mentions,
        ...(engines
          ? [{ kind: 'file' as const, ref: 'package.json', excerpt: `engines.node: ${engines}` }]
          : []),
      ],
      {
        engines: engines ?? '—',
      },
    ),
  );
  tick('Prerequisites');

  // 4 CI runs tests
  const wfs = repo.has(/^\.github\/workflows\/.+\.ya?ml$/);
  const ciTests = wfs.flatMap((f) =>
    repo.grep(/\b(npm (run )?test|pnpm (-r )?test|yarn test|vitest|jest|pytest|go test)\b/, [f], 2),
  );
  checks.push(
    check(
      P,
      'dev.ci',
      wfs.length ? (ciTests.length ? 100 : 55) : 0,
      2,
      ciTests.length ? ciTests : wfs.map((f) => ({ kind: 'file', ref: f })),
      { workflows: wfs.length },
    ),
  );
  tick('CI');

  // 5 Tests present
  const tests = repo.has(/(\.test\.|\.spec\.|(^|\/)tests?\/|__tests__)/);
  checks.push(
    check(
      P,
      'dev.tests',
      Math.min(100, tests.length * 10),
      2,
      tests.slice(0, 5).map((f) => ({ kind: 'file', ref: f })),
      { files: tests.length },
    ),
  );
  tick('Tests');

  // 6 Contributor docs
  const docs = ['CONTRIBUTING.md', 'CHANGELOG.md', 'SECURITY.md', 'CODE_OF_CONDUCT.md'].filter((f) =>
    repo.files.includes(f),
  );
  const docsDir = repo.files.some((f) => f.startsWith('docs/'));
  checks.push(
    check(
      P,
      'dev.docs',
      docs.length * 20 + (docsDir ? 20 : 0),
      1,
      docs.map((f) => ({ kind: 'file', ref: f })),
      { found: docs.length },
    ),
  );
  tick('Docs');

  // 7 License
  const lic = repo.files.find((f) => /^(LICENSE|LICENCE|COPYING)(\.\w+)?$/i.test(f));
  const spdx = lic
    ? (repo
        .text(lic)
        .match(
          /Apache License|MIT License|GNU (AFFERO |LESSER )?GENERAL PUBLIC|Mozilla Public|BSD|Business Source|Functional Source/i,
        )?.[0] ?? 'custom')
    : 'none';
  checks.push(
    check(
      P,
      'dev.license',
      lic ? (spdx === 'custom' ? 50 : 100) : 0,
      2,
      lic ? [{ kind: 'file', ref: `${lic}:1`, excerpt: spdx }] : [],
      { license: spdx },
    ),
  );
  tick('License');

  // 8 Tooling & examples
  const tooling = [
    'tsconfig.json',
    'eslint.config.js',
    '.eslintrc.json',
    '.prettierrc.json',
    'pyproject.toml',
    'ruff.toml',
  ].filter((f) => repo.files.includes(f));
  const strict =
    repo.files.includes('tsconfig.json') && /"strict"\s*:\s*true/.test(repo.text('tsconfig.json'));
  const examples = repo.files.some((f) => f.startsWith('examples/'));
  checks.push(
    check(
      P,
      'dev.tooling',
      tooling.length * 20 + (strict ? 20 : 0) + (examples ? 20 : 0),
      1,
      tooling.map((f) => ({ kind: 'file', ref: f })),
      { tools: tooling.length },
    ),
  );
  tick('Tooling');

  // 9+ Execution in a throw-away copy (opt-in)
  const execs: Exec[] = [];
  // Installing dependencies reaches the package registry: explicit (--execute), but a strict
  // OFFLINE/LOCAL policy still refuses it.
  const net = o.execute
    ? tryNetwork('https://registry.npmjs.org/', 'package-registry', { explicit: true })
    : undefined;
  if (net && !net.ok) o.emit({ type: 'log', panel: P, line: `execution skipped: ${net.reason}` });
  if (o.execute && net?.ok) {
    const tmp = mkdtempSync(join(tmpdir(), 'ba-dev-'));
    try {
      o.emit({ type: 'log', panel: P, line: `copying tracked files to ${tmp}` });
      if (existsSync(join(o.repo, '.git'))) {
        await run(
          `git clone --quiet --no-hardlinks "${o.repo}" "${tmp}"`,
          tmpdir(),
          120_000,
          o.emit,
          o.signal,
        );
      } else {
        cpSync(o.repo, tmp, { recursive: true, filter: (s) => !/node_modules|[\\/]\.git[\\/]?/.test(s) });
      }
      const lock = existsSync(join(tmp, 'package-lock.json'));
      const install = await run(
        lock ? 'npm ci --no-audit --no-fund' : 'npm install --no-audit --no-fund',
        tmp,
        600_000,
        o.emit,
        o.signal,
      );
      execs.push(install);
      checks.push(
        check(
          P,
          'dev.install',
          install.ok ? (install.ms < 60_000 ? 100 : install.ms < 180_000 ? 80 : 60) : 0,
          3,
          [
            {
              kind: 'command',
              ref: install.cmd,
              excerpt: install.ok ? `${Math.round(install.ms / 1000)} s` : install.tail.slice(-160),
            },
          ],
          { seconds: Math.round(install.ms / 1000) },
        ),
      );
      tick('Install');
      if (install.ok && scripts.build) {
        const b = await run('npm run build', tmp, 300_000, o.emit, o.signal);
        execs.push(b);
        checks.push(
          check(
            P,
            'dev.build',
            b.ok ? 100 : 0,
            2,
            [
              {
                kind: 'command',
                ref: b.cmd,
                excerpt: b.ok ? `${Math.round(b.ms / 1000)} s` : b.tail.slice(-160),
              },
            ],
            { seconds: Math.round(b.ms / 1000) },
          ),
        );
      }
      tick('Build');
      // First success: the first safe README command that is not install/build/test.
      const first = blocks
        .map((b) => b.cmd)
        .find(
          (c) =>
            SAFE_CMD.test(c) &&
            !/(ci|install|\bi\b|build|test|lint|typecheck|doctor)$/.test(c) &&
            /run |^(pnpm|yarn) [\w:.-]+$/.test(c),
        );
      if (install.ok && first) {
        const r = await run(first, tmp, 300_000, o.emit, o.signal);
        execs.push(r);
        checks.push(
          check(
            P,
            'dev.first_success',
            r.ok ? (r.ms < 60_000 ? 100 : r.ms < 180_000 ? 80 : 60) : 0,
            4,
            [
              {
                kind: 'command',
                ref: r.cmd,
                excerpt: r.ok ? `${Math.round(r.ms / 1000)} s` : r.tail.slice(-160),
              },
            ],
            { seconds: Math.round(r.ms / 1000), command: first },
          ),
        );
      } else {
        checks.push(
          check(P, 'dev.first_success', install.ok ? 30 : 0, 4, [], { seconds: 0, command: first ?? '—' }),
        );
      }
      tick('First success');
      if (o.level >= 3 && install.ok && scripts.test) {
        const r = await run('npm test', tmp, 900_000, o.emit, o.signal);
        execs.push(r);
        checks.push(
          check(P, 'dev.tests_pass', r.ok ? 100 : 0, 2, [
            {
              kind: 'command',
              ref: r.cmd,
              excerpt: r.tail
                .split('\n')
                .filter((l) => /tests?|passed|failed/i.test(l))
                .slice(-2)
                .join(' ')
                .slice(0, 160),
            },
          ]),
        );
        tick('Tests');
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true, maxRetries: 3 });
    }
  } else {
    checks.push(check(P, 'dev.first_success', null, 4, [], { command: '—', seconds: 0 }));
  }

  // Reviewers: variations of three developer archetypes with seeded patience/priorities.
  const W: Record<string, Record<string, number>> = {
    newcomer: {
      'dev.readme': 4,
      'dev.quickstart': 4,
      'dev.prereqs': 3,
      'dev.first_success': 5,
      'dev.install': 3,
      'dev.license': 1,
    },
    contributor: {
      'dev.tests': 4,
      'dev.ci': 4,
      'dev.docs': 3,
      'dev.tooling': 3,
      'dev.tests_pass': 4,
      'dev.build': 2,
    },
    integrator: {
      'dev.readme': 2,
      'dev.license': 4,
      'dev.tooling': 2,
      'dev.docs': 2,
      'dev.install': 3,
      'dev.build': 3,
    },
  };
  const reviewers: Reviewer[] = [];
  const kinds = Object.keys(W);
  for (let i = 0; i < Math.max(3, o.participants); i++) {
    const kind = kinds[i % kinds.length] as string;
    const rng = new Rng(hashSeed(o.seed, 'dev', i));
    const w = Object.fromEntries(
      Object.entries(W[kind] as Record<string, number>).map(([k, v]) => [k, v * (0.7 + rng.next() * 0.6)]),
    );
    const ran = checks.filter((c) => c.score !== null && w[c.id] !== undefined);
    const tw = ran.reduce((s, c) => s + (w[c.id] as number), 0);
    reviewers.push({
      id: `dev-${i + 1}`,
      archetype: kind,
      score: tw ? Math.round(ran.reduce((s, c) => s + (c.score as number) * (w[c.id] as number), 0) / tw) : 0,
    });
  }
  const score = panelScore(checks);
  return {
    id: P,
    score,
    stars: stars(score),
    share: 0,
    reviewers,
    checks,
    duration_ms: Date.now() - t0,
    extra: {
      executed: o.execute,
      commands: execs.map((e) => ({ cmd: e.cmd, ok: e.ok, seconds: Math.round(e.ms / 1000) })),
    },
  };
}

export type { Evidence };
