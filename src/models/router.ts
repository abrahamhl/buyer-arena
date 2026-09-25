import { describeSpec, type Catalog, type ModelInfo } from './catalog.js';

/**
 * Cost-aware model router.
 *
 * It never replaces `createProvider()`: it only decides WHICH spec to hand to it, and says
 * why. Explicitly pinned models are honoured or refused, never swapped. Reproducible runs
 * never use dynamic routes and never fall back to a different model.
 */
export type ModelPurpose = 'buyer' | 'auditor' | 'critic' | 'judge' | 'vision' | 'extractor' | 'summarizer';
export type RoutingPolicy = 'quality' | 'balanced' | 'economy' | 'offline';
export const ROUTING_POLICIES: RoutingPolicy[] = ['quality', 'balanced', 'economy', 'offline'];

export interface ModelConstraints {
  max_cost_usd?: number;
  max_latency_ms?: number;
  offline_only?: boolean;
  local_preferred?: boolean;
  minimum_context?: number;
  needs_vision?: boolean;
  needs_tools?: boolean;
  needs_structured_output?: boolean;
  allowed_providers?: string[];
  denied_providers?: string[];
}

export interface ModelRequestProfile {
  purpose: ModelPurpose;
  constraints?: ModelConstraints;
  policy?: RoutingPolicy;
  /** An explicit `provider:model`. Honoured exactly or refused. */
  pinned?: string;
  /** Scientific / calibration runs: no dynamic routes, no silent fallbacks. */
  reproducible?: boolean;
  /** Estimated tokens for ONE call, used for expected cost. */
  est_input_tokens?: number;
  est_output_tokens?: number;
  /** Expected number of calls (expected cost = per call × calls). */
  est_calls?: number;
}

/** Observed Buyer Arena history for a spec (optional input; never required). */
export interface ModelHistory {
  calls: number;
  errors: number;
  avg_latency_ms: number;
  /** Share of structured outputs that parsed (LLM buyer / auditor). */
  parse_ok_rate?: number;
}

export interface Candidate {
  spec: string;
  locality: ModelInfo['locality'];
  cost_per_call_usd: number | null;
  reasons: string[];
}

export interface RoutingDecision {
  requested: ModelRequestProfile;
  policy: RoutingPolicy;
  eligible: Candidate[];
  rejected: Candidate[];
  /** `heuristic` = no model needed/allowed: use the deterministic path. */
  selected: string;
  selection_reason: string;
  fallbacks: string[];
  expected_cost_usd: number | null;
  catalog_version: string;
  pinned: boolean;
  reproducible: boolean;
  dynamic: boolean;
  warnings: string[];
}

/** Purposes where a weaker, cheaper model is usually good enough. */
const CHEAP_PURPOSES: ModelPurpose[] = ['buyer', 'extractor', 'summarizer'];

export class RoutingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoutingError';
  }
}

function perCall(m: ModelInfo, p: ModelRequestProfile): number | null {
  if (!m.pricing) return null;
  const i = p.est_input_tokens ?? 2_000;
  const o = p.est_output_tokens ?? 300;
  return (i * m.pricing.input + o * m.pricing.output) / 1_000_000;
}

/** Hard constraints: a violation disqualifies a model (also a pinned one). */
function violations(
  m: ModelInfo,
  p: ModelRequestProfile,
  policy: RoutingPolicy,
  hist?: ModelHistory,
): string[] {
  const c = p.constraints ?? {};
  const out: string[] = [];
  if ((c.offline_only || policy === 'offline') && m.locality !== 'local') out.push('not a local model');
  if (c.allowed_providers?.length && !c.allowed_providers.includes(m.provider))
    out.push('provider not allowed');
  if (c.denied_providers?.includes(m.provider)) out.push('provider denied');
  if (c.minimum_context && (m.context ?? 0) < c.minimum_context)
    out.push(m.context ? `context ${m.context} < ${c.minimum_context}` : 'context unknown');
  if ((c.needs_vision || p.purpose === 'vision') && !m.vision) out.push('no vision (or unknown)');
  if (c.needs_tools && !m.tools) out.push('no tool calling (or unknown)');
  if (c.needs_structured_output && !m.structured_output) out.push('no structured output (or unknown)');
  if (p.reproducible && m.dynamic) out.push('dynamic route: non-reproducible model selection');
  const cost = perCall(m, p);
  if (c.max_cost_usd !== undefined) {
    const total = cost === null ? null : cost * (p.est_calls ?? 1);
    if (total === null) out.push('price unknown (cannot prove it fits max_cost)');
    else if (total > c.max_cost_usd) out.push(`expected $${total.toFixed(4)} > max $${c.max_cost_usd}`);
  }
  if (c.max_latency_ms !== undefined && hist && hist.avg_latency_ms > c.max_latency_ms)
    out.push(`observed latency ${Math.round(hist.avg_latency_ms)}ms > ${c.max_latency_ms}ms`);
  return out;
}

/**
 * Route a request. Deterministic: same catalog + profile + history → same decision.
 * `available` limits candidates to specs that are configured on this machine.
 */
