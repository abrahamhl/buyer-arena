import type { EvidenceEnvelopeV1 } from '../../evidence/envelope.js';
import {
  AdapterInputError,
  importOnly,
  isObj,
  num,
  parseJsonOrLines,
  str,
  type Integration,
  type NormalizeContext,
} from '../sdk.js';
import { adapterEvidence, ident } from './common.js';

/**
 * Priority-B adapters: import contracts with fixtures (docs/research/UPSTREAM_CONTRACTS.md §K).
 * None of these tools is installed or executed by Buyer Arena.
 */

/* ── DeepEval (Apache-2.0): .deepeval/.latest_run_full.json or test_run_*.json (camelCase) ── */
export const deepeval: Integration = {
  manifest: {
    id: 'deepeval',
    name: 'DeepEval',
    version: '0.1.0',
    status: 'adapter',
    modes: ['import'],
    capabilities: ['llm-eval'],
    offline_safe: true,
    network_required: false,
    execution_risk: 'none',
    upstream: {
      url: 'https://github.com/confident-ai/deepeval',
      license: 'Apache-2.0',
      method: 'import of a TestRun JSON file',
    },
    import_formats: ['.deepeval/.latest_run_full.json or test_run_<ts>.json (TestRun, camelCase keys)'],
  },
  detect: importOnly,
  normalize(text: string, ctx: NormalizeContext): EvidenceEnvelopeV1[] {
    const doc = JSON.parse(text) as unknown;
    const run = isObj(doc) && isObj(doc.testRunData) ? doc.testRunData : doc;
    if (!isObj(run) || !Array.isArray(run.testCases))
      throw new AdapterInputError('deepeval', 'expected a TestRun with testCases[]');
    const out: EvidenceEnvelopeV1[] = [];
    for (const tc of run.testCases.filter(isObj)) {
      for (const m of Array.isArray(tc.metricsData) ? tc.metricsData.filter(isObj) : []) {
        const name = ident(m.name) ?? 'metric';
        const errored = typeof m.error === 'string' && m.error.length > 0;
        out.push(
          adapterEvidence(deepeval.manifest, ctx, {
            categories: ['model'],
            target: { model: ident(m.evaluationModel) ?? undefined },
            finding_type: `llm.eval.${name.toLowerCase().replace(/\s+/g, '-')}`,
            title: `${name} on ${ident(tc.name) ?? 'test case'}`,
            severity: errored ? 'low' : m.success === false ? 'medium' : 'info',
            confidence: 0.6,
            claim_type: 'observed',
            passed: errored ? null : m.success === true,
            deterministic: false,
            location: ident(tc.name) ?? undefined,
            usage: {
              input_tokens: num(m.inputTokenCount) ?? 0,
              output_tokens: num(m.outputTokenCount) ?? 0,
              cached_tokens: 0,
              estimated_cost_usd: num(m.evaluationCost) ?? null,
            },
            attributes: {
              score: num(m.score) ?? null,
              threshold: num(m.threshold) ?? null,
              judge: ident(m.evaluationModel),
            },
            raw: { tc: tc.name ?? null, metric: name, score: m.score ?? null, success: m.success ?? null },
          }),
        );
      }
    }
    return out;
  },
};

