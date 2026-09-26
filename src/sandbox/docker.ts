import { spawn, spawnSync } from 'node:child_process';
import { hostedMode, scrubbedEnv } from '../security/net-guard.js';

/**
 * MODE C — EXECUTED REPO. Running a repository's install/build/test scripts means running
 * untrusted code. In hosted mode this ONLY happens inside an ephemeral container with:
 *   no host credentials (scrubbed env, nothing mounted but the throw-away clone),
 *   a non-root user, dropped capabilities, no-new-privileges,
 *   CPU / memory / PID limits, a read-only root filesystem with a bounded /tmp,
 *   a wall-clock timeout (docker kill) and an output cap,
 *   network only for the install step (package registry), none for build/test.
 */
export interface SandboxLimits {
  cpus: number;
  memoryMb: number;
  pids: number;
  timeoutMs: number;
  outputBytes: number;
  tmpMb: number;
}

export const DEFAULT_LIMITS: SandboxLimits = {
  cpus: 2,
  memoryMb: 2048,
  pids: 256,
  timeoutMs: 600_000,
  outputBytes: 64_000,
  tmpMb: 512,
};

export const SANDBOX_IMAGE = 'node:22-bookworm-slim';

export interface SandboxStep {
  /** Command line executed with `sh -c` INSIDE the container. */
  cmd: string;
  /** Registry access (install only). Everything else runs with --network none. */
  network: boolean;
}

/** Pure: the exact `docker run` argument vector (unit-tested; no Docker needed). */
export function dockerArgs(
  workdir: string,
  step: SandboxStep,
  name: string,
  limits: SandboxLimits = DEFAULT_LIMITS,
  image = SANDBOX_IMAGE,
): string[] {
  return [
    'run',
    '--rm',
    '--name',
    name,
    '--user',
    '1000:1000',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--read-only',
    '--tmpfs',
    `/tmp:rw,noexec,nosuid,size=${limits.tmpMb}m`,
    '--tmpfs',
    `/home/node:rw,nosuid,size=${limits.tmpMb}m`,
    '--cpus',
    String(limits.cpus),
    '--memory',
    `${limits.memoryMb}m`,
    '--memory-swap',
    `${limits.memoryMb}m`,
    '--pids-limit',
    String(limits.pids),
    '--network',
    step.network ? 'bridge' : 'none',
    '--env',
    'CI=1',
    '--env',
    'HOME=/home/node',
    '--env',
    'npm_config_cache=/tmp/.npm',
    '--env',
    'npm_config_fund=false',
    '--volume',
    `${workdir}:/work:rw`,
    '--workdir',
    '/work',
    image,
    'sh',
    '-c',
    step.cmd,
  ];
}

export function dockerAvailable(): boolean {
  const r = spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], {
    encoding: 'utf8',
    timeout: 10_000,
    env: scrubbedEnv(),
  });
  return r.status === 0 && Boolean(r.stdout.trim());
}

export interface SandboxResult {
  cmd: string;
  ok: boolean;
  code: number | null;
  ms: number;
  tail: string;
  timedOut: boolean;
  truncated: boolean;
}

export function runInSandbox(
  workdir: string,
  step: SandboxStep,
  limits: SandboxLimits = DEFAULT_LIMITS,
  onLine?: (line: string) => void,
  signal?: AbortSignal,
): Promise<SandboxResult> {
  const name = `ba-sbx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn('docker', dockerArgs(workdir, step, name, limits), { env: scrubbedEnv() });
    let out = '';
    let bytes = 0;
    let truncated = false;
    let timedOut = false;
    const onData = (d: Buffer) => {
      bytes += d.length;
      if (bytes > limits.outputBytes) truncated = true;
      out = (out + d.toString()).slice(-4000);
      const last = d.toString().trim().split('\n').pop();
      if (last) onLine?.(last.slice(0, 160));
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const kill = () => spawn('docker', ['kill', name], { stdio: 'ignore', env: scrubbedEnv() });
    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, limits.timeoutMs);
    signal?.addEventListener('abort', kill, { once: true });
    const done = (code: number | null) => {
      clearTimeout(timer);
      resolve({
        cmd: step.cmd,
        ok: code === 0 && !timedOut,
        code,
        ms: Date.now() - started,
        tail: out.slice(-600),
        timedOut,
        truncated,
      });
    };
    child.on('close', done);
    child.on('error', () => done(null));
  });
}

export type ExecutionMode = 'host' | 'docker';

/**
 * Decide where repository code may run. Hosted mode never runs it on the host; a remote
 * (GitHub) repository is never run on the host either, even locally.
 */
export function executionMode(o: { requested?: ExecutionMode; remoteRepo: boolean }): ExecutionMode {
  const wantsHost = (o.requested ?? 'host') === 'host';
  if (wantsHost && hostedMode())
    throw new Error(
      'MODE C refused: hosted mode never executes repository code on the host (use --sandbox docker)',
    );
  if (wantsHost && o.remoteRepo)
    throw new Error(
      'MODE C refused: a repository fetched from a URL is untrusted code; run it with --sandbox docker, not on this machine',
    );
  return o.requested ?? 'host';
}
