import type { Analysis } from '../analysis.js';
import type { LaunchReport } from '../launch.js';
import type { PanelId } from '../panels/types.js';
import {
  makeEvidence,
  normalizeSeverity,
  type EvidenceCategory,
  type EvidenceEnvelopeV1,
} from './envelope.js';

const CONF = { low: 0.35, medium: 0.6, high: 0.85 } as const;
const PANEL_CATEGORY: Record<PanelId, EvidenceCategory[]> = {
  users: ['product', 'browser'],
  developers: ['quality'],
  commercial: ['product'],
  security: ['security'],
  segments: ['accessibility', 'performance'],
};

/** Consensus findings of a buyer session → EvidenceEnvelopeV1 (source `buyer-arena.auditors`). */
export function analysisToEvidence(a: Analysis, version: string | null = null): EvidenceEnvelopeV1[] {
  const out: EvidenceEnvelopeV1[] = [];
  const network = a.session.network;
  const offline = network ? network.stayed_local : true;
  for (const [variant, audit] of Object.entries(a.audits)) {
    const url = a.session.variants.find((v) => v.name === variant)?.url;
    for (const item of audit.consensus) {
      out.push(
        makeEvidence({
          source: 'buyer-arena.auditors',
          source_version: version,
          source_kind: 'builtin',
          categories: ['product', 'browser'],
          target: { url, run: a.session.session_id },
          finding_type: `friction.${item.topic}`,
          title: item.title,
          severity: normalizeSeverity(item.severity),
          confidence: CONF[item.confidence],
          claim_type: item.claim === 'inference' ? 'inferred' : 'hypothesis',
          passed: null,
          deterministic: audit.auditor_mode === 'deterministic',
          offline,
          network_accessed: !offline,
          evidence_refs: item.evidence_ids,
          location: variant,
          provenance: { tool: 'buyer-arena', version, config_digest: null, timestamp: a.generated_at },
          attributes: {
            variant,
            affected_runs: item.affected_runs.length,
            blocking_runs: item.blocking_runs,
            sources: item.sources.join(','),
            disagreement: item.disagreement,
          },
          raw: { session: a.session.session_id, id: item.id, topic: item.topic, variant },
        }),
      );
    }
  }
  return out;
}

/** Launch-check panel checks → EvidenceEnvelopeV1 (source `buyer-arena.panel.<id>`). */
export function launchToEvidence(r: LaunchReport, version: string | null = null): EvidenceEnvelopeV1[] {
  const out: EvidenceEnvelopeV1[] = [];
  const offline = r.network ? r.network.stayed_local : true;
  for (const p of r.panels) {
    for (const c of p.checks) {
      if (c.status === 'na') continue;
      out.push(
        makeEvidence({
          source: `buyer-arena.panel.${p.id}`,
          source_version: version,
          source_kind: 'builtin',
          categories: PANEL_CATEGORY[p.id] ?? ['product'],
          target: { repo: r.target.repo, url: r.target.url, run: r.id },
          finding_type: `check.${c.id}`,
          severity:
            c.status === 'fail'
              ? p.id === 'security'
                ? 'high'
                : 'medium'
              : c.status === 'warn'
                ? 'low'
                : 'info',
          confidence: 0.6,
          claim_type: 'observed',
          passed: c.status === 'pass' ? true : c.status === 'fail' ? false : null,
          deterministic: true,
          offline,
          network_accessed: !offline,
          evidence_refs: c.evidence.map((e) => `${e.kind}:${e.ref}`),
          provenance: { tool: 'buyer-arena', version, config_digest: null, timestamp: r.generated_at },
          attributes: { score: c.score, weight: c.weight, status: c.status, self_generated: true },
          raw: { launch: r.id, panel: p.id, check: c.id },
        }),
      );
    }
  }
  return out;
}
