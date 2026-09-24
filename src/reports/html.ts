import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Analysis } from '../analysis.js';
import { readJson } from '../core/fs.js';
import type { Persona, RunRecord, Story } from '../core/types.js';
import { MESSAGES } from '../i18n/messages.js';
import { ROI_FORMULA } from '../roi/roi.js';
import { runDir } from '../simulator/session.js';

export interface JourneyView {
  run_id: string;
  variant: string;
  persona_id: string;
  name: string;
  segment: string;
  archetype: string;
  device_kind: string;
  viewport: string;
  budget: number | null;
  currency: string;
  status: string;
  completed: boolean;
  steps: number;
  abandon_reason?: string;
  abandon_i18n?: RunRecord['abandon_i18n'];
  milestones: string[];
  trace?: string;
  stories?: Record<string, string>;
  policy: string;
  events: {
    id: string;
    step: number;
    type: string;
    target?: string;
    detail?: string;
    i18n?: unknown;
    shot?: string;
    url: string;
  }[];
}

const pathOnly = (u: string) => {
  try {
    const x = new URL(u);
    return x.pathname + x.search;
  } catch {
    return u;
  }
};

/** Build the explorer model. Screenshots are referenced relative to the report file. */
export function journeyViews(sessionDir: string, runs: RunRecord[], personas: Persona[]): JourneyView[] {
  return runs.map((r) => {
    const dir = runDir(sessionDir, r.variant, r.persona_id);
    const rel = relative(sessionDir, dir).split('\\').join('/');
    const storyFile = join(dir, 'story.json');
    const story = existsSync(storyFile) ? readJson<Story>(storyFile) : undefined;
    const p = personas.find((x) => x.persona_id === r.persona_id);
    const firstShot = new Set<number>();
    return {
      run_id: r.run_id,
      variant: r.variant,
      persona_id: r.persona_id,
      name: p?.name ?? r.persona_id,
      segment: r.segment,
      archetype: r.archetype,
      device_kind: p?.device.kind ?? 'desktop',
      viewport: p ? `${p.device.viewport.width}×${p.device.viewport.height}` : '',
      budget: p?.budget ?? null,
      currency: p?.currency ?? '',
      status: r.status,
      completed: r.goal_completed,
      steps: r.steps,
      abandon_reason: r.abandon_reason,
      abandon_i18n: r.abandon_i18n,
      milestones: Object.keys(r.milestones),
      trace: r.trace_path ? `${rel}/${r.trace_path}` : undefined,
      stories: story?.narratives ?? (story ? { en: story.narrative } : undefined),
      policy: r.policy,
      events: r.events
        .filter((e) => {
          // Keep one screenshot per step (the first observation) and drop the rest of the observe noise.
          if (e.type !== 'observe') return true;
          if (!e.screenshot || firstShot.has(e.step)) return false;
          firstShot.add(e.step);
          return true;
        })
        .map((e) => ({
          id: e.id,
          step: e.step,
          type: e.type,
          target: e.target,
          detail: e.detail,
          i18n: (e.data as { i18n?: unknown } | undefined)?.i18n,
          shot: e.screenshot ? `${rel}/${e.screenshot}` : undefined,
          url: pathOnly(e.url),
        })),
    };
  });
}

