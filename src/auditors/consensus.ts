import type { AuditorFinding, Claim, Confidence, JourneyEvent, Severity } from '../core/types.js';
import type { I18n } from '../i18n/messages.js';
import type { FrictionCluster } from '../metrics/friction.js';
import { playFor } from './playbook.js';
import type { AuditorId } from './rules.js';

export interface AttributedFinding extends AuditorFinding {
  auditor: AuditorId;
  variant: string;
  /** Set when an LLM auditor failed and the deterministic auditor was used instead. */
  degraded?: boolean;
  /** 'rule' = deterministic auditor over detector output; 'llm' = model auditor. */
  source?: 'rule' | 'llm';
}

/** Evidence from the OTHER variant for the same personas: did the outcome flip where the friction was absent/present? */
export interface Counterfactual {
  affected: number;
  flipped: number;
  other: string;
  text: string;
}

export interface RejectedFinding {
  auditor: AuditorId;
  finding: string;
  reason: string;
}

/** Translatable renderings of an item (keys in src/i18n/messages.ts; '@key' params are translated too). */
export interface ItemI18n {
  title: I18n;
  fact: I18n;
  interp: I18n;
  experiment: I18n;
  counterfactual?: I18n;
  challenges: I18n[];
}

export interface ConsensusItem {
  id: string;
  topic: string;
  title: string;
  i18n: ItemI18n;
  variant: string;
  /** Directly computed from recorded events. */
  observed_fact: string;
  /** Interpretation offered by the auditors. */
  interpretation: string;
  /** Label for the interpretation. The observed_fact is always an OBSERVED FACT. */
  claim: Exclude<Claim, 'observed_fact'>;
  supporters: AuditorId[];
  /** Independent evidence sources behind the interpretation (detector, llm, counterfactual). */
  sources: string[];
  counterfactual?: string;
  challenges: { auditor: AuditorId; text: string }[];
  disagreement: boolean;
  severity: Severity;
  confidence: Confidence;
  evidence_ids: string[];
  affected_runs: string[];
  /** Affected runs that did not complete the goal (co-occurrence, not proof of causation). */
  blocking_runs: number | null;
  affected_segments: string[];
  proposed_experiments: string[];
}

export interface ConsensusResult {
  items: ConsensusItem[];
  rejected: RejectedFinding[];
  findings: AttributedFinding[];
}

const SEV: Severity[] = ['low', 'medium', 'high', 'critical'];
const CONF: Confidence[] = ['low', 'medium', 'high'];
const maxOf = <T>(order: T[], xs: T[]): T =>
  xs.reduce((a, b) => (order.indexOf(b) > order.indexOf(a) ? b : a), xs[0] as T);
const down = <T>(order: T[], x: T): T => order[Math.max(0, order.indexOf(x) - 1)] as T;
const runOf = (evidenceId: string) => evidenceId.slice(0, evidenceId.lastIndexOf(':'));

/** Drop evidence ids that do not exist; reject findings left with no evidence. A score without evidence is invalid. */
export function validateFindings(
  findings: AttributedFinding[],
  index: Map<string, JourneyEvent>,
): { valid: AttributedFinding[]; rejected: RejectedFinding[] } {
  const valid: AttributedFinding[] = [];
  const rejected: RejectedFinding[] = [];
  for (const f of findings) {
    const ok = f.evidence_ids.filter((id) => index.has(id));
    if (ok.length === 0) {
      rejected.push({
        auditor: f.auditor,
        finding: f.finding,
        reason: `no valid evidence (cited: ${f.evidence_ids.slice(0, 3).join(', ') || 'none'})`,
      });
      continue;
    }
    valid.push({ ...f, evidence_ids: ok });
  }
  return { valid, rejected };
}

/**
 * Merge independent auditor findings per topic.
 *   - The observed fact is generated from data, never from auditor prose.
 *   - An interpretation is an INFERENCE only if ≥2 non-red-team auditors support it and
 *     the red team raised no challenge; otherwise it stays a HYPOTHESIS.
 */