export function route(
  profile: ModelRequestProfile,
  catalog: Catalog,
  o: { available?: string[]; history?: Record<string, ModelHistory> } = {},
): RoutingDecision {
  const policy: RoutingPolicy =
    profile.policy ?? (profile.constraints?.offline_only ? 'offline' : 'balanced');
  const warnings: string[] = [];
  const base = {
    requested: profile,
    policy,
    catalog_version: catalog.version,
    reproducible: Boolean(profile.reproducible),
  };

  if (profile.pinned) {
    const m = describeSpec(profile.pinned, catalog);
    const v = violations(m, profile, policy, o.history?.[m.spec]);
    if (v.length)
      throw new RoutingError(`pinned model ${profile.pinned} violates the request: ${v.join('; ')}`);
    if (m.dynamic) warnings.push('DYNAMIC MODEL ROUTE — NON-REPRODUCIBLE MODEL SELECTION');
    if (m.pricing_source === 'unknown')
      warnings.push('price unknown: budget guard uses a pessimistic estimate');
    const cost = perCall(m, profile);
    return {
      ...base,
      eligible: [{ spec: m.spec, locality: m.locality, cost_per_call_usd: cost, reasons: ['pinned'] }],
      rejected: [],
      selected: m.spec,
      selection_reason: 'explicitly pinned; never substituted',
      fallbacks: [],
      expected_cost_usd: cost === null ? null : cost * (profile.est_calls ?? 1),
      pinned: true,
      dynamic: Boolean(m.dynamic),
      warnings,
    };
  }

  const pool = catalog.models.filter((m) => !o.available || o.available.includes(m.spec));
  const eligible: (Candidate & { m: ModelInfo })[] = [];
  const rejected: Candidate[] = [];
  for (const m of pool) {
    const v = violations(m, profile, policy, o.history?.[m.spec]);
    const cand = { spec: m.spec, locality: m.locality, cost_per_call_usd: perCall(m, profile), reasons: v };
    if (v.length) rejected.push(cand);
    else eligible.push({ ...cand, m, reasons: [] });
  }
  // Dynamic routes are never chosen automatically; only by pinning.
  const auto = eligible.filter((c) => !c.m.dynamic);

  if (!auto.length) {
    return {
      ...base,
      eligible: [],
      rejected,
      selected: 'heuristic',
      selection_reason:
        policy === 'offline'
          ? 'no local model available: deterministic path (fully offline)'
          : 'no model satisfies the constraints: deterministic path',
      fallbacks: [],
      expected_cost_usd: 0,
      pinned: false,
      dynamic: false,
      warnings,
    };
  }

  const reliability = (c: { spec: string }) => {
    const h = o.history?.[c.spec];
    if (!h || h.calls < 5) return 1;
    return (1 - h.errors / h.calls) * (h.parse_ok_rate ?? 1);
  };
  const price = (c: Candidate) => c.cost_per_call_usd ?? Number.POSITIVE_INFINITY;
  const cheap = CHEAP_PURPOSES.includes(profile.purpose);
  const localBonus = (c: Candidate) =>
    profile.constraints?.local_preferred && c.locality === 'local' ? 0 : 1;

  const sorted = [...auto].sort((a, b) => {
    const lb = localBonus(a) - localBonus(b);
    if (lb) return lb;
    const rel = reliability(b) - reliability(a);
    if (Math.abs(rel) > 0.1) return rel;
    if (policy === 'economy' || policy === 'offline' || (policy === 'balanced' && cheap)) {
      return price(a) - price(b) || a.spec.localeCompare(b.spec);
    }
    // quality, or balanced for judgement purposes: list price as a (documented) capability
    // proxy — the most capable tier that fits the budget. Unknown prices sort last.
    const pa = a.cost_per_call_usd ?? -1;
    const pb = b.cost_per_call_usd ?? -1;
    return pb - pa || a.spec.localeCompare(b.spec);
  });
  const pick = sorted[0] as (typeof sorted)[number];
  if (pick.m.pricing_source === 'unknown') warnings.push(`price of ${pick.spec} unknown`);
  const reason =
    policy === 'economy' || policy === 'offline' || (policy === 'balanced' && cheap)
      ? `${policy}: cheapest eligible model for "${profile.purpose}"`
      : `${policy}: highest-tier eligible model for "${profile.purpose}" (list price as capability proxy)`;
  return {
    ...base,
    eligible: sorted.map(({ m: _m, ...c }) => ({ ...c, reasons: ['eligible'] })),
    rejected,
    selected: pick.spec,
    selection_reason:
      profile.constraints?.local_preferred && pick.locality === 'local'
        ? `${reason}; local preferred`
        : reason,
    fallbacks: profile.reproducible ? [] : sorted.slice(1, 3).map((c) => c.spec),
    expected_cost_usd:
      pick.cost_per_call_usd === null ? null : pick.cost_per_call_usd * (profile.est_calls ?? 1),
    pinned: false,
    dynamic: false,
    warnings,
  };
}

/* ─────────────────────────── cascade ─────────────────────────── */

export interface CascadeStep<T> {
  tier: 'deterministic' | 'cheap' | 'strong';
  run: () => Promise<T | undefined>;
}

export interface CascadeResult<T> {
  value: T | undefined;
  tier: CascadeStep<T>['tier'] | 'none';
  escalations: number;
  trail: { tier: string; accepted: boolean; error?: string }[];
}

/**
 * DETERMINISTIC → CHEAP MODEL → STRONG MODEL. Each tier runs only when the previous one
 * produced nothing acceptable. The caller decides acceptance (confidence, schema, rules).
 */
export async function runCascade<T>(
  steps: CascadeStep<T>[],
  accept: (v: T) => boolean,
): Promise<CascadeResult<T>> {
  const trail: CascadeResult<T>['trail'] = [];
  for (const [i, s] of steps.entries()) {
    try {
      const v = await s.run();
      const ok = v !== undefined && accept(v);
      trail.push({ tier: s.tier, accepted: ok });
      if (ok) return { value: v, tier: s.tier, escalations: i, trail };
    } catch (err) {
      trail.push({ tier: s.tier, accepted: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { value: undefined, tier: 'none', escalations: Math.max(0, steps.length - 1), trail };
}