/* ── Inspect AI (MIT): EvalLog JSON (`--log-format=json`, or `inspect log dump file.eval`) ── */
export const inspectAi: Integration = {
  manifest: {
    id: 'inspect-ai',
    name: 'Inspect AI',
    version: '0.1.0',
    status: 'adapter',
    modes: ['import'],
    capabilities: ['llm-eval', 'benchmark'],
    offline_safe: true,
    network_required: false,
    execution_risk: 'none',
    upstream: {
      url: 'https://github.com/UKGovernmentBEIS/inspect_ai',
      license: 'MIT',
      method: 'import of EvalLog JSON',
    },
    import_formats: [
      'EvalLog JSON: `--log-format=json`, or convert a .eval file with `inspect log dump <file>`',
    ],
  },
  detect: importOnly,
  normalize(text: string, ctx: NormalizeContext): EvidenceEnvelopeV1[] {
    let doc: unknown;
    try {
      doc = JSON.parse(text);
    } catch {
      throw new AdapterInputError(
        'inspect-ai',
        'not JSON: convert .eval logs with `inspect log dump <file> > log.json`',
      );
    }
    if (!isObj(doc) || !isObj(doc.eval))
      throw new AdapterInputError('inspect-ai', 'expected an EvalLog with `eval`');
    const spec = doc.eval;
    const model = str(spec.model);
    const usage = isObj(doc.stats) && isObj(doc.stats.model_usage) ? doc.stats.model_usage : {};
    const u = model && isObj(usage[model]) ? (usage[model] as Record<string, unknown>) : {};
    const scores =
      isObj(doc.results) && Array.isArray(doc.results.scores) ? doc.results.scores.filter(isObj) : [];
    const c = { ...ctx, timestamp: ctx.timestamp ?? str(spec.created) };
    const out: EvidenceEnvelopeV1[] = [];
    for (const s of scores) {
      const metrics = isObj(s.metrics) ? s.metrics : {};
      for (const [mname, mv] of Object.entries(metrics)) {
        if (!isObj(mv) || /stderr/i.test(mname)) continue;
        const stderr = Object.entries(metrics).find(([k]) => /stderr/i.test(k))?.[1];
        out.push(
          adapterEvidence(inspectAi.manifest, c, {
            categories: ['model'],
            target: { model, run: ident(spec.run_id) ?? undefined },
            finding_type: `benchmark.${ident(spec.task) ?? 'task'}.${mname}`,
            title: `${ident(spec.task) ?? 'task'} ${ident(s.name) ?? ''} ${mname}`,
            severity: doc.status === 'success' ? 'info' : 'low',
            confidence: 0.8,
            claim_type: 'observed',
            passed: null,
            deterministic: false,
            usage: {
              input_tokens: num(u.input_tokens) ?? 0,
              output_tokens: num(u.output_tokens) ?? 0,
              cached_tokens: num(u.input_tokens_cache_read) ?? 0,
              estimated_cost_usd: num(u.total_cost) ?? null,
            },
            attributes: {
              value: num(mv.value) ?? null,
              stderr: isObj(stderr) ? (num(stderr.value) ?? null) : null,
              status: ident(doc.status),
              samples: isObj(doc.results) ? (num(doc.results.completed_samples) ?? null) : null,
            },
            raw: {
              run: spec.run_id ?? null,
              task: spec.task ?? null,
              score: s.name ?? null,
              metric: mname,
              value: mv.value ?? null,
            },
          }),
        );
      }
    }
    return out;
  },
};

