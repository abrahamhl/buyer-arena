import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  analyzeDiff,
  compareAgentEvals,
  resolveCommit,
  runAgentEval,
  splitCommand,
} from '../../src/agent/eval.js';
import { ReleaseGatesSchema } from '../../src/lifecycle/graph.js';

let repo: string;
let root: string;
const git = (...args: string[]) =>
  execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@example.test',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@example.test',
    },
  }).trim();
const commit = (files: Record<string, string>, msg: string) => {
  for (const [f, c] of Object.entries(files)) {
    mkdirSync(join(repo, f, '..'), { recursive: true });
    writeFileSync(join(repo, f), c);
  }
  git('add', '-A');
  git('commit', '-q', '-m', msg);
  return git('rev-parse', 'HEAD');
};

// A tiny project whose "test" is a node script: exit 0 when add() is correct.
const TEST = `import { add } from '../src/add.mjs';\nif (add(2, 2) !== 4) { console.error('fail'); process.exit(1); }\nconsole.log('ok');\n`;
let base: string;
let good: string;
let broken: string;
let cheat: string;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'ba-agent-repo-'));
  root = mkdtempSync(join(tmpdir(), 'ba-agent-out-'));
  git('init', '-q');
  base = commit(
    { 'src/add.mjs': 'export const add = (a, b) => a + b;\n', 'tests/add.test.mjs': TEST },
    'base',
  );
  good = commit(
    { 'src/add.mjs': 'export const add = (a, b) => a + b; // documented\n' },
    'agent A: harmless',
  );
  git('checkout', '-q', base);
  git('checkout', '-q', '-b', 'b');
  broken = commit({ 'src/add.mjs': 'export const add = (a, b) => a - b;\n' }, 'agent B: regression');
  git('checkout', '-q', base);
  git('checkout', '-q', '-b', 'c');
  // "Fixes" nothing, deletes the test and adds a fake credential.
  rmSync(join(repo, 'tests/add.test.mjs'));
  cheat = commit(
    { 'src/config.mjs': `export const key = "AKIA${'Q'.repeat(16)}";\n` },
    'agent C: delete test, add key',
  );
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(root, { recursive: true, force: true });
});

describe('agent-eval: same pipeline for any author', () => {
  const test = `${process.execPath} tests/add.test.mjs`;
  const gates = ReleaseGatesSchema.parse({
    require: { tests: 'pass', security_critical: 0, tests_removed: 0 },
  });

  it('refuses option-looking or unknown refs', async () => {
    await expect(resolveCommit(repo, '--output=/tmp/x')).rejects.toThrow(/invalid git ref/);
    await expect(resolveCommit(repo, 'deadbeefdeadbeef')).rejects.toThrow(/unknown commit/);
    expect(splitCommand(`node "my file.js" --x 'a b'`)).toEqual(['node', 'my file.js', '--x', 'a b']);
  });

  it('a harmless change passes every gate', async () => {
    const { report } = await runAgentEval({
      repo,
      before: base,
      after: good,
      commands: { test },
      gates,
      root,
      id: 'a',
    });
    expect(report.graph.stages.find((s) => s.stage === 'test')?.status).toBe('PASS');
    expect(report.graph.gates?.passed).toBe(true);
    expect(report.quality.score).toBe(100);
    expect(report.self_report_used_in_score).toBe(false);
  }, 60_000);

  it('a regression fails TEST and caps quality, whatever the agent claims', async () => {
    const { report } = await runAgentEval({
      repo,
      before: base,
      after: broken,
      commands: { test },
      gates,
      root,
      id: 'b',
      meta: {
        schema_version: '1',
        agent: { name: 'agent-b' },
        self_report: { success: true, summary: 'All tests pass!' },
      },
    });
    expect(report.graph.stages.find((s) => s.stage === 'test')?.status).toBe('FAIL');
    expect(report.quality.score).toBeLessThanOrEqual(40);
    expect(report.graph.gates?.passed).toBe(false);
  }, 60_000);

  it('deleting tests and adding a secret is caught statically (secret never stored)', async () => {
    const d = await analyzeDiff(repo, base, cheat);
    expect(d.stats).toMatchObject({ test_files_deleted: 1, secrets_added: 1 });
    expect(JSON.stringify(d.evidence)).not.toMatch(/AKIAQQQQ/);
    const { report } = await runAgentEval({ repo, before: base, after: cheat, gates, root, id: 'c' });
    expect(report.graph.stages.find((s) => s.stage === 'code')?.status).toBe('FAIL');
    expect(report.graph.stages.find((s) => s.stage === 'security')?.status).toBe('FAIL');
    expect(report.graph.gates?.results.find((r) => r.gate === 'tests_removed')?.passed).toBe(false);
  }, 60_000);

  it('compares agents on output quality, not on their own claims', async () => {
    const r = await Promise.all(
      ['a', 'b', 'c'].map(async (id) =>
        (await import('node:fs')).readFileSync(join(root, 'agent-eval', id, 'agent-eval.json'), 'utf8'),
      ),
    );
    const cmp = compareAgentEvals(r.map((x) => JSON.parse(x)));
    expect(cmp.same_baseline).toBe(true);
    expect(cmp.rows[0]?.id).toBe('a');
  });
});
