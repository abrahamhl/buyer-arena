import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface ArgusFinding {
  id: string;
  title: string;
  severity: string;
  state: string;
  summary: string;
  fix: string;
}

export interface ArgusResult {
  ok: boolean;
  error?: string;
  findings: ArgusFinding[];
  target?: string;
}

/**
 * Optional integration with Argus Audit (github.com/abrahamhl/argus-audit): passive, evidence-first
 * checks of a PUBLIC website (headers, HTTPS, privacy pages, broken links, tech signals).
 * Argus refuses private/local hosts by design, so localhost targets are skipped.
 * Buyer Arena only imports Argus' zero-dependency core; nothing is installed or executed from the web.
 */
export async function runArgus(argusDir: string, url: string, timeoutMs = 90_000): Promise<ArgusResult> {
  const core = join(argusDir, 'packages', 'core', 'src', 'index.ts');
  if (!existsSync(core)) return { ok: false, error: `Argus core not found at ${core}`, findings: [] };
  let tsx: string;
  try {
    tsx = createRequire(import.meta.url).resolve('tsx/esm');
  } catch {
    return { ok: false, error: 'the Argus bridge needs "tsx" (npm i -D tsx)', findings: [] };
  }
  const dir = mkdtempSync(join(tmpdir(), 'ba-argus-'));
  const bridge = join(dir, 'bridge.mjs');
  writeFileSync(
    bridge,
    `const core = await import(${JSON.stringify(pathToFileURL(core).href)});
const res = await core.runAudit({ target: process.argv[2], transport: new core.LiveTransport() });
process.stdout.write(JSON.stringify({ target: res.target.url, findings: res.findings.map((f) => ({ id: f.findingId, title: f.title, severity: f.severity, state: f.state, summary: f.summary, fix: f.howToFix })) }));`,
  );
  try {
    const out = await new Promise<string>((resolve, reject) =>
      execFile(
        process.execPath,
        ['--import', pathToFileURL(tsx).href, bridge, url],
        { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 },
        (err, stdout, stderr) =>
          err
            ? reject(
                new Error(
                  (stderr || err.message).split('\n').filter(Boolean).slice(-2).join(' ').slice(0, 300),
                ),
              )
            : resolve(stdout),
      ),
    );
    const parsed = JSON.parse(out.slice(out.indexOf('{'))) as { target: string; findings: ArgusFinding[] };
    return { ok: true, findings: parsed.findings, target: parsed.target };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), findings: [] };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