/* ── lm-evaluation-harness (MIT): results_<date>.json ── */
export const lmEval: Integration = {
  manifest: {
    id: 'lm-eval',
    name: 'lm-evaluation-harness',
    version: '0.1.0',
    status: 'adapter',
    modes: ['import'],
    capabilities: ['benchmark'],
    offline_safe: true,
    network_required: false,
    execution_risk: 'none',
    upstream: {
      url: 'https://github.com/EleutherAI/lm-evaluation-harness',
      license: 'MIT',
      method: 'import of results_<date>.json',
    },
    import_formats: ['results_<date_id>.json written by `lm-eval run --output_path`'],
  },
  detect: importOnly,
  normalize(text: string, ctx: NormalizeContext): EvidenceEnvelopeV1[] {
    const doc = JSON.parse(text) as unknown;
    if (!isObj(doc) || !isObj(doc.results))
      throw new AdapterInputError('lm-eval', 'expected `results` keyed by task');
    const model =
      ident(doc.model_name) ?? (isObj(doc.config) ? ident(doc.config.model_args, 200) : null) ?? undefined;
    const c = {
      ...ctx,
      tool_version: ctx.tool_version ?? str(doc.lm_eval_version) ?? null,
      timestamp:
        ctx.timestamp ?? (num(doc.date) ? new Date((doc.date as number) * 1000).toISOString() : undefined),
    };
    const out: EvidenceEnvelopeV1[] = [];
    for (const [task, metrics] of Object.entries(doc.results)) {
      if (!isObj(metrics)) continue;
      for (const [key, value] of Object.entries(metrics)) {
        if (typeof value !== 'number' || key.includes('_stderr')) continue;
        const [metric, filter = 'none'] = key.split(',');
        const stderr = metrics[`${metric}_stderr,${filter}`];
        out.push(
          adapterEvidence(lmEval.manifest, c, {
            categories: ['model'],
            target: { model },
            finding_type: `benchmark.${ident(task)}.${metric}`,
            title: `${task} ${metric} (${filter})`,
            severity: 'info',
            confidence: 0.8,
            claim_type: 'observed',
            passed: null,
            deterministic: true,
            attributes: {
              value,
              stderr: typeof stderr === 'number' ? stderr : null,
              filter,
              n_shot: isObj(doc['n-shot']) ? (num(doc['n-shot'][task]) ?? null) : null,
              git_hash: ident(doc.git_hash, 40),
            },
            raw: { task, key, value, git: doc.git_hash ?? null },
          }),
        );
      }
    }
    return out;
  },
};

/* ── PyRIT (MIT): CONTRACT ONLY. No upstream file export exists (verified 2026-09-25). ── */
export const pyrit: Integration = {
  manifest: {
    id: 'pyrit',
    name: 'PyRIT',
    version: '0.1.0',
    status: 'experimental',
    modes: ['import'],
    capabilities: ['red-team'],
    offline_safe: true,
    network_required: false,
    execution_risk: 'none',
    upstream: {
      url: 'https://github.com/microsoft/PyRIT',
      license: 'MIT',
      method: 'import of AttackResult JSON Lines (dumped by your script)',
    },
    import_formats: [
      'JSON Lines of pydantic `AttackResult.model_dump_json()` (Buyer Arena contract; PyRIT has no official export)',
    ],
    notes:
      'PyRIT stores results in SQLite; dump AttackResult objects yourself. The field mapping follows pyrit/models/results/attack_result.py.',
  },
  detect: importOnly,
  normalize(text: string, ctx: NormalizeContext): EvidenceEnvelopeV1[] {
    const { records } = parseJsonOrLines('pyrit', text);
    return records.filter(isObj).map((r) => {
      const outcome = ident(r.outcome) ?? 'undetermined';
      return adapterEvidence(pyrit.manifest, ctx, {
        categories: ['model', 'security'],
        finding_type: `llm.redteam.${(Array.isArray(r.targeted_harm_categories) && ident(r.targeted_harm_categories[0])) || 'objective'}`,
        title: `PyRIT attack ${outcome}`,
        // "success" = the attack achieved its objective against the target.
        severity: outcome === 'success' ? 'high' : outcome === 'error' ? 'low' : 'info',
        confidence: 0.6,
        claim_type: 'observed',
        passed: outcome === 'success' ? false : outcome === 'failure' ? true : null,
        deterministic: false,
        duration_ms: num(r.execution_time_ms) ?? null,
        attributes: { outcome, turns: num(r.executed_turns) ?? null, conversation: ident(r.conversation_id) },
        raw: { id: r.attack_result_id ?? r.conversation_id ?? null, outcome },
      });
    });
  },
};

/* ── OpenTelemetry (Langfuse, Phoenix and any OTLP backend): OTLP/JSON trace import ── */
type OtlpAttr = {
  key?: string;
  value?: { stringValue?: string; intValue?: string | number; doubleValue?: number; boolValue?: boolean };
};
const attrs = (list: unknown): Record<string, string | number | boolean> => {
  const out: Record<string, string | number | boolean> = {};
  for (const a of Array.isArray(list) ? (list as OtlpAttr[]) : []) {
    if (!a?.key || !a.value) continue;
    const v = a.value;
    const val =
      v.stringValue ??
      (v.intValue !== undefined ? Number(v.intValue) : undefined) ??
      v.doubleValue ??
      v.boolValue;
    if (val !== undefined) out[a.key] = val;
  }
  return out;
};

