import { Rng } from '../core/rng.js';

export interface Rate {
  k: number;
  n: number;
  rate: number;
  /** 95% Wilson score interval. */
  lo: number;
  hi: number;
}

/** Wilson score interval: well-behaved at small n and at 0% / 100%, unlike the normal approximation. */
export function wilson(k: number, n: number, z = 1.96): Rate {
  if (n === 0) return { k, n, rate: 0, lo: 0, hi: 0 };
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { k, n, rate: p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

export function quantile(xs: number[], q: number): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return (s[lo] as number) + ((s[hi] as number) - (s[lo] as number)) * (pos - lo);
}

export interface DeltaEstimate {
  delta: number;
  lo: number;
  hi: number;
  n_pairs: number;
  iterations: number;
  method: 'paired-bootstrap';
}

/**
 * Paired percentile bootstrap for the difference of means (candidate − baseline).
 * Pairs are the SAME synthetic persona run against both variants, which removes
 * between-persona variance from the comparison. Seeded, so results are reproducible.
 */
export function pairedBootstrap(pairs: [number, number][], iterations = 2000, seed = 7): DeltaEstimate {
  const n = pairs.length;
  const mean = (idx: number[]) =>
    idx.reduce((s, i) => s + ((pairs[i] as [number, number])[1] - (pairs[i] as [number, number])[0]), 0) /
    idx.length;
  if (n === 0) return { delta: NaN, lo: NaN, hi: NaN, n_pairs: 0, iterations: 0, method: 'paired-bootstrap' };
  const all = pairs.map((_, i) => i);
  const rng = new Rng(seed);
  const samples: number[] = [];
  for (let it = 0; it < iterations; it++) samples.push(mean(all.map(() => Math.floor(rng.next() * n))));
  samples.sort((a, b) => a - b);
  return {
    delta: mean(all),
    lo: samples[Math.floor(iterations * 0.025)] as number,
    hi: samples[Math.min(iterations - 1, Math.ceil(iterations * 0.975) - 1)] as number,
    n_pairs: n,
    iterations,
    method: 'paired-bootstrap',
  };
}

export type SignalLabel = 'EXPLORATORY SIGNAL' | 'CONSISTENT SYNTHETIC EFFECT' | 'INCONCLUSIVE';

/**
 * We never call a synthetic result "significant". Below 30 paired buyers every result is
 * exploratory; above that, an interval that excludes zero is a consistent synthetic effect.
 */
export function signalLabel(nPairs: number, lo: number, hi: number): SignalLabel {
  if (nPairs < 30) return 'EXPLORATORY SIGNAL';
  return lo > 0 || hi < 0 ? 'CONSISTENT SYNTHETIC EFFECT' : 'INCONCLUSIVE';
}
