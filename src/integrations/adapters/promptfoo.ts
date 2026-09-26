import { normalizeSeverity, type EvidenceEnvelopeV1 } from '../../evidence/envelope.js';
import {
  AdapterInputError,
  detectOnPath,
  isObj,
  num,
  str,
  type Integration,
  type NormalizeContext,
} from '../sdk.js';
import { adapterEvidence, ident } from './common.js';

/**
 * Promptfoo (https://github.com/promptfoo/promptfoo, MIT). Import of `promptfoo eval -o results.json`.
 * Schema: `OutputFile` in src/types/index.ts (docs/research/UPSTREAM_CONTRACTS.md §A). The docs'
 * JSON example disagrees with the type; the type is followed.
 * Prompt text, model outputs and vars are NOT copied into evidence (they can hold secrets or
 * customer data): only ids, pass/fail, scores, token usage and cost.
 */
export const promptfoo: Integration = {
  manifest: {
    id: 'promptfoo',
    name: 'Promptfoo',
    version: '1.0.0',
    status: 'supported',
    modes: ['import'],
    capabilities: ['llm-eval', 'red-team'],
    offline_safe: true,
    network_required: false,
    execution_risk: 'none',
    upstream: {
      url: 'https://github.com/promptfoo/promptfoo',
      license: 'MIT',
      method: 'import of `promptfoo eval -o results.json`',
    },
    executables: ['promptfoo'],
    import_formats: [
      'promptfoo eval -o <file>.json (OutputFile, results.version 3; V2 without per-result rows is rejected)',
    ],
    notes:
      'Run promptfoo yourself (it calls your models): `PROMPTFOO_DISABLE_TELEMETRY=1 promptfoo eval --no-share -o results.json`, then import. Treat results.json as sensitive.',
  },
  detect: () => detectOnPath(['promptfoo']),
  normalize(text: string, ctx: NormalizeContext): EvidenceEnvelopeV1[] {
    let doc: unknown;
    try {
      doc = JSON.parse(text);
    } catch {
      throw new AdapterInputError(
        'promptfoo',
        'not JSON (expected the file written by `promptfoo eval -o results.json`)',
      );
    }
    if (!isObj(doc) || !isObj(doc.results))
      throw new AdapterInputError('promptfoo', 'missing `results` object');
    const summary = doc.results;
    if (!Array.isArray(summary.results))
      throw new AdapterInputError(
        'promptfoo',
        `unsupported results format (version ${String(summary.version)}); expected results.results[]`,
      );
    const meta = isObj(doc.metadata) ? doc.metadata : {};
    const c = {
      ...ctx,
      tool_version: ctx.tool_version ?? str(meta.promptfooVersion) ?? null,
      timestamp: ctx.timestamp ?? str(summary.timestamp),
    };
    const out: EvidenceEnvelopeV1[] = [];
    for (const r of summary.results) {
      if (!isObj(r)) continue;
      const provider = isObj(r.provider) ? str(r.provider.id) : undefined;
      const tc = isObj(r.testCase) ? r.testCase : {};
      const tcMeta = isObj(tc.metadata) ? tc.metadata : {};
      const grading = isObj(r.gradingResult) ? r.gradingResult : {};
      const gMeta = isObj(grading.metadata) ? grading.metadata : {};
      const plugin = ident(tcMeta.pluginId) ?? ident(gMeta.pluginId);
      const strategy = ident(tcMeta.strategyId) ?? ident(gMeta.strategyId);
      const isError = r.failureReason === 2 || (typeof r.error === 'string' && r.error.length > 0);
      const success = r.success === true;
      const assertTypes = Array.isArray(grading.componentResults)
        ? grading.componentResults
            .map((x) => (isObj(x) && isObj(x.assertion) ? ident(x.assertion.type, 40) : null))
            .filter(Boolean)
            .join(',')
        : null;
      const usage =
        isObj(r.response) && isObj(r.response.tokenUsage)
          ? r.response.tokenUsage
          : isObj(r.tokenUsage)
            ? r.tokenUsage
            : {};
      const redteam = plugin !== null;
      const severity = isError
        ? 'low'
        : success
          ? 'info'
          : redteam
            ? normalizeSeverity(tcMeta.severity ?? 'high')
            : 'medium';
      out.push(
        adapterEvidence(promptfoo.manifest, c, {
          categories: redteam ? ['model', 'security'] : ['model'],
          target: { model: provider },
          finding_type: redteam ? `llm.redteam.${plugin}` : `llm.eval.${assertTypes || 'assertion'}`,
          title: redteam
            ? `Red-team probe ${plugin}${strategy ? ` via ${strategy}` : ''}`
            : 'Promptfoo test case',
          severity,
          confidence:
            typeof r.score === 'number' ? Math.min(1, Math.max(0, 0.5 + Math.abs(r.score - 0.5))) : 0.7,
          claim_type: 'observed',
          passed: isError ? null : success,
          deterministic: false,
          location: `prompt#${num(r.promptIdx) ?? '?'} test#${num(r.testIdx) ?? '?'}`,
          duration_ms: num(r.latencyMs) ?? null,
          usage: {
            input_tokens: num(usage.prompt) ?? 0,
            output_tokens: num(usage.completion) ?? 0,
            cached_tokens: num(usage.cached) ?? 0,
            estimated_cost_usd: num(r.cost) ?? null,
          },
          attributes: {
            score: num(r.score) ?? null,
            plugin,
            strategy,
            error: isError,
            eval_id: ident(doc.evalId),
          },
          raw: {
            evalId: doc.evalId ?? null,
            id: r.id ?? null,
            promptIdx: r.promptIdx,
            testIdx: r.testIdx,
            provider,
            success,
            score: r.score,
          },
        }),
      );
    }
    return out;
  },
};