export const otel: Integration = {
  manifest: {
    id: 'otel',
    name: 'OpenTelemetry GenAI traces',
    version: '0.1.0',
    status: 'adapter',
    modes: ['otel', 'import'],
    capabilities: ['traces'],
    offline_safe: true,
    network_required: false,
    execution_risk: 'none',
    upstream: {
      url: 'https://github.com/open-telemetry/semantic-conventions-genai',
      license: 'Apache-2.0',
      method:
        'import of OTLP/JSON traces (gen_ai.* and OpenInference llm.* attributes); portable to Langfuse (MIT core) and Phoenix (ELv2)',
    },
    import_formats: ['OTLP/JSON `{ resourceSpans: [ { scopeSpans: [ { spans: [...] } ] } ] }`'],
    notes:
      'Buyer Arena reads portable trace attributes only; it does not depend on Langfuse or Phoenix internals.',
  },
  detect: importOnly,
  normalize(text: string, ctx: NormalizeContext): EvidenceEnvelopeV1[] {
    const { records } = parseJsonOrLines('otel', text);
    const out: EvidenceEnvelopeV1[] = [];
    for (const doc of records.filter(isObj)) {
      for (const rs of Array.isArray(doc.resourceSpans) ? doc.resourceSpans.filter(isObj) : []) {
        for (const ss of Array.isArray(rs.scopeSpans) ? rs.scopeSpans.filter(isObj) : []) {
          for (const sp of Array.isArray(ss.spans) ? ss.spans.filter(isObj) : []) {
            const a = attrs(sp.attributes);
            const model = String(
              a['gen_ai.response.model'] ?? a['gen_ai.request.model'] ?? a['llm.model_name'] ?? '',
            );
            if (!model) continue; // not an LLM span
            const provider = String(
              a['gen_ai.provider.name'] ?? a['gen_ai.system'] ?? a['llm.provider'] ?? '',
            );
            const inTok = Number(a['gen_ai.usage.input_tokens'] ?? a['llm.token_count.prompt'] ?? 0);
            const outTok = Number(a['gen_ai.usage.output_tokens'] ?? a['llm.token_count.completion'] ?? 0);
            const cached = Number(
              a['gen_ai.usage.cache_read.input_tokens'] ??
                a['llm.token_count.prompt_details.cache_read'] ??
                0,
            );
            const cost = a['llm.cost.total'] ?? a['gen_ai.usage.cost'];
            const start = Number(sp.startTimeUnixNano ?? 0);
            const end = Number(sp.endTimeUnixNano ?? 0);
            const status = isObj(sp.status) ? num(sp.status.code) : undefined;
            out.push(
              adapterEvidence(otel.manifest, ctx, {
                categories: ['observability', 'model'],
                target: { model: provider ? `${provider}:${model}` : model },
                finding_type: `trace.llm.${String(a['gen_ai.operation.name'] ?? a['openinference.span.kind'] ?? 'call').toLowerCase()}`,
                title: ident(sp.name) ?? 'LLM span',
                severity: status === 2 ? 'low' : 'info',
                confidence: 1,
                claim_type: 'observed',
                passed: status === 2 ? false : null,
                deterministic: false,
                duration_ms: start && end ? Math.round((end - start) / 1e6) : null,
                usage: {
                  input_tokens: inTok,
                  output_tokens: outTok,
                  cached_tokens: cached,
                  estimated_cost_usd: typeof cost === 'number' ? cost : null,
                },
                attributes: {
                  trace: ident(sp.traceId, 64),
                  span: ident(sp.spanId, 32),
                  provider: provider || null,
                },
                raw: { trace: sp.traceId ?? null, span: sp.spanId ?? null },
              }),
            );
          }
        }
      }
    }
    return out;
  },
};
