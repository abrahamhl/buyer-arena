import { join } from 'node:path';
import {
  buildConsensus,
  type AttributedFinding,
  type ConsensusItem,
  type Counterfactual,
  type RejectedFinding,
} from './auditors/consensus.js';
import { llmAudit } from './auditors/llm-auditor.js';
import { buildPacket } from './auditors/packet.js';
import { DEFAULT_AUDITORS, type AuditorId } from './auditors/rules.js';
import { compareVariants, type Comparison } from './comparison/compare.js';
import { writeJson } from './core/fs.js';
import type { RunRecord } from './core/types.js';
import {
  buildEvidenceIndex,
  clusterFriction,
  detectFriction,
  type FrictionCluster,
} from './metrics/friction.js';
import {
  computeRunMetrics,
  summarizeVariant,
  type RunMetrics,
  type VariantSummary,
} from './metrics/run-metrics.js';
import { CostMeter } from './providers/metered.js';
import type { ChatProvider } from './providers/types.js';
import { prioritize, type Opportunity } from './roi/roi.js';
import { loadManifest, loadRuns, type SessionManifest } from './simulator/session.js';

export interface VariantAudit {
  findings: AttributedFinding[];
  consensus: ConsensusItem[];
  rejected: RejectedFinding[];
  degraded: { auditor: AuditorId; error: string }[];
  auditor_mode: 'deterministic' | string;
}

export interface Analysis {
  version: 1;
  generated_at: string;
  session: SessionManifest;
  variants: string[];
  metrics: RunMetrics[];
  summaries: VariantSummary[];
  clusters: FrictionCluster[];
  comparison?: Comparison;
  audits: Record<string, VariantAudit>;
  backlog_variant: string;
  backlog: Opportunity[];
  resolved: { code: string; title: string; baseline_affected: number }[];
  audit_usage?: ReturnType<CostMeter['summary']>;
}

export interface AnalyzeOptions {
  /** Optional LLM for auditors. Omit for deterministic auditors (free, reproducible). */
  auditorProvider?: ChatProvider;
  auditorBudgetUsd?: number;
}

