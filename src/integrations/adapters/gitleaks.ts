import { join } from 'node:path';
import { secretFingerprint } from '../../core/redact.js';
import type { EvidenceEnvelopeV1 } from '../../evidence/envelope.js';
import { runTool, scrubbedEnv } from '../exec.js';
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
 * Gitleaks (https://github.com/gitleaks/gitleaks, MIT). Local repository only.
 * Secret VALUES never enter Buyer Arena evidence: `Secret`, `Match`, `Author`, `Email` and
 * `Message` are dropped; a 12-hex fingerprint lets duplicates be correlated.
 * Runs with `--redact` so even gitleaks' own report file holds no plaintext secret.
 */
export const gitleaks: Integration = {
  manifest: {
    id: 'gitleaks',
    name: 'Gitleaks',
    version: '1.0.0',
    status: 'supported',
    modes: ['native', 'import'],
    capabilities: ['secrets'],
    offline_safe: true,
    network_required: false,
    execution_risk: 'low',
    upstream: {
      url: 'https://github.com/gitleaks/gitleaks',
      license: 'MIT',
      method: 'optional executable on PATH; JSON report import',
    },
    executables: ['gitleaks'],
    import_formats: ['gitleaks --report-format json (array of Finding)'],
    notes:
      'run = `gitleaks dir <repo> --report-format json --redact --no-banner --no-color --exit-code 2` (dir mode: no commit author PII).',
  },
  detect: () => detectOnPath(['gitleaks'], ['version']),
  async run(ctx: RunContext) {
    const d = await gitleaks.detect();
    if (!d.installed || !d.path) throw new Error('gitleaks is not installed (optional)');
    if (!ctx.repo) throw new Error('gitleaks needs --repo');
    const out = join(ctx.outDir, 'gitleaks.json');
    const r = await runTool(
      d.path,
      [
        'dir',
        ctx.repo,
        '--report-format',
        'json',
        '--report-path',
        out,
        '--redact',
        '--no-banner',
        '--no-color',
        '--exit-code',
        '2',
      ],
      { timeoutMs: ctx.timeoutMs ?? 300_000, env: scrubbedEnv() },
    );
    // 0 = no leaks, 2 = leaks (our --exit-code), anything else = tool error.
    if (r.code !== 0 && r.code !== 2)
      throw new Error(`gitleaks failed (exit ${r.code}): ${r.stderr.slice(-300)}`);
    const evidence = gitleaks.normalize(readImportFile(out), {
      ...ctx,
      tool_version: d.version,
      offline: true,
      network_accessed: false,
      artifact: out,
    });
    return { evidence, raw_path: out, duration_ms: r.ms, exit_code: r.code, tool_version: d.version };
  },
  normalize(text: string, ctx: NormalizeContext): EvidenceEnvelopeV1[] {
    let doc: unknown;
    try {
      doc = JSON.parse(text || '[]');
    } catch {
      throw new AdapterInputError('gitleaks', 'not JSON (use --report-format json)');
    }
    if (!Array.isArray(doc)) throw new AdapterInputError('gitleaks', 'expected a JSON array of findings');
    return doc.filter(isObj).map((f) => {
      const secret = str(f.Secret);
      const rule = ident(f.RuleID) ?? 'unknown';
      const file = ident(f.File, 300) ?? '?';
      const line = num(f.StartLine) ?? 0;
      const fp =
        secret && secret !== 'REDACTED'
          ? secretFingerprint(secret)
          : ident(f.Fingerprint)
            ? secretFingerprint(String(f.Fingerprint))
            : null;
      return adapterEvidence(gitleaks.manifest, ctx, {
        categories: ['security'],
        finding_type: `secret.${rule}`,
        title: `Possible secret (${rule})`,
        severity: 'critical',
        confidence: 0.7,
        claim_type: 'observed',
        passed: false,
        deterministic: true,
        location: `${file}:${line}`,
        attributes: {
          rule,
          fingerprint: fp,
          commit: ident(f.Commit, 40),
          entropy: num(f.Entropy) ?? null,
          tags: Array.isArray(f.Tags)
            ? f.Tags.filter((t) => typeof t === 'string')
                .join(',')
                .slice(0, 120)
            : null,
        },
        // Digest of the location only, never of secret-bearing fields.
        raw: { rule, file, line, commit: f.Commit ?? null, fp },
      });
    });
  },
};
