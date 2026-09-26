import { join } from 'node:path';
import { normalizeSeverity, type EvidenceEnvelopeV1 } from '../../evidence/envelope.js';
import { currentLedger } from '../../policy/network.js';
import { compareVersions, runTool, scrubbedEnv } from '../exec.js';
import {
  AdapterInputError,
  detectOnPath,
  isObj,
  num,
  readImportFile,
  str,
  type Integration,
  type NormalizeContext,
  type RunContext,
} from '../sdk.js';
import { adapterEvidence, ident } from './common.js';

/**
 * Trivy (https://github.com/aquasecurity/trivy, Apache-2.0). Filesystem/repo scan or import of
 * `--format json` (SchemaVersion 2).
 *
 * Supply chain: v0.69.4–v0.69.6 were malicious builds (CVE-2026-33634); they are refused.
 * Offline: under OFFLINE/LOCAL the scan uses only an already-cached vulnerability DB
 * (`--skip-db-update --offline-scan …`); the DB is downloaded only when the network policy
 * allows it. Trivy runs without Buyer Arena's credentials in its environment.
 */
export const TRIVY_COMPROMISED = ['0.69.4', '0.69.5', '0.69.6'];

export function trivyVersionProblem(v: string | null): string | null {
  if (!v) return null;
  if (TRIVY_COMPROMISED.includes(v))
    return `trivy ${v} is a known-malicious build (CVE-2026-33634): refuse and reinstall a pinned version`;
  return null;
}