export async function analyzeRuns(
  manifest: SessionManifest,
  runs: RunRecord[],
  opts: AnalyzeOptions = {},
): Promise<Analysis> {
  const variants = manifest.variants.map((v) => v.name).filter((v) => runs.some((r) => r.variant === v));
  const metrics = runs.map(computeRunMetrics);
  const summaries = variants.map((v) => summarizeVariant(v, metrics, runs));
  const population = Object.fromEntries(summaries.map((s) => [s.variant, s.n]));
  const clusters = clusterFriction(detectFriction(runs, metrics), population);
  const comparison =
    variants.length >= 2
      ? compareVariants(variants[0] as string, variants[1] as string, metrics, summaries, clusters, runs)
      : undefined;
  const index = buildEvidenceIndex(runs);
  const meter = new CostMeter({ budgetUsd: opts.auditorBudgetUsd ?? 0.5 });

  const audits: Record<string, VariantAudit> = {};
  const backlogVariant = comparison ? comparison.candidate : (variants[0] as string);
  for (const variant of variants) {
    const summary = summaries.find((s) => s.variant === variant) as VariantSummary;
    // The comparison is the shipped version's context; baseline auditors review the baseline on its own.
    const packet = buildPacket(
      variant,
      runs,
      summary,
      clusters,
      variant === backlogVariant ? comparison : undefined,
    );
    const findings: AttributedFinding[] = [];
    const degraded: VariantAudit['degraded'] = [];
    // Each auditor sees only the packet — never another auditor's findings.
    for (const auditor of DEFAULT_AUDITORS) {
      if (opts.auditorProvider) {
        const res = await llmAudit(auditor, packet, opts.auditorProvider, meter);
        if (res.degraded) degraded.push({ auditor: auditor.id, error: res.error ?? 'unknown' });
        findings.push(
          ...res.findings.map((f) => ({
            ...f,
            // LLM output is never trusted as "computed"; degraded runs fell back to the rule auditor.
            computed: res.degraded ? f.computed : undefined,
            auditor: auditor.id,
            variant,
            degraded: res.degraded || undefined,
            source: (res.degraded ? 'rule' : 'llm') as 'rule' | 'llm',
          })),
        );
      } else {
        findings.push(
          ...auditor
            .audit(packet)
            .map((f) => ({ ...f, auditor: auditor.id, variant, source: 'rule' as const })),
        );
      }
    }
    // Findings on the version being shipped are F-###; other variants get a letter prefix (e.g. BF-### for baseline).
    const prefix = variant === backlogVariant ? 'F' : `${variant.charAt(0).toUpperCase()}F`;
    const consensus = buildConsensus(
      findings,
      index,
      clusters,
      prefix,
      counterfactualsFor(variant, variants, clusters, metrics),
    );
    audits[variant] = {
      findings: consensus.findings,
      consensus: consensus.items,
      rejected: consensus.rejected,
      degraded,
      auditor_mode: opts.auditorProvider
        ? `llm:${opts.auditorProvider.name}:${opts.auditorProvider.model}`
        : 'deterministic',
    };
  }

  const segmentsTotal = new Set(metrics.map((m) => m.segment)).size;
  const backlog = prioritize(audits[backlogVariant]?.consensus ?? [], {
    population: population[backlogVariant] ?? 0,
    totalSegments: segmentsTotal,
    comparison,
  });
  const resolved = (comparison?.friction ?? [])
    .filter((f) => f.status === 'resolved')
    .map((f) => ({ code: f.code, title: f.title, baseline_affected: f.baseline_affected }));

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    session: manifest,
    variants,
    metrics,
    summaries,
    clusters,
    comparison,
    audits,
    backlog_variant: backlogVariant,
    backlog,
    resolved,
    audit_usage: opts.auditorProvider ? meter.summary() : undefined,
  };
}

/**
 * Independent evidence from the other variant: the same personas who ended their journey at a
 * friction here — what happened to them on the other version?
 *   baseline friction → did they complete on the candidate (where it may be fixed)?
 *   candidate friction → had they completed on the baseline (a regression)?
 * Counted only when ≥3 personas ended at the friction and ≥60% flipped.
 */
function counterfactualsFor(
  variant: string,
  variants: string[],
  clusters: FrictionCluster[],
  metrics: RunMetrics[],
): Map<string, Counterfactual> {
  const out = new Map<string, Counterfactual>();
  const other = variants.find((v) => v !== variant);
  if (!other) return out;
  const outcome = new Map(
    metrics.filter((m) => m.variant === other).map((m) => [m.persona_id, m.goal_completed]),
  );
  const personaOf = new Map(metrics.map((m) => [m.run_id, m.persona_id]));
  for (const c of clusters.filter((x) => x.variant === variant)) {
    const ended = c.affected_runs.filter((r) => !metrics.find((m) => m.run_id === r)?.goal_completed);
    const personas = ended
      .map((r) => personaOf.get(r))
      .filter((p): p is string => Boolean(p) && outcome.has(p as string));
    if (personas.length < 3) continue;
    const flipped = personas.filter((p) => outcome.get(p)).length;
    if (flipped / personas.length < 0.6) continue;
    out.set(`${variant}\u0000${c.code}`, {
      affected: personas.length,
      flipped,
      other,
      text: `${flipped}/${personas.length} of these buyers completed the goal on "${other}".`,
    });
  }
  return out;
}

export async function analyzeSession(dir: string, opts: AnalyzeOptions = {}): Promise<Analysis> {
  const analysis = await analyzeRuns(loadManifest(dir), loadRuns(dir), opts);
  writeJson(join(dir, 'analysis.json'), analysis);
  return analysis;
}