export function buildConsensus(
  findings: AttributedFinding[],
  index: Map<string, JourneyEvent>,
  clusters: FrictionCluster[],
  idPrefix = 'F',
  counterfactuals: Map<string, Counterfactual> = new Map(),
): ConsensusResult {
  // Evidence must belong to the finding's own variant.
  const scoped = findings.map((f) => ({
    ...f,
    evidence_ids: f.evidence_ids.filter((id) => id.startsWith(`${f.variant}-`)),
  }));
  const { valid, rejected } = validateFindings(scoped, index);
  const topics = new Map<string, AttributedFinding[]>();
  for (const f of valid)
    topics.set(`${f.variant}\u0000${f.topic}`, [...(topics.get(`${f.variant}\u0000${f.topic}`) ?? []), f]);

  const items: Omit<ConsensusItem, 'id'>[] = [];
  for (const [key, fs] of topics) {
    const [variant, topic] = key.split('\u0000') as [string, string];
    const support = fs.filter((f) => f.auditor !== 'redteam');
    const challenges = fs.filter((f) => f.auditor === 'redteam');
    if (support.length === 0) continue; // A challenge with nothing to challenge is not a finding.
    const cluster = clusters.find((c) => c.variant === variant && c.code === topic);
    const evidence = [...new Set(support.flatMap((f) => f.evidence_ids))];
    const runs = [...new Set(evidence.map(runOf))];
    const supporters = [...new Set(support.map((f) => f.auditor))];
    const challenged = challenges.length > 0;
    // Rule auditors all read the same detector output, so together they are ONE source.
    const cf = counterfactuals.get(`${variant}\u0000${topic}`);
    const sources = [
      ...(support.some((f) => f.source !== 'llm') ? ['detector'] : []),
      ...(support.some((f) => f.source === 'llm') ? ['llm'] : []),
      ...(cf ? ['counterfactual'] : []),
    ];
    const claim: ConsensusItem['claim'] = sources.length >= 2 && !challenged ? 'inference' : 'hypothesis';
    let severity = maxOf(
      SEV,
      support.map((f) => f.severity),
    );
    let confidence = maxOf(
      CONF,
      support.map((f) => f.confidence),
    );
    if (challenged) {
      confidence = down(CONF, confidence);
      if (challenges.some((c) => /too few|only \d+ journey/i.test(c.finding))) severity = down(SEV, severity);
    }
    if (supporters.length === 1 && confidence === 'high') confidence = 'medium';
    const computedFact = support.find((f) => f.computed && f.source !== 'llm');
    const observed_fact = cluster
      ? `${cluster.affected}/${cluster.population} synthetic buyers on "${variant}" showed this signal; ${cluster.blocking_runs} ended their journey at it. Showing evidence from ${runs.length} of ${cluster.affected} journey(s).`
      : computedFact
        ? computedFact.finding.replace(/\s+/g, ' ')
        : `Unverified auditor statement: ${support[0]?.finding ?? ''}`.replace(/\s+/g, ' ');
    const interpretation = cluster
      ? `Likely cause (${claim}): ${playFor(topic).likely_cause}.`
      : (support.map((f) => f.finding).find((x) => x !== observed_fact) ?? interpretFor(topic));
    items.push({
      topic,
      title: cluster?.title ?? titleFor(topic, support[0]?.finding),
      i18n: itemI18n(topic, variant, claim, cluster, computedFact?.params, cf, challenges, runs.length),
      variant,
      observed_fact,
      interpretation,
      claim,
      supporters,
      sources,
      counterfactual: cf?.text,
      challenges: challenges.map((c) => ({ auditor: c.auditor, text: c.finding })),
      disagreement: challenged,
      severity,
      confidence,
      evidence_ids: evidence,
      affected_runs: cluster?.affected_runs ?? runs,
      blocking_runs: cluster?.blocking_runs ?? null,
      affected_segments: [...new Set(support.flatMap((f) => f.affected_segments))],
      proposed_experiments: [...new Set(support.map((f) => f.proposed_experiment))],
    });
  }
  const sevRank = (s: Severity) => SEV.indexOf(s);
  items.sort(
    (a, b) =>
      sevRank(b.severity) - sevRank(a.severity) ||
      b.affected_runs.length - a.affected_runs.length ||
      a.topic.localeCompare(b.topic),
  );
  return {
    items: items.map((it, i) => ({ id: `${idPrefix}-${String(i + 1).padStart(3, '0')}`, ...it })),
    rejected,
    findings: valid,
  };
}

type Params = Record<string, string | number>;

function itemI18n(
  topic: string,
  variant: string,
  claim: string,
  cluster: FrictionCluster | undefined,
  computed: Params | undefined,
  cf: Counterfactual | undefined,
  challenges: AttributedFinding[],
  shown: number,
): ItemI18n {
  const challengesI18n = challenges.map((c) => {
    const { kind, ...p } = c.params ?? {};
    return kind ? { k: `chal.${kind}`, p } : { k: '@raw', p: { text: c.finding } };
  });
  const counterfactual = cf
    ? { k: 'cf.text', p: { flipped: cf.flipped, affected: cf.affected, other: cf.other } }
    : undefined;
  if (cluster) {
    return {
      title: { k: `fr.${topic}` },
      fact: {
        k: 'fact.cluster',
        p: { a: cluster.affected, n: cluster.population, b: cluster.blocking_runs, variant, shown },
      },
      interp: { k: 'interp.cause', p: { cause: `@cause.${topic}`, claim } },
      experiment: { k: `exp.${topic}` },
      counterfactual,
      challenges: challengesI18n,
    };
  }
  const kind = String(computed?.kind ?? '');
  const { kind: _k, ...p } = computed ?? {};
  void _k;
  if (kind === 'funnel_leak' || kind === 'segment_gap' || kind === 'variant_delta') {
    return {
      title: { k: `fr.${kind}`, p },
      fact: { k: `fact.${kind}`, p },
      interp: { k: `interp.${kind}` },
      experiment: { k: `exp.${kind}`, p },
      counterfactual,
      challenges: challengesI18n,
    };
  }
  return {
    title: { k: '@raw', p: { text: topic } },
    fact: { k: 'fact.unverified' },
    interp: { k: 'interp.pending' },
    experiment: { k: '@raw', p: { text: '' } },
    counterfactual,
    challenges: challengesI18n,
  };
}

function interpretFor(topic: string): string {
  if (topic === 'funnel_leak')
    return 'The step after this stage loses the most buyers, so a fix there likely has the most leverage.';
  if (topic === 'variant_delta')
    return 'The candidate likely improves the conversion proxy for this synthetic population; impact on real users is untested.';
  if (topic.startsWith('segment_gap:'))
    return 'This segment has a need the current flow does not meet; the exit reasons in the linked journeys point at it.';
  return 'Interpretation pending: inspect the linked journeys.';
}

function titleFor(topic: string, finding?: string): string {
  if (topic === 'funnel_leak') return 'Largest funnel leak';
  if (topic === 'variant_delta') return 'Variant comparison';
  if (topic.startsWith('segment_gap:')) return `Segment under-performs: ${topic.slice(12)}`;
  return (finding ?? topic).slice(0, 80);
}
