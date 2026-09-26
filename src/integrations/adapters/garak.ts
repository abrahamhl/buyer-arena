import type { EvidenceEnvelopeV1, EvidenceSeverity } from '../../evidence/envelope.js';
import { findExecutable } from '../exec.js';
import {
  AdapterInputError,
  isObj,
  num,
  parseJsonOrLines,
  str,
  type Integration,
  type NormalizeContext,
} from '../sdk.js';
import { adapterEvidence, ident } from './common.js';

/**
 * garak (https://github.com/NVIDIA/garak, Apache-2.0). Import of `<prefix>.report.jsonl`.
 * One envelope per `eval` entry (probe × detector). `passed` in garak counts SAFE outputs;
 * attack success rate = fails / total_evaluated. Attempt prompts/outputs are never copied.
 */
export function severityFromAsr(asr: number): EvidenceSeverity {
  if (asr >= 0.5) return 'high';
  if (asr >= 0.1) return 'medium';
  if (asr > 0) return 'low';
  return 'info';
}

export const garak: Integration = {
  manifest: {
    id: 'garak',
    name: 'garak',
    version: '1.0.0',
    status: 'supported',
    modes: ['import', 'sidecar'],
    capabilities: ['red-team', 'llm-eval'],
    offline_safe: true,
    network_required: false,
    execution_risk: 'none',
    upstream: {
      url: 'https://github.com/NVIDIA/garak',
      license: 'Apache-2.0',
      method: 'import of report.jsonl (run garak yourself)',
    },
    executables: ['garak'],
    import_formats: [
      'garak report JSONL (`--report_prefix <p>` → <p>.report.jsonl): entry_type start_run setup / init / eval',
    ],
    notes:
      'Run: `python -m garak --target_type <generator> --target_name <model> --spec probes.promptinject --report_prefix ba` (keys via env vars, never in the YAML config: garak may write config into the report).',
  },
  async detect() {
    const path = findExecutable(['garak']);
    return path
      ? {
          installed: true,
          path,
          version: null,
          note: 'garak CLI found (version not probed: import is the supported mode)',
        }
      : {
          installed: false,
          version: null,
          note: 'import-only: reads report.jsonl files garak already wrote',
        };
  },
  normalize(text: string, ctx: NormalizeContext): EvidenceEnvelopeV1[] {
    const { records } = parseJsonOrLines('garak', text);
    let model: string | undefined;
    let version: string | undefined;
    let started: string | undefined;
    let runId: string | undefined;
    const evals: Record<string, unknown>[] = [];
    for (const r of records) {
      if (!isObj(r)) continue;
      if (r.entry_type === 'start_run setup') {
        const t = str(r['plugins.target_type']) ?? str(r['plugins.model_type']);
        const n = str(r['plugins.target_name']) ?? str(r['plugins.model_name']);
        model = [t, n].filter(Boolean).join(':') || undefined;
      } else if (r.entry_type === 'init') {
        version = str(r.garak_version);
        started = str(r.start_time);
        runId = str(r.run);
      } else if (r.entry_type === 'eval') evals.push(r);
    }
    if (!evals.length && !version)
      throw new AdapterInputError(
        'garak',
        'no garak entries (expected entry_type records from report.jsonl)',
      );
    const c = {
      ...ctx,
      tool_version: ctx.tool_version ?? version ?? null,
      timestamp: ctx.timestamp ?? started,
    };
    return evals.map((e) => {
      const fails = num(e.fails) ?? 0;
      const total = num(e.total_evaluated) ?? (num(e.passed) ?? 0) + fails;
      const asr = total > 0 ? fails / total : 0;
      const lo = num(e.confidence_lower);
      const hi = num(e.confidence_upper);
      const probe = ident(e.probe) ?? 'unknown';
      const detector = ident(e.detector) ?? 'unknown';
      return adapterEvidence(garak.manifest, c, {
        categories: ['model', 'security'],
        target: { model },
        finding_type: `llm.vuln.${probe}`,
        title: `garak ${probe} × ${detector}: ${fails}/${total} outputs hit`,
        severity: severityFromAsr(asr),
        // Width of garak's bootstrap interval when present; otherwise a fixed prior.
        confidence: lo !== undefined && hi !== undefined ? Math.max(0.05, Math.min(1, 1 - (hi - lo))) : 0.7,
        claim_type: 'observed',
        passed: total > 0 ? fails === 0 : null,
        deterministic: false,
        location: `${probe}/${detector}`,
        attributes: {
          probe,
          detector,
          fails,
          passed_outputs: num(e.passed) ?? null,
          nones: num(e.nones) ?? null,
          total_evaluated: total,
          attack_success_rate: Math.round(asr * 10_000) / 10_000,
          confidence_lower: lo ?? null,
          confidence_upper: hi ?? null,
          run: runId ?? null,
        },
        raw: { run: runId ?? null, probe, detector, fails, total },
      });
    });
  },
};
