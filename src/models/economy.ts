import type { Analysis } from '../analysis.js';
import type { RoutingDecision } from './router.js';

/**
 * Per-run token economy. Token efficiency is a product feature: every run says what the
 * models cost, how much the cache saved, how often the cascade escalated, and what that
 * means per finding and per completed buyer.
 */
export interface EconomyReport {
  model_cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  calls: number;
  cache_hits: number;
  /** hits / (hits + provider calls); null when no model was used. */
  cache_hit_rate: number | null;
  escalations: number;
  findings: number;
  cost_per_finding_usd: number | null;
  completed_buyers: number;
  cost_per_completed_buyer_usd: number | null;
  deterministic_only: boolean;
  routing?: Pick<
    RoutingDecision,
    | 'policy'
    | 'selected'
    | 'selection_reason'
    | 'expected_cost_usd'
    | 'catalog_version'
    | 'pinned'
    | 'dynamic'
    | 'warnings'
  >;
}

export function economyReport(a: Analysis): EconomyReport {
  const m = a.session;
  const usage = [...m.usage, ...(a.audit_usage ?? [])];
  const cost = usage.reduce((s, u) => s + u.estimated_cost_usd, 0);
  const calls = usage.reduce((s, u) => s + u.calls, 0);
  const hits = m.economy?.cache_hits ?? 0;
  const findings = Object.values(a.audits).reduce((s, x) => s + x.consensus.length, 0);
  const completed = a.metrics.filter((r) => r.goal_completed).length;
  return {
    model_cost_usd: cost,
    input_tokens: usage.reduce((s, u) => s + u.input_tokens, 0),
    output_tokens: usage.reduce((s, u) => s + u.output_tokens, 0),
    cached_tokens: usage.reduce((s, u) => s + u.cached_tokens, 0),
    calls,
    cache_hits: hits,
    cache_hit_rate: calls + hits > 0 ? hits / (calls + hits) : null,
    escalations: m.economy?.escalations ?? 0,
    findings,
    cost_per_finding_usd: findings > 0 && calls > 0 ? cost / findings : null,
    completed_buyers: completed,
    cost_per_completed_buyer_usd: completed > 0 && calls > 0 ? cost / completed : null,
    deterministic_only: calls === 0 && hits === 0,
    routing: m.routing
      ? {
          policy: m.routing.policy,
          selected: m.routing.selected,
          selection_reason: m.routing.selection_reason,
          expected_cost_usd: m.routing.expected_cost_usd,
          catalog_version: m.routing.catalog_version,
          pinned: m.routing.pinned,
          dynamic: m.routing.dynamic,
          warnings: m.routing.warnings,
        }
      : undefined,
  };
}

export function renderEconomy(e: EconomyReport): string[] {
  if (e.deterministic_only)
    return ['  MODEL COST $0 · deterministic buyers and auditors · 0 tokens · nothing sent to any model'];
  const usd = (x: number | null) => (x === null ? '—' : `$${x.toFixed(4)}`);
  const lines = [
    `  MODEL COST ${usd(e.model_cost_usd)} · TOKENS ${e.input_tokens.toLocaleString('en')} in / ${e.output_tokens.toLocaleString('en')} out · ${e.calls} calls`,
    `  CACHE HIT RATE ${e.cache_hit_rate === null ? '—' : `${Math.round(e.cache_hit_rate * 100)}%`} (${e.cache_hits} hits) · ESCALATIONS ${e.escalations}`,
    `  COST PER FINDING ${usd(e.cost_per_finding_usd)} · COST PER COMPLETED BUYER ${usd(e.cost_per_completed_buyer_usd)}`,
  ];
  if (e.routing)
    lines.push(
      `  ROUTING ${e.routing.policy.toUpperCase()} → ${e.routing.selected}${e.routing.pinned ? ' (pinned)' : ''} · ${e.routing.selection_reason}${e.routing.dynamic ? ' · DYNAMIC MODEL ROUTE — NON-REPRODUCIBLE' : ''}`,
    );
  return lines;
}
