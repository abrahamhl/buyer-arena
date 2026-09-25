import { PANELS, type PanelId } from './types.js';

export type Depth = 'quick' | 'standard' | 'deep';
export type Mix = Record<PanelId, number>;

export const DEFAULT_MIX: Mix = { users: 40, developers: 15, investors: 15, security: 15, segments: 15 };

/** Parse "users=40,investors=30,security=0" (missing panels keep their default share, then normalised to 100). */
export function parseMix(s?: string): Mix {
  if (!s) return { ...DEFAULT_MIX };
  const out: Mix = { users: 0, developers: 0, investors: 0, security: 0, segments: 0 };
  const seen = new Set<string>();
  for (const part of s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)) {
    const m = part.match(/^(users|developers|investors|security|segments)\s*[=:]\s*(\d{1,3})$/);
    if (!m) throw new Error(`invalid mix entry "${part}". Use e.g. users=40,investors=30,security=0`);
    out[m[1] as PanelId] = Math.min(100, Number(m[2]));
    seen.add(m[1] as string);
  }
  for (const p of PANELS) if (!seen.has(p)) out[p] = DEFAULT_MIX[p];
  return normalise(out);
}

export function normalise(m: Mix): Mix {
  const total = PANELS.reduce((s, p) => s + m[p], 0);
  if (!total) throw new Error('mix gives 0% to every panel');
  const out = { ...m };
  for (const p of PANELS) out[p] = Math.round((m[p] / total) * 100);
  return out;
}

export interface Allocation {
  panel: PanelId;
  share: number;
  /** Synthetic participants for this panel (buyers, developers, investors, red-teamers, segment runs). */
  participants: number;
  /** 0 = skipped, 1–3 = light/standard/deep work inside the panel. */
  level: number;
}

const DEPTH_FACTOR: Record<Depth, number> = { quick: 0.5, standard: 1, deep: 2 };

/**
 * Turn "how much attention each audience gets" into concrete, bounded work.
 * `size` is the total number of synthetic participants across all panels.
 */
export function allocate(mix: Mix, size: number, depth: Depth): Allocation[] {
  const f = DEPTH_FACTOR[depth];
  return PANELS.map((panel) => {
    const share = mix[panel];
    if (!share) return { panel, share, participants: 0, level: 0 };
    const participants = Math.max(panel === 'users' ? 5 : 2, Math.round(size * (share / 100) * f));
    const level = share >= 30 || depth === 'deep' ? 3 : share >= 12 || depth === 'standard' ? 2 : 1;
    return { panel, share, participants: Math.min(participants, panel === 'users' ? 200 : 60), level };
  });
}

/** Rough duration estimate in seconds, shown before a run starts (UI + CLI). */
export function estimateSeconds(a: Allocation[], opts: { execute: boolean; compare: boolean }): number {
  let s = 5;
  for (const x of a) {
    if (!x.participants) continue;
    if (x.panel === 'users') s += x.participants * (opts.compare ? 2 : 1) * 1.2;
    if (x.panel === 'developers') s += opts.execute ? 60 + x.level * 30 : 3;
    if (x.panel === 'investors') s += 2;
    if (x.panel === 'security') s += 5 + x.level * 10;
    if (x.panel === 'segments') s += x.participants * 3;
  }
  return Math.round(s);
}