const ASSETS = fileURLToPath(new URL('./assets/', import.meta.url));
const asset = (f: string) => readFileSync(join(ASSETS, f));
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function renderReport(a: Analysis, journeys: JourneyView[]): string {
  const data = {
    meta: {
      session: a.session.session_id,
      generated: a.generated_at,
      buyer: a.session.buyer,
      template: a.session.template,
      seed: a.session.seed,
      variants: a.session.variants.map((v) => ({ name: v.name })),
      buyers: a.summaries[0]?.n ?? 0,
      segments: new Set(a.metrics.map((m) => m.segment)).size,
      formula: ROI_FORMULA,
      usage: a.session.usage,
    },
    summaries: a.summaries,
    comparison: a.comparison,
    clusters: a.clusters.map((c) => ({
      ...c,
      evidence_ids: c.evidence_ids.slice(0, 24),
      examples: undefined,
    })),
    audits: Object.fromEntries(
      Object.entries(a.audits).map(([v, au]) => [
        v,
        {
          ...au,
          findings: au.findings.map((f) => ({ auditor: f.auditor })),
          rejected: au.rejected.map(() => 1),
        },
      ]),
    ),
    backlog: a.backlog,
    backlog_variant: a.backlog_variant,
    resolved: a.resolved,
    journeys,
    messages: MESSAGES,
  };
  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028|\u2029/g, '');
  const font = asset('fonts/inter-latin-wght.woff2').toString('base64');
  const css = asset('report.css').toString('utf8');
  const js = asset('report.js').toString('utf8');
  const title = a.comparison ? `${a.comparison.baseline} → ${a.comparison.candidate}` : a.variants.join(', ');
  return `<!doctype html>
<html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Buyer Arena · ${esc(title)}</title>
<meta name="description" content="Buyer Arena report: synthetic buyers, real browser journeys, evidence-backed findings.">
<meta name="color-scheme" content="light dark">
<style>@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;font-display:swap;src:url(data:font/woff2;base64,${font}) format('woff2')}
${css}</style></head>
<body class="simple">
<header class="nav" role="banner"><div class="wrap nav-row">
  <div class="brand"><span class="brand-mark" aria-hidden="true">▲</span>Buyer Arena <small id="tagline"></small></div>
  <nav class="links" id="links" aria-label="Sections"></nav>
  <div class="controls">
    <div class="seg" id="mode" role="group"></div>
    <div class="seg" id="lang" role="group"></div>
    <button class="icon-btn" id="themeBtn" type="button"></button>
    <button class="btn btn-ghost" id="guideBtn" type="button"></button>
  </div>
</div><nav class="subnav" id="subnav" aria-label="Sections"></nav></header>
<main class="wrap">
  <section id="overview"><div class="hero" id="hero"></div><div class="kpis" id="kpis"></div></section>
  <section class="simple-only"><div class="sec-head" data-head="plain"><div><h2></h2></div></div><div class="card" id="plain"></div></section>
  <section class="grid-2">
    <div class="card pad"><div class="sec-head" data-head="funnel" style="margin-bottom:8px"><div><h2 style="font-size:20px"></h2></div></div><div id="funnel"></div></div>
    <div class="card pad"><div class="sec-head" data-head="segments" style="margin-bottom:8px"><div><h2 style="font-size:20px"></h2></div></div><div id="segments"></div></div>
  </section>
  <section id="friction-sec"><div class="sec-head" data-head="friction"><div><h2></h2><p></p></div><div id="frictionTabs"></div></div><div class="card" id="friction"></div></section>
  <section id="experiments"><div class="sec-head" data-head="experiments"><div><h2></h2><p></p></div></div><div class="card" id="backlog"></div><details class="formula expert-only" id="formula"></details></section>
  <section id="auditors" class="expert-only"><div class="sec-head" data-head="auditors"><div><h2></h2><p></p></div><div id="auditTabs"></div></div>
    <div class="auds" id="auds"></div><div class="dim" id="consMeta" style="font-size:12.5px;margin:0 0 10px"></div><div class="card" id="consensus"></div></section>
  <section id="journeys"><div class="sec-head" data-head="journeys"><div><h2></h2><p></p></div></div>
    <div class="card jr"><div class="roster"><div class="roster-top"><div class="seg" id="jrFilter" role="group"></div></div><div class="roster-list" id="roster"></div></div><div class="detail" id="detail" aria-live="polite"></div></div></section>
  <section id="method-sec" class="expert-only"><div class="sec-head" data-head="method"><div><h2></h2></div></div><div class="card pad" id="method"></div></section>
  <footer id="footer"></footer>
</main>
<div class="lightbox" id="lightbox" hidden><img alt=""></div>
<script id="ba-data" type="application/json">${json}</script>
<script>${js}</script>
</body></html>`;
}
