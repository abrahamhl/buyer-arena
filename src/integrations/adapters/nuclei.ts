import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeSeverity, type EvidenceEnvelopeV1 } from '../../evidence/envelope.js';
import { classifyHost, currentLedger } from '../../policy/network.js';
import { compareVersions, runTool, scrubbedEnv } from '../exec.js';
import {
  detectOnPath,
  isObj,
  parseJsonOrLines,
  readImportFile,
  str,
  type Integration,
  type NormalizeContext,
  type RunContext,
} from '../sdk.js';
import { adapterEvidence, ident } from './common.js';

/**
 * Nuclei (https://github.com/projectdiscovery/nuclei, MIT) — SAFE OPTIONAL SECURITY BRIDGE.
 *
 * Default: IMPORT-ONLY. Buyer Arena never scans a URL because one was supplied.
 * Active execution requires ALL of:
 *   - `--allow-active-scan` (explicit opt-in) and `--i-own-this-target` (authorisation)
 *   - a target on loopback/private network, or explicitly listed in BUYER_ARENA_NUCLEI_TARGETS
 *   - Nuclei ≥ 3.10.0 (10 advisories in nuclei itself up to 3.9.x)
 *   - a local, reviewed template directory (`--templates <dir>`); no remote template fetch
 * Always: -dut (refuse unsigned templates), -duc (no update check), -omit-raw, -ni (no
 * interactsh/OAST), never -code / -dast / -lfa / -env-vars / -headless / -file; credentials
 * are removed from its environment; -lna unless the target itself is local.
 */
export const NUCLEI_MIN_VERSION = '3.10.0';
export const NUCLEI_FORBIDDEN_FLAGS = [
  '-code',
  '-dast',
  '-lfa',
  '-allow-local-file-access',
  '-env-vars',
  '-ev',
  '-headless',
  '-file',
];

export interface NucleiRunGuard {
  allowActive?: boolean;
  authorized?: boolean;
  templates?: string;
}

export function nucleiGuard(target: string, version: string | null, g: NucleiRunGuard): string | null {
  if (!g.allowActive)
    return 'active Nuclei scans are disabled by default (import-only). Pass --allow-active-scan to opt in.';
  if (!g.authorized) return 'confirm you own or are authorised to test this target with --i-own-this-target.';
  if (!version || compareVersions(version, NUCLEI_MIN_VERSION) < 0)
    return `nuclei ${version ?? '(unknown version)'} refused: need ≥ ${NUCLEI_MIN_VERSION} (security advisories in nuclei itself).`;
  if (!g.templates || !existsSync(g.templates) || !statSync(g.templates).isDirectory())
    return 'pass --templates <dir>: a local, reviewed template set (remote templates are never fetched).';
  let host: string;
  try {
    host = new URL(target).host;
  } catch {
    return `invalid target URL ${target}`;
  }
  const allow = (process.env.BUYER_ARENA_NUCLEI_TARGETS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (classifyHost(target) === 'public' && !allow.includes(host))
    return `public target ${host} is not in BUYER_ARENA_NUCLEI_TARGETS. Buyer Arena is not an internet scanner.`;
  return null;
}

export const nuclei: Integration = {
  manifest: {
    id: 'nuclei',
    name: 'Nuclei',
    version: '1.0.0',
    status: 'experimental',
    modes: ['import', 'native'],
    capabilities: ['dast'],
    offline_safe: true,
    network_required: false,
    execution_risk: 'high',
    upstream: {
      url: 'https://github.com/projectdiscovery/nuclei',
      license: 'MIT',
      method: 'import of -jsonl output; guarded opt-in execution',
    },
    executables: ['nuclei'],
    import_formats: ['nuclei -jsonl / -jle (one ResultEvent per line) or -je (JSON array)'],
    notes: `Import-only by default. Active runs need --allow-active-scan, --i-own-this-target, a local --templates dir and nuclei ≥ ${NUCLEI_MIN_VERSION}.`,
  },
  detect: () => detectOnPath(['nuclei'], ['-version']),
  async run(ctx: RunContext & NucleiRunGuard) {
    const d = await nuclei.detect();
    if (!d.installed || !d.path) throw new Error('nuclei is not installed (optional)');
    if (!ctx.url) throw new Error('nuclei needs --url');
    const refusal = nucleiGuard(ctx.url, d.version, ctx);
    if (refusal) throw new Error(refusal);
    currentLedger().check(ctx.url, 'security-probe', { explicit: true });
    const out = join(ctx.outDir, 'nuclei.jsonl');
    const local = classifyHost(ctx.url) !== 'public';
    const args = [
      '-u',
      ctx.url,
      '-t',
      ctx.templates as string,
      '-jsonl',
      '-o',
      out,
      '-silent',
      '-nc',
      '-duc',
      '-dut',
      '-omit-raw',
      '-omit-template',
      '-ni',
      '-rl',
      '20',
    ];
    if (!local) args.push('-lna');
    if (args.some((a) => NUCLEI_FORBIDDEN_FLAGS.includes(a)))
      throw new Error('internal: forbidden nuclei flag');
    const r = await runTool(d.path, args, { timeoutMs: ctx.timeoutMs ?? 900_000, env: scrubbedEnv() });
    currentLedger().recordAdapter('nuclei', true, [new URL(ctx.url).host]);
    if (r.code !== 0) throw new Error(`nuclei failed (exit ${r.code}): ${r.stderr.slice(-300)}`);
    const text = existsSync(out) ? readImportFile(out) : '';
    const evidence = text.trim()
      ? nuclei.normalize(text, {
          ...ctx,
          tool_version: d.version,
          offline: local,
          network_accessed: true,
          artifact: out,
        })
      : [];
    return { evidence, raw_path: out, duration_ms: r.ms, exit_code: r.code, tool_version: d.version };
  },
  normalize(text: string, ctx: NormalizeContext): EvidenceEnvelopeV1[] {
    const { records } = parseJsonOrLines('nuclei', text);
    return records.filter(isObj).map((e) => {
      const info = isObj(e.info) ? e.info : {};
      const id = ident(e['template-id']) ?? 'unknown';
      const matched = ident(e['matched-at'], 300) ?? ident(e.host, 300) ?? '?';
      return adapterEvidence(nuclei.manifest, ctx, {
        categories: ['security'],
        target: { url: ident(e.host, 300) ?? undefined },
        finding_type: `dast.${id}`,
        title: ident(info.name, 160) ?? id,
        severity: normalizeSeverity(info.severity),
        confidence: 0.7,
        claim_type: 'observed',
        passed: false,
        deterministic: true,
        location: matched,
        attributes: {
          template: id,
          matcher: ident(e['matcher-name']),
          protocol: ident(e.type),
          tags: Array.isArray(info.tags)
            ? info.tags
                .filter((t) => typeof t === 'string')
                .join(',')
                .slice(0, 120)
            : null,
        },
        raw: { id, matched, matcher: e['matcher-name'] ?? null, ts: str(e.timestamp) ?? null },
      });
    });
  },
};
