export type Unit = 'pct' | 'count' | 'steps' | 'ms';

export function fmtValue(v: number | null, unit: Unit): string {
  if (v === null || Number.isNaN(v)) return '—';
  switch (unit) {
    case 'pct':
      return `${Math.round(v * 100)}%`;
    case 'ms':
      return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`;
    case 'steps':
      return Number.isInteger(v) ? String(v) : v.toFixed(1);
    default:
      return v.toFixed(2);
  }
}

export function fmtDelta(v: number | null, unit: Unit): string {
  if (v === null || Number.isNaN(v)) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '±';
  const a = Math.abs(v);
  switch (unit) {
    case 'pct':
      return `${sign}${Math.round(a * 100)}pp`;
    case 'ms':
      return `${sign}${a >= 1000 ? `${(a / 1000).toFixed(1)}s` : `${Math.round(a)}ms`}`;
    case 'steps':
      return `${sign}${Number.isInteger(a) ? a : a.toFixed(1)}`;
    default:
      return `${sign}${a.toFixed(2)}`;
  }
}
