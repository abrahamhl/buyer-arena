import { c } from '../core/log.js';
import { PANELS, type Emit, type PanelId, type ProgressEvent } from '../panels/types.js';

interface Row {
  share: number;
  units: number;
  state: 'wait' | 'run' | 'done' | 'skipped';
  done: number;
  total: number;
  score?: number | null;
  note?: string;
  t0?: number;
  ms?: number;
}

const NAMES: Record<PanelId, string> = {
  users: 'End users',
  developers: 'Developers',
  commercial: 'Commercial readiness',
  security: 'Red team',
  segments: 'Segments',
};

const bar = (f: number, w: number) => {
  const n = Math.round(Math.max(0, Math.min(1, f)) * w);
  return '█'.repeat(n) + c.dim('░'.repeat(w - n));
};

/**
 * Live terminal dashboard for launch-check: one progress bar per panel, an overall bar,
 * and the last commands/log lines. Redraws in place on a TTY; prints plain lines otherwise
 * (CI logs, GitHub Actions).
 */
export function dashboard(opts: { tty?: boolean; logLines?: number } = {}): { emit: Emit; stop(): void } {
  const tty = opts.tty ?? Boolean(process.stdout.isTTY);
  const keep = opts.logLines ?? 6;
  const rows = new Map<PanelId, Row>();
  const logs: string[] = [];
  let drawn = 0;
  let timer: NodeJS.Timeout | undefined;
  const t0 = Date.now();

  const frame = () => {
    const lines: string[] = [];
    let tot = 0;
    let got = 0;
    for (const id of PANELS) {
      const r = rows.get(id);
      if (!r) continue;
      const f =
        r.state === 'done' || r.state === 'skipped'
          ? 1
          : r.total
            ? r.done / r.total
            : r.state === 'run'
              ? 0.05
              : 0;
      tot += r.share;
      got += r.share * f;
      const mark =
        r.state === 'done'
          ? c.green('✓')
          : r.state === 'skipped'
            ? c.dim('–')
            : r.state === 'run'
              ? c.cyan('●')
              : c.dim('○');
      const right =
        r.state === 'done'
          ? `${r.score ?? '—'}/100 ${c.dim(`${((r.ms ?? 0) / 1000).toFixed(1)}s`)}`
          : r.state === 'skipped'
            ? c.dim(`skipped: ${r.note ?? ''}`)
            : r.state === 'run'
              ? c.dim(r.total ? `${r.done}/${r.total}` : 'working…')
              : c.dim('queued');
      lines.push(
        `  ${mark} ${NAMES[id].padEnd(11)} ${c.dim(String(r.share).padStart(3) + '%')} ${bar(f, 24)} ${right}`,
      );
    }
    const all = tot ? got / tot : 0;
    lines.push(
      '',
      `  ${c.bold('Overall')}         ${bar(all, 24)} ${Math.round(all * 100)}% ${c.dim(`${((Date.now() - t0) / 1000).toFixed(0)}s`)}`,
    );
    if (logs.length)
      lines.push('', ...logs.map((l) => c.dim('  $ ') + l.slice(0, (process.stdout.columns || 100) - 6)));
    return lines;
  };

  const draw = () => {
    if (!tty) return;
    const lines = frame();
    let out = drawn ? `\x1b[${drawn}A` : '';
    out += lines.map((l) => `\x1b[2K${l}`).join('\n') + '\n';
    process.stdout.write(out);
    drawn = lines.length;
  };

  const emit: Emit = (e: ProgressEvent) => {
    if (e.type === 'plan') {
      for (const p of e.panels)
        rows.set(p.id, { share: p.share, units: p.units, state: 'wait', done: 0, total: 0 });
      if (!tty) console.log(`  plan: ${e.panels.map((p) => `${p.id} ${p.share}% (${p.units})`).join(' · ')}`);
      if (tty) timer = setInterval(draw, 250);
    } else if (e.type === 'panel') {
      const r = rows.get(e.panel);
      if (!r) return;
      if (e.state === 'start') {
        r.state = 'run';
        r.t0 = Date.now();
      } else {
        r.state = e.state;
        r.score = e.score;
        r.note = e.note;
        r.ms = r.t0 ? Date.now() - r.t0 : 0;
      }
      if (!tty)
        console.log(
          `  [${e.panel}] ${e.state}${e.score != null ? ` ${e.score}/100` : ''}${e.note ? ` (${e.note})` : ''}`,
        );
    } else if (e.type === 'progress') {
      const r = rows.get(e.panel);
      if (r) Object.assign(r, { done: e.done, total: e.total });
    } else if (e.type === 'log') {
      logs.push(`${c.cyan(e.panel)} ${e.line}`);
      while (logs.length > keep) logs.shift();
      if (!tty) console.log(`  [${e.panel}] ${e.line}`);
    }
    draw();
  };
  return {
    emit,
    stop() {
      if (timer) clearInterval(timer);
      draw();
    },
  };
}
