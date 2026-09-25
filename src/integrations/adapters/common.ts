import { makeEvidence, type EvidenceEnvelopeV1, type EvidenceInput } from '../../evidence/envelope.js';
import type { IntegrationManifest, NormalizeContext } from '../sdk.js';

type Partial = Omit<
  EvidenceInput,
  | 'id'
  | 'schema_version'
  | 'raw_digest'
  | 'source'
  | 'source_kind'
  | 'provenance'
  | 'offline'
  | 'network_accessed'
  | 'source_version'
> & { raw: unknown };

/** Build an envelope with the fields every adapter sets the same way. */
export function adapterEvidence(
  m: IntegrationManifest,
  ctx: NormalizeContext,
  p: Partial,
): EvidenceEnvelopeV1 {
  return makeEvidence({
    ...p,
    source: m.id,
    source_version: ctx.tool_version ?? null,
    source_kind: m.modes.includes('import') ? 'import' : m.modes[0] === 'otel' ? 'otel' : 'native',
    target: { ...ctx.target, ...(p.target ?? {}) },
    offline: ctx.offline ?? false,
    network_accessed: ctx.network_accessed ?? false,
    artifact_refs: ctx.artifact ? [ctx.artifact, ...(p.artifact_refs ?? [])] : p.artifact_refs,
    provenance: {
      tool: m.id,
      version: ctx.tool_version ?? null,
      config_digest: (ctx.config_digest as `sha256:${string}` | null | undefined) ?? null,
      timestamp: ctx.timestamp ?? new Date().toISOString(),
    },
  });
}

/** Keep short identifiers only (rule ids, probe names); never free text from tool output. */
export const ident = (v: unknown, max = 120): string | null =>
  typeof v === 'string' && v.length ? v.replace(/[\r\n\t]/g, ' ').slice(0, max) : null;
