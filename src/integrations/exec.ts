import { spawn } from 'node:child_process';
import { accessSync, constants, existsSync, statSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { redact } from '../core/redact.js';

/**
 * Find an executable on PATH without spawning a shell (`which`/`where`), so detection is
 * cheap, offline and cannot be hijacked by shell aliases.
 */
export function findExecutable(names: string[]): string | undefined {
  const dirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  const exts = process.platform === 'win32' ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';') : [''];
  for (const name of names) {
    for (const dir of dirs) {
      for (const ext of exts) {
        const p = join(dir, name + ext.toLowerCase());
        const P = join(dir, name + ext);
        for (const cand of [p, P]) {
          try {
            if (existsSync(cand) && statSync(cand).isFile()) {
              if (process.platform !== 'win32') accessSync(cand, constants.X_OK);
              return cand;
            }
          } catch {
            /* not executable */
          }
        }
      }
    }
  }
  return undefined;
}

/**
 * The environment a third-party tool gets: only what it needs to run. Buyer Arena's own
 * credentials (ANTHROPIC_API_KEY, OPENAI_API_KEY, GITHUB_TOKEN, …) are never inherited.
 * Tools that legitimately need a key (garak, promptfoo, Browser Use) read it from their own
 * config or from variables the user passes explicitly via `pass`.
 */
export function scrubbedEnv(pass: string[] = [], extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const keep = [
    'PATH',
    'HOME',
    'USERPROFILE',
    'TMPDIR',
    'TEMP',
    'TMP',
    'LANG',
    'LC_ALL',
    'SystemRoot',
    'PATHEXT',
    'XDG_CACHE_HOME',
    'XDG_CONFIG_HOME',
    ...pass,
  ];
  const env: NodeJS.ProcessEnv = { NO_COLOR: '1', FORCE_COLOR: '0', CI: '1' };
  for (const k of keep) if (process.env[k] !== undefined) env[k] = process.env[k];
  return { ...env, ...extra };
}

export interface ToolResult {
  code: number | null;
  stdout: string;
  stderr: string;
  ms: number;
  timedOut: boolean;
}

/** Run a tool with an argument vector (never a shell string), a hard timeout and a scrubbed env. */
export function runTool(
  cmd: string,
  args: string[],
  o: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv; input?: string; maxBytes?: number } = {},
): Promise<ToolResult> {
  const started = Date.now();
  const max = o.maxBytes ?? 64 * 1024 * 1024;
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: o.cwd,
      env: o.env ?? scrubbedEnv(),
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', (d: Buffer) => {
      if (stdout.length < max) stdout += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-16_000);
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, o.timeoutMs ?? 120_000);
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: redact(String(err)), ms: Date.now() - started, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr: redact(stderr), ms: Date.now() - started, timedOut });
    });
    if (o.input !== undefined) child.stdin.end(o.input);
    else child.stdin.end();
  });
}

/** `<tool> --version`-style probe. Returns the first version-looking token, or null. */
export async function probeVersion(path: string, args: string[] = ['--version']): Promise<string | null> {
  const r = await runTool(path, args, { timeoutMs: 10_000 });
  const m = /v?(\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?)/.exec(`${r.stdout}\n${r.stderr}`);
  return m ? (m[1] as string) : null;
}

/** Compare dotted versions: negative when a < b. Non-numeric parts are ignored. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
