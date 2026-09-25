import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

/**
 * Buyer Arena Evidence Protocol v1.
 *
 * One normalised record per observation, whatever produced it: a built-in panel, a browser
 * engine, Promptfoo, garak, Gitleaks, Trivy… Raw third-party output is NOT embedded: an
 * envelope carries a content digest of it and, optionally, where the raw artifact lives.
 *
 * Stability: fields in v1 are append-only. A consumer must ignore unknown fields. Removing
 * or changing the meaning of a field requires `schema_version: "2"` and a migration.
 */
export const EVIDENCE_SCHEMA_VERSION = '1' as const;

export const EvidenceCategory = z.enum([
  'product',
  'browser',
  'model',
  'agent',
  'security',
  'quality',
  'accessibility',
  'performance',
  'observability',
]);
export type EvidenceCategory = z.infer<typeof EvidenceCategory>;

export const EvidenceSeverity = z.enum(['info', 'low', 'medium', 'high', 'critical']);
export type EvidenceSeverity = z.infer<typeof EvidenceSeverity>;

/** observed = a tool measured it · inferred = derived from observations · hypothesis = to test. */
export const ClaimType = z.enum(['observed', 'inferred', 'hypothesis']);
export type ClaimType = z.infer<typeof ClaimType>;

export const SourceKind = z.enum(['builtin', 'native', 'sidecar', 'import', 'otel']);
export type SourceKind = z.infer<typeof SourceKind>;

const Sha256 = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const EvidenceEnvelopeV1Schema = z.object({
  id: z.string().min(1),
  schema_version: z.literal(EVIDENCE_SCHEMA_VERSION),
  /** Integration id that produced it, e.g. "gitleaks", "promptfoo", "buyer-arena.users". */
  source: z.string().min(1),
  source_version: z.string().nullable(),
  source_kind: SourceKind,
  categories: z.array(EvidenceCategory).min(1),
  target: z
    .object({
      repo: z.string().optional(),
      commit: z.string().optional(),
      url: z.string().optional(),
      run: z.string().optional(),
      model: z.string().optional(),
      agent: z.string().optional(),
    })
    .default({}),
  /** Stable machine id of the finding kind, e.g. "secret.aws-access-token", "llm.prompt-injection". */
  finding_type: z.string().min(1),
  title: z.string().optional(),
  severity: EvidenceSeverity,
  /** 0..1 — how sure the SOURCE is. Not a calibrated probability unless `calibrated` says so. */
  confidence: z.number().min(0).max(1),
  claim_type: ClaimType,
  /** Did this pass? null when the evidence is not a pass/fail test. */
  passed: z.boolean().nullable().default(null),
  deterministic: z.boolean(),
  offline: z.boolean(),
  network_accessed: z.boolean(),
  /** Pointers into other evidence (event ids like "candidate-p-004:e12", envelope ids). */
  evidence_refs: z.array(z.string()).default([]),
  /** Local paths or URIs of raw artifacts (never inlined). */
  artifact_refs: z.array(z.string()).default([]),
  /** Location inside the target (file:line, URL, probe…). Secrets are never stored here. */
  location: z.string().optional(),
  duration_ms: z.number().nonnegative().nullable().default(null),
  usage: z
    .object({
      input_tokens: z.number().nonnegative().default(0),
      output_tokens: z.number().nonnegative().default(0),
      cached_tokens: z.number().nonnegative().default(0),
      estimated_cost_usd: z.number().nonnegative().nullable().default(null),
    })
    .nullable()
    .default(null),
  provenance: z.object({
    tool: z.string(),
    version: z.string().nullable(),
    /** Digest of the tool configuration that produced it (flags, config file, template set). */
    config_digest: Sha256.nullable(),
    timestamp: z.string(),
  }),
  /** Digest of the raw record this envelope was normalised from. */
  raw_digest: Sha256.nullable(),
  /** Small, redacted, source-specific details (probe name, rule id…). Never raw output. */
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
});
export type EvidenceEnvelopeV1 = z.infer<typeof EvidenceEnvelopeV1Schema>;
export type EvidenceInput = z.input<typeof EvidenceEnvelopeV1Schema>;

export function sha256(data: string | Buffer): string {
  return `sha256:${createHash('sha256').update(data).digest('hex')}`;
}

/** Deterministic JSON (sorted keys) so digests do not depend on key order. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
    .join(',')}}`;
}

export const digestOf = (v: unknown): string => sha256(typeof v === 'string' ? v : canonicalJson(v));

/**
 * Build a validated envelope. The id is content-addressed when `raw` is given (the same raw
 * record from the same source always yields the same id, which makes imports idempotent).
 */
export function makeEvidence(
  input: Omit<EvidenceInput, 'id' | 'schema_version' | 'raw_digest'> & { id?: string; raw?: unknown },
): EvidenceEnvelopeV1 {
  const { raw, id, ...rest } = input;
  const raw_digest = raw === undefined ? null : digestOf(raw);
  const envId =
    id ??
    (raw_digest
      ? `${input.source}:${raw_digest.slice(7, 23)}`
      : `${input.source}:${randomUUID().slice(0, 18)}`);
  return EvidenceEnvelopeV1Schema.parse({ ...rest, id: envId, schema_version: '1', raw_digest });
}

/** Map heterogeneous upstream severities onto the protocol scale. Unknown → info. */
export function normalizeSeverity(s: unknown): EvidenceSeverity {
  const v = String(s ?? '')
    .trim()
    .toLowerCase();
  if (['critical', 'crit', 'blocker', 'fatal'].includes(v)) return 'critical';
  if (['high', 'error', 'major', 'severe'].includes(v)) return 'high';
  if (['medium', 'moderate', 'warning', 'warn'].includes(v)) return 'medium';
  if (['low', 'minor', 'note'].includes(v)) return 'low';
  return 'info';
}

export const SEVERITY_RANK: Record<EvidenceSeverity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export interface EvidenceSummary {
  total: number;
  by_severity: Record<EvidenceSeverity, number>;
  by_source: Record<string, number>;
  failed: number;
  passed: number;
}

export function summarizeEvidence(list: EvidenceEnvelopeV1[]): EvidenceSummary {
  const by_severity: Record<EvidenceSeverity, number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
  const by_source: Record<string, number> = {};
  let failed = 0;
  let passed = 0;
  for (const e of list) {
    by_severity[e.severity]++;
    by_source[e.source] = (by_source[e.source] ?? 0) + 1;
    if (e.passed === false) failed++;
    if (e.passed === true) passed++;
  }
  return { total: list.length, by_severity, by_source, failed, passed };
}
