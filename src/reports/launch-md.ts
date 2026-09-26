import type { Analysis } from '../analysis.js';
import { t, type Lang } from '../i18n/messages.js';
import type { LaunchReport } from '../launch.js';
import { PANELS, type PanelResult } from '../panels/types.js';

const starTxt = (v: number) => '★'.repeat(Math.floor(v)) + (v % 1 ? '½' : '') + '☆'.repeat(5 - Math.ceil(v));
const starsOf = (s: number | null) => (s === null ? 0 : Math.round((s / 20) * 2) / 2);

/** Markdown twin of the launch report, fully translated (ES · EN · NL). */
export function renderLaunchMarkdown(r: LaunchReport, _a: Analysis | undefined, lang: Lang = 'en'): string {
  const T = (k: string, p: Record<string, string | number> = {}) => t(lang, k, p);
  const pn = (p: string) => T(`panel.${p}`);
  const out: string[] = [];
  out.push(`# ${T('lc.title', { name: r.name })}`, '');
  out.push(
    `**${T('lc.overall')}: ${r.overall.score ?? '—'}/100 · ${starTxt(r.overall.stars)} (${r.overall.stars}/5)**`,
    '',
  );
  out.push(
    `> ${T('lc.sub', { n: r.allocations.reduce((s, a) => s + a.participants, 0), panels: r.panels.filter((p) => p.score !== null).length, depth: T(`lc.depth.${r.depth}`), minutes: Math.max(1, Math.round(r.duration_ms / 60000)) })}`,
    '',
  );
  out.push(`| ${T('lc.panel')} | % | ★ | ${T('lc.mixcol')} |`, '|---|---:|---|---:|');
  for (const id of PANELS) {
    const p = r.panels.find((x) => x?.id === id) as PanelResult | undefined;
    out.push(`| ${pn(id)} | ${p?.score ?? '—'} | ${p ? starTxt(p.stars) : ''} | ${p?.share ?? 0}% |`);
  }
  out.push('');
  for (const id of PANELS) {
    const p = r.panels.find((x) => x?.id === id);
    if (!p) continue;
    out.push(`## ${pn(id)} — ${p.score ?? '—'}/100 ${starTxt(p.stars)}`, '', `_${T(`panelq.${id}`)}_`, '');
    if (p.skipped) {
      out.push(T('lc.skipped', { why: p.skipped }), '');
      continue;
    }
    const x = (p.extra ?? {}) as Record<string, unknown>;
    if (id === 'commercial')
      out.push(
        `**${T('com.reco.l')}:** ${T(`model.${String(x.recommended)}`)} · ${T('com.viral')}: ${String(x.virality)}/100`,
        '',
      );
    if (id === 'security')
      out.push(
        `**${T('sec.risk')}:** ${String(x.risk)}/100 (${T(`crit.${String(x.criticity)}`)}) · **${T('sec.agent_risk')}:** ${String(x.agent_risk ?? '—')}/100`,
        '',
      );
    out.push(`| ${T('lc.checks')} | % | ★ | ${T('lc.fix')} |`, '|---|---:|---|---|');
    for (const c of p.checks)
      out.push(
        `| ${T(`chk.${c.id}`)} | ${c.score ?? '—'} | ${starTxt(starsOf(c.score))} | ${T(`fix.${c.id}`)} |`,
      );
    out.push('');
  }
  out.push(`## ${T('tab.actions')}`, '');
  for (const a of r.actions) {
    const label = a.topic ? T(`fr.${a.topic}`) : T(`chk.${a.check}`);
    const fix = a.topic ? T(`exp.${a.topic}`) : T(`fix.${a.check}`);
    out.push(`${a.rank}. **${label}** — ${fix} _(${pn(a.panel)} · impact ${a.impact})_`);
  }
  out.push('');
  if (r.brief) {
    out.push(`## ${T('lc.brief')} — ${r.brief.coverage}%`, '');
    for (const i of r.brief.items)
      out.push(
        `- [${i.status === 'done' ? 'x' : ' '}] ${i.text[lang]}${i.status === 'partial' ? ' (½)' : ''}`,
      );
    out.push('');
  }
  return out.join('\n');
}