export const trivy: Integration = {
  manifest: {
    id: 'trivy',
    name: 'Trivy',
    version: '1.0.0',
    status: 'supported',
    modes: ['native', 'import'],
    capabilities: ['dependencies', 'secrets', 'misconfig', 'license', 'sbom'],
    offline_safe: true,
    network_required: false,
    execution_risk: 'low',
    upstream: {
      url: 'https://github.com/aquasecurity/trivy',
      license: 'Apache-2.0',
      method: 'optional executable on PATH; JSON report import',
    },
    executables: ['trivy'],
    import_formats: ['trivy fs|repo|image --format json (SchemaVersion 2)'],
    notes:
      'Vulnerability scanning needs a DB: cached from a previous online run or pre-seeded (air-gap guide). Pin an exact version; v0.69.4–0.69.6 are refused.',
  },
  detect: () => detectOnPath(['trivy'], ['--version']),
  async doctor() {
    const d = await trivy.detect();
    const problem = trivyVersionProblem(d.version);
    return [
      { name: 'installed', ok: d.installed, detail: d.path ?? d.note ?? '' },
      {
        name: 'not a compromised build',
        ok: !problem,
        detail: problem ?? `version ${d.version ?? 'unknown'}`,
      },
      {
        name: 'recent',
        ok: d.version ? compareVersions(d.version, '0.69.7') >= 0 : false,
        detail: 'recommend ≥ 0.69.7 (after the March 2026 incident), pinned',
      },
    ];
  },
  async run(ctx: RunContext) {
    const d = await trivy.detect();
    if (!d.installed || !d.path) throw new Error('trivy is not installed (optional)');
    const problem = trivyVersionProblem(d.version);
    if (problem) throw new Error(problem);
    if (!ctx.repo) throw new Error('trivy needs --repo');
    const out = join(ctx.outDir, 'trivy.json');
    const ledger = currentLedger();
    // DB download only when the policy already allows public hosts (never escalates).
    let online = false;
    try {
      ledger.check('https://mirror.gcr.io/', 'adapter');
      online = true;
    } catch {
      online = false;
    }
    const offlineFlags = online
      ? ['--skip-version-check', '--disable-telemetry']
      : [
          '--skip-db-update',
          '--skip-java-db-update',
          '--skip-check-update',
          '--offline-scan',
          '--skip-version-check',
          '--disable-telemetry',
        ];
    const r = await runTool(
      d.path,
      [
        'fs',
        '--format',
        'json',
        '--output',
        out,
        '--scanners',
        'vuln,secret,misconfig',
        '--no-progress',
        '--quiet',
        ...offlineFlags,
        ctx.repo,
      ],
      { timeoutMs: ctx.timeoutMs ?? 600_000, env: scrubbedEnv(['TRIVY_CACHE_DIR']) },
    );
    ledger.recordAdapter('trivy', online, online ? ['mirror.gcr.io', 'ghcr.io'] : []);
    if (r.code !== 0)
      throw new Error(
        `trivy failed (exit ${r.code}): ${r.stderr.slice(-400)}${online ? '' : ' — offline scans need a cached DB (run once with --network online, or pre-seed it)'}`,
      );
    const evidence = trivy.normalize(readImportFile(out), {
      ...ctx,
      tool_version: d.version,
      offline: !online,
      network_accessed: online,
      artifact: out,
    });
    return { evidence, raw_path: out, duration_ms: r.ms, exit_code: r.code, tool_version: d.version };
  },
  normalize(text: string, ctx: NormalizeContext): EvidenceEnvelopeV1[] {
    let doc: unknown;
    try {
      doc = JSON.parse(text);
    } catch {
      throw new AdapterInputError('trivy', 'not JSON (use --format json)');
    }
    if (!isObj(doc) || !Array.isArray(doc.Results))
      throw new AdapterInputError('trivy', 'missing Results[] (expected SchemaVersion 2 JSON)');
    if (num(doc.SchemaVersion) !== undefined && doc.SchemaVersion !== 2)
      throw new AdapterInputError('trivy', `unsupported SchemaVersion ${String(doc.SchemaVersion)}`);
    const version = isObj(doc.Trivy) ? str(doc.Trivy.Version) : undefined;
    const c = {
      ...ctx,
      tool_version: ctx.tool_version ?? version ?? null,
      timestamp: ctx.timestamp ?? str(doc.CreatedAt),
    };
    const m = trivy.manifest;
    const out: EvidenceEnvelopeV1[] = [];
    for (const res of doc.Results) {
      if (!isObj(res)) continue;
      const target = ident(res.Target, 300) ?? '?';
      for (const v of Array.isArray(res.Vulnerabilities) ? res.Vulnerabilities.filter(isObj) : []) {
        const id = ident(v.VulnerabilityID) ?? 'unknown';
        out.push(
          adapterEvidence(m, c, {
            categories: ['security'],
            finding_type: `vuln.${id}`,
            title: `${ident(v.PkgName) ?? '?'} ${ident(v.InstalledVersion) ?? ''}: ${ident(v.Title, 160) ?? id}`,
            severity: normalizeSeverity(v.Severity),
            confidence: 0.9,
            claim_type: 'observed',
            passed: false,
            deterministic: true,
            location: target,
            attributes: {
              package: ident(v.PkgName),
              installed: ident(v.InstalledVersion),
              fixed: ident(v.FixedVersion),
              status: ident(v.Status),
              url: ident(v.PrimaryURL, 200),
            },
            raw: { target, id, pkg: v.PkgName ?? null, installed: v.InstalledVersion ?? null },
          }),
        );
      }
      for (const x of Array.isArray(res.Misconfigurations) ? res.Misconfigurations.filter(isObj) : []) {
        if (x.Status !== 'FAIL') continue;
        const id = ident(x.ID) ?? ident(x.AVDID) ?? 'unknown';
        out.push(
          adapterEvidence(m, c, {
            categories: ['security'],
            finding_type: `misconfig.${id}`,
            title: ident(x.Title, 160) ?? id,
            severity: normalizeSeverity(x.Severity),
            confidence: 0.85,
            claim_type: 'observed',
            passed: false,
            deterministic: true,
            location: target,
            attributes: { type: ident(x.Type), resolution: ident(x.Resolution, 200) },
            raw: { target, id },
          }),
        );
      }
      for (const s of Array.isArray(res.Secrets) ? res.Secrets.filter(isObj) : []) {
        const rule = ident(s.RuleID) ?? 'unknown';
        // `Match` and `Code` can contain the secret: never copied.
        out.push(
          adapterEvidence(m, c, {
            categories: ['security'],
            finding_type: `secret.${rule}`,
            title: ident(s.Title, 160) ?? rule,
            severity: normalizeSeverity(s.Severity),
            confidence: 0.75,
            claim_type: 'observed',
            passed: false,
            deterministic: true,
            location: `${target}:${num(s.StartLine) ?? 0}`,
            attributes: { rule, category: ident(s.Category) },
            raw: { target, rule, line: s.StartLine ?? null },
          }),
        );
      }
      for (const l of Array.isArray(res.Licenses) ? res.Licenses.filter(isObj) : []) {
        const name = ident(l.Name) ?? 'unknown';
        out.push(
          adapterEvidence(m, c, {
            categories: ['quality'],
            finding_type: `license.${name}`,
            title: `License ${name} (${ident(l.PkgName) ?? ident(l.FilePath) ?? target})`,
            severity: normalizeSeverity(l.Severity),
            confidence: num(l.Confidence) ?? 0.8,
            claim_type: 'observed',
            passed: null,
            deterministic: true,
            location: target,
            attributes: { category: ident(l.Category), package: ident(l.PkgName) },
            raw: { target, name, pkg: l.PkgName ?? null, file: l.FilePath ?? null },
          }),
        );
      }
    }
    return out;
  },
};
