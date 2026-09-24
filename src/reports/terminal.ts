import type { Analysis } from '../analysis.js';
import { c } from '../core/log.js';
import { fmtDelta, fmtValue } from './format.js';

const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
const lpad = (s: string, n: number) => (s.length >= n ? s : ' '.repeat(n - s.length) + s);

/** Compact terminal summary: comparison table, top friction, top experiments. */
export function terminalSummary(a: Analysis): string {
  const L: string[] = [];
  const cmp = a.comparison;
  const buyers = a.summaries[0]?.n ?? 0;
  const segs = new Set(a.metrics.map((m) => m.segment)).size;
  L.push('');
  L.push(
    c.bold(
      `  BUYER ARENA  ${c.dim('·')}  ${buyers} BUYERS  ${c.dim('·')}  ${segs} SEGMENTS  ${c.dim('·')}  ${a.variants.length} VARIANT${a.variants.length > 1 ? 'S' : ''}`,
    ),
  );
  if (cmp) {
    L.push(
      `  ${c.dim(cmp.baseline.toUpperCase())} → ${c.cyan(cmp.candidate.toUpperCase())}   ${c.yellow(cmp.label)}   ${c.dim('CONVERSION PROXY')}`,
    );
    L.push('');
    L.push(
      c.dim(
        `  ${pad('', 38)}${lpad(cmp.baseline.toUpperCase(), 11)}${lpad(cmp.candidate.toUpperCase(), 12)}${lpad('DELTA', 10)}   95% INTERVAL`,
      ),
    );
    for (const r of cmp.rows) {
      const col = r.verdict === 'improved' ? c.green : r.verdict === 'regressed' ? c.red : c.dim;
      L.push(
        `  ${pad(r.metric, 38)}${lpad(fmtValue(r.baseline, r.unit), 11)}${lpad(fmtValue(r.candidate, r.unit), 12)}${col(lpad(fmtDelta(r.delta, r.unit), 10))}   ${c.dim(r.ci ? `${fmtDelta(r.ci[0], r.unit)} … ${fmtDelta(r.ci[1], r.unit)}` : '')}`,
      );
    }
  } else {
    const s = a.summaries[0];
    if (s)
      L.push(
        `  goal completion ${fmtValue(s.completion.rate, 'pct')} (95% ${fmtValue(s.completion.lo, 'pct')}–${fmtValue(s.completion.hi, 'pct')}) · median steps ${s.median_steps ?? '—'}`,
      );
  }
  const top = a.clusters.filter((x) => x.variant === a.backlog_variant).slice(0, 4);
  if (top.length) {
    L.push('');
    L.push(c.dim(`  TOP FRICTION (${a.backlog_variant})`));
    for (const f of top) {
      const status = cmp?.friction.find((d) => d.code === f.code)?.status;
      L.push(
        `  ${lpad(`${f.affected}/${f.population}`, 6)}  ${f.title}${status === 'new' ? c.red('  NEW') : ''}`,
      );
    }
  }
  if (a.resolved.length) {
    L.push(
      c.dim(`  RESOLVED vs ${cmp?.baseline}: `) + a.resolved.map((r) => c.green(r.title)).join(c.dim(' · ')),
    );
  }
  if (a.backlog.length) {
    L.push('');
    L.push(c.dim('  NEXT EXPERIMENTS'));
    for (const o of a.backlog.slice(0, 3))
      L.push(
        `  #${o.rank} ${pad(o.title, 44)} ${lpad(String(o.score), 6)}  ${o.leverage === 'HIGH-LEVERAGE EXPERIMENT' ? c.green(o.leverage) : c.dim(o.leverage)}`,
      );
  }
  L.push('');
  return L.join('\n');
}
