/**
 * Launch-readiness panels. Every panel answers ONE audience's question with scored checks,
 * and every check cites evidence (file:line, URL, command, or a recorded journey event).
 */
export type PanelId = 'users' | 'developers' | 'commercial' | 'security' | 'segments';
export const PANELS: PanelId[] = ['users', 'developers', 'commercial', 'security', 'segments'];

export interface Evidence {
  kind: 'file' | 'url' | 'command' | 'run' | 'metric';
  /** file:line, URL, command line, run event id, or metric name. */
  ref: string;
  excerpt?: string;
}

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'na';

export interface Check {
  /** Stable id; the UI renders `chk.<id>` (title) and `fix.<id>` (what to do) in ES/EN/NL. */
  id: string;
  panel: PanelId;
  /** 0–100; null when the check could not run (status 'na'). */
  score: number | null;
  weight: number;
  status: CheckStatus;
  /** Parameters for the translated detail line `det.<id>`. */
  params?: Record<string, string | number>;
  evidence: Evidence[];
}

/** One synthetic reviewer inside a panel (e.g. a seed VC, a newcomer developer). */
export interface Reviewer {
  id: string;
  /** Archetype key rendered as `aud.<panel>.<archetype>`. */
  archetype: string;
  score: number;
}

export interface PanelResult {
  id: PanelId;
  score: number | null;
  stars: number;
  /** Share of the run allocated to this panel (0–100). */
  share: number;
  reviewers: Reviewer[];
  checks: Check[];
  duration_ms: number;
  /** Panel-specific structured output (business models, risk index, segment table…). */
  extra?: Record<string, unknown>;
  skipped?: string;
}

export const stars = (score: number | null): number =>
  score === null ? 0 : Math.round((score / 20) * 2) / 2;
export const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
export const statusOf = (score: number | null): CheckStatus =>
  score === null ? 'na' : score >= 75 ? 'pass' : score >= 45 ? 'warn' : 'fail';

export function check(
  panel: PanelId,
  id: string,
  score: number | null,
  weight: number,
  evidence: Evidence[] = [],
  params?: Record<string, string | number>,
): Check {
  const s = score === null ? null : Math.round(clamp(score));
  return { id, panel, score: s, weight, status: statusOf(s), evidence: evidence.slice(0, 8), params };
}

/** Weighted mean of the checks that ran. */
export function panelScore(checks: Check[], weights?: Record<string, number>): number | null {
  const ran = checks.filter((c) => c.score !== null);
  const w = (c: Check) => weights?.[c.id] ?? c.weight;
  const total = ran.reduce((s, c) => s + w(c), 0);
  if (!total) return null;
  return Math.round(ran.reduce((s, c) => s + (c.score as number) * w(c), 0) / total);
}

export type ProgressEvent =
  | { type: 'plan'; panels: { id: PanelId; share: number; units: number }[] }
  | {
      type: 'panel';
      panel: PanelId;
      state: 'start' | 'done' | 'skipped';
      score?: number | null;
      note?: string;
    }
  | { type: 'progress'; panel: PanelId; done: number; total: number; label?: string }
  | { type: 'log'; panel: PanelId; line: string }
  | { type: 'done'; overall: number | null; dir: string };

export type Emit = (e: ProgressEvent) => void;
