// HTML templates for the Buyer Arena website. Pure functions: (ctx) => string. No dependencies.
// ctx: { base, origin, lang, hasOg, v, state: 'prelaunch' | 'public', version, hasSelfAudit }
import {
  LANGS,
  REPO,
  WORKFLOW,
  COMMANDS,
  PANELS,
  INTEGRATIONS,
  STATUSES,
  STATUS_LABEL,
  DEMO_FACTS,
  content,
} from './content.mjs';

export const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
  );

/** Site-relative path of a page (no base). '' is the root (x-default). */
export function pagePath(lang, page) {
  if (!lang) return '';
  return page === 'run' ? `${lang}/run.html` : `${lang}/`;
}

/** Real demo report, relative to the site base. */
export const DEMO_REPORT = 'report/demo/report.html';

const isPublic = (ctx) => ctx.state === 'public';

const svg = (d, size = 18, extra = '') =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;

const ICONS = {
  users: svg(
    '<path d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
    20,
  ),
  developers: svg('<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="m7.5 10 2.5 2-2.5 2M12.5 15h4"/>', 20),
  commercial: svg('<path d="M4 19.5h16"/><path d="m5 15 4.5-4.5 3.5 3L19 7.5"/><path d="M15 7.5h4v4"/>', 20),
  security: svg(
    '<path d="M12 3.2 5 6v5.4c0 4.3 3 7.9 7 9.4 4-1.5 7-5.1 7-9.4V6z"/><path d="M12 8.5v4.2M12 15.6v.1"/>',
    20,
  ),
  segments: svg('<circle cx="9" cy="10" r="5.2"/><circle cx="15" cy="10" r="5.2"/><circle cx="12" cy="15" r="5.2"/>', 20),
};

const I = {
  theme:
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 3.8a8.2 8.2 0 0 1 0 16.4z" fill="currentColor"/></svg>',
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 16, ' stroke-width="2"'),
  ext: svg(
    '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    14,
    ' stroke-width="2"',
  ),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 18, ' stroke-width="2"'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7"/>', 16),
  alert: svg('<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.2M12 16.8v.1"/>', 18),
  pause: svg('<path d="M9 6v12M15 6v12"/>', 14, ' stroke-width="2.4"'),
  github:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2.5a9.7 9.7 0 0 0-3.07 18.9c.49.09.66-.21.66-.47v-1.7c-2.7.59-3.27-1.15-3.27-1.15-.44-1.12-1.08-1.42-1.08-1.42-.88-.6.07-.59.07-.59.97.07 1.49 1 1.49 1 .87 1.48 2.27 1.05 2.83.8.09-.63.34-1.05.62-1.3-2.16-.24-4.42-1.08-4.42-4.8 0-1.06.38-1.93 1-2.61-.1-.25-.43-1.24.1-2.57 0 0 .82-.26 2.67 1a9.2 9.2 0 0 1 4.86 0c1.85-1.26 2.67-1 2.67-1 .53 1.33.2 2.32.1 2.57.62.68 1 1.55 1 2.61 0 3.73-2.27 4.55-4.43 4.79.35.3.66.9.66 1.8v2.67c0 .26.17.57.67.47A9.7 9.7 0 0 0 12 2.5"/></svg>',
};

function head(ctx, meta, page) {
  const { base, origin, lang, hasOg, v } = ctx;
  const c = content[lang || 'en'];
  const path = pagePath(lang, page);
  const abs = (p) => origin + base + p;
  const alternates = LANGS.map(
    (l) => `<link rel="alternate" hreflang="${l}" href="${abs(pagePath(l, page))}">`,
  ).join('\n  ');
  const xdef = page === 'run' ? pagePath('en', 'run') : '';
  const ogImage = hasOg
    ? `<meta property="og:image" content="${abs('assets/og.png')}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(meta.title)}">
  <meta name="twitter:image" content="${abs('assets/og.png')}">`
    : '';
  const others = LANGS.filter((l) => l !== c.lang)
    .map((l) => `<meta property="og:locale:alternate" content="${content[l].locale.replace('-', '_')}">`)
    .join('\n  ');
  const noindex = page === '404' ? '\n  <meta name="robots" content="noindex">' : '';
  const canonical =
    page === '404'
      ? ''
      : `<link rel="canonical" href="${abs(path)}">
  ${alternates}
  <link rel="alternate" hreflang="x-default" href="${abs(xdef)}">`;
  return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>${esc(meta.title)}</title>
  <meta name="description" content="${esc(meta.desc)}">${noindex}
  ${canonical}
  <meta name="theme-color" content="#f5f5f7" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Buyer Arena">
  <meta property="og:title" content="${esc(meta.title)}">
  <meta property="og:description" content="${esc(meta.desc)}">
  <meta property="og:url" content="${abs(path)}">
  <meta property="og:locale" content="${c.locale.replace('-', '_')}">
  ${others}
  ${ogImage}
  <meta name="twitter:card" content="${hasOg ? 'summary_large_image' : 'summary'}">
  <meta name="twitter:title" content="${esc(meta.title)}">
  <meta name="twitter:description" content="${esc(meta.desc)}">
  <meta name="ba-launch-state" content="${esc(ctx.state)}">
  <link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="${base}assets/inter-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${base}assets/styles.css?v=${v.css}">
  <script>try{var t=localStorage.getItem('ba-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}</script>
  <script src="${base}assets/app.js?v=${v.js}" defer></script>${page === 'index' ? jsonLd(ctx) : ''}
</head>`;
}

function jsonLd(ctx) {
  const c = content[ctx.lang || 'en'];
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Buyer Arena',
    description: c.meta.index.desc,
    url: ctx.origin + ctx.base + pagePath(ctx.lang, 'index'),
    inLanguage: c.lang,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Windows, macOS, Linux',
    license: 'https://www.apache.org/licenses/LICENSE-2.0',
    ...(ctx.version ? { softwareVersion: ctx.version } : {}),
    ...(isPublic(ctx) ? { sameAs: [REPO], offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' } } : {}),
  };
  return `\n  <script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

function langSwitch(ctx, page, id) {
  const cur = ctx.lang || 'en';
  const c = content[cur];
  const links = LANGS.map((l) => {
    const on = l === cur;
    return `<a class="lb" href="${ctx.base}${pagePath(l, page)}" hreflang="${l}" lang="${l}"${on ? ' aria-current="page"' : ''} aria-label="${content[l].label}">${l.toUpperCase()}</a>`;
  }).join('');
  return `<nav class="seg lang" ${id ? `id="${id}" ` : ''}aria-label="${esc(c.nav.langLabel)}">${links}</nav>`;
}

function nav(ctx, page) {
  const c = content[ctx.lang || 'en'];
  const home = `${ctx.base}${pagePath(ctx.lang, 'index')}`;
  const pre = page === 'index' ? '' : `${ctx.base}${pagePath(ctx.lang || 'en', 'index')}`;
  const items = [
    ['how', c.nav.how],
    ['report', c.nav.report],
    ['integrations', c.nav.integrations],
    ['offline', c.nav.offline],
    ['limits', c.nav.limits],
    ['quickstart', c.nav.quickstart],
  ];
  const links = items.map(([id, t]) => `<a href="${pre}#${id}">${esc(t)}</a>`).join('');
  const runHref = `${ctx.base}${pagePath(ctx.lang || 'en', 'run')}`;
  const runOn = page === 'run' ? ' aria-current="page"' : '';
  return `<a class="skip" href="#main">${esc(c.nav.skip)}</a>
<header class="nav" id="nav">
  <div class="wrap nav-row">
    <a class="brand" href="${home}" aria-label="Buyer Arena — ${esc(c.nav.home)}"><span class="brand-mark" aria-hidden="true">▲</span><span class="brand-word">BUYER ARENA</span></a>
    <nav class="links" aria-label="${esc(c.nav.sections)}">${links}</nav>
    <div class="controls">
      ${langSwitch(ctx, page, 'lang')}
      <button class="icon-btn" id="themeBtn" type="button" aria-label="${esc(c.nav.theme)}" title="${esc(c.nav.theme)}">${I.theme}</button>
      <a class="btn btn-primary run-btn" href="${runHref}"${runOn}>${esc(c.nav.run)}</a>
    </div>
  </div>
  <nav class="subnav" aria-label="${esc(c.nav.sections)} (2)">
    <a class="sub-run" href="${runHref}"${runOn}>${esc(c.nav.run)}</a>${links}
  </nav>
</header>`;
}

/** Source CTA: a GitHub link when public; a visibly disabled, non-link label in prelaunch. */
function sourceCta(ctx, c, cls = 'btn btn-ghost btn-lg') {
  if (isPublic(ctx))
    return `<a class="${cls}" href="${REPO}" rel="noopener">${I.github} ${esc(c.hero.source)} ${I.ext}</a>`;
  return `<span class="${cls} is-disabled" role="link" aria-disabled="true">${I.lock} ${esc(c.hero.sourceSoon)}</span>`;
}

function footer(ctx, page) {
  const lang = ctx.lang || 'en';
  const c = content[lang];
  const source = isPublic(ctx)
    ? `<li><a href="${REPO}" rel="noopener">${I.github}${esc(c.hero.source)}</a></li>
      <li><a href="${REPO}/blob/main/LICENSE" rel="noopener license">${esc(c.footer.license)}</a></li>`
    : `<li><span class="foot-off" aria-disabled="true" role="link">${I.lock}${esc(c.hero.sourceSoon)}</span></li>
      <li><span class="foot-plain">${esc(c.footer.license)}</span></li>`;
  const self = ctx.hasSelfAudit
    ? `\n      <li><a href="${ctx.base}report/">${esc(c.footer.selfAudit)}</a></li>`
    : '';
  return `<footer class="foot">
  <div class="wrap foot-grid">
    <div>
      <a class="brand" href="${ctx.base}${pagePath(ctx.lang, 'index')}"><span class="brand-mark" aria-hidden="true">▲</span><span class="brand-word">BUYER ARENA</span></a>
      <p class="muted foot-tag">${esc(c.footer.tagline)}</p>
      <p class="foot-state"><span class="state-dot" aria-hidden="true"></span>${esc(isPublic(ctx) ? c.state.public : c.state.prelaunch)}</p>
      <p class="foot-privacy-wrap"><a class="pill good foot-privacy" href="${ctx.base}${lang}/#safety" rel="privacy-policy"><span class="dot" aria-hidden="true"></span>${esc(c.footer.privacy)}</a></p>
    </div>
    <ul class="foot-links">
      ${source}
      <li><a href="${ctx.base}${DEMO_REPORT}">${esc(c.footer.report)}</a></li>${self}
      <li><a href="${ctx.base}${pagePath(lang, 'run')}">${esc(c.nav.run)}</a></li>
    </ul>
    <div class="foot-lang">
      <span class="dim">${esc(c.footer.langs)}</span>
      ${langSwitch(ctx, page === '404' ? 'index' : page)}
    </div>
  </div>
</footer>`;
}

function codeBlock(id, cmd, c) {
  return `<div class="code"><pre><code id="${id}">${esc(cmd)}</code></pre><button class="copy" type="button" data-copy-target="${id}" data-copied="${esc(c.copied)}" aria-label="${esc(c.copy)}: ${esc(cmd)}">${esc(c.copy)}</button></div>`;
}

function stacked(mix, names) {
  const total = PANELS.reduce((s, p) => s + mix[p], 0) || 1;
  const segs = PANELS.map(
    (p) => `<i class="p-${p}" style="width:${((mix[p] / total) * 100).toFixed(2)}%"></i>`,
  ).join('');
  const legend = PANELS.map(
    (p) =>
      `<li><span class="sw p-${p}" aria-hidden="true"></span><span>${esc(names[p])}</span><b>${Math.round((mix[p] / total) * 100)} %</b></li>`,
  ).join('');
  return `<div class="stack" aria-hidden="true">${segs}</div><ul class="stack-legend">${legend}</ul>`;
}

/* ───────────────────────── hero scene (moment #1) ─────────────────────────
   Static markup is the FINAL frame (what no-JS and reduced-motion visitors see).
   app.js animates the same elements; geometry constants are mirrored there. */
export const SCENE = {
  // Outcome per buyer: 0/1/2 = abandons at gate, 3 = reaches the goal.
  baseline: [3, 1, 0, 3, 1, 1, 3, 2, 1, 3, 0, 1, 3, 1, 2, 3, 0, 3, 1, 3],
  candidate: [3, 3, 0, 3, 3, 3, 3, 2, 3, 3, 0, 3, 3, 1, 3, 3, 0, 3, 3, 3],
  gates: [150, 250, 350],
  goal: 440,
  cy: 144,
};
const half = (x) => 86 - (Math.max(40, Math.min(440, x)) - 40) * (50 / 400);
const lane = (i) => -1 + (2 * ((i * 7) % 20) + 1) / 20;
const laneY = (o, x) => SCENE.cy + o * half(x) * 0.8;
function finalPos(outcomes, i, k) {
  const g = outcomes[i];
  if (g === 3) return [452 + (k % 3) * 10, 124 + Math.floor(k / 3) * 10];
  const x = SCENE.gates[g] - 7;
  return [x, laneY(lane(i), x)];
}
const r1 = (n) => Math.round(n * 10) / 10;

function heroScene(c) {
  const s = c.hero.scene;
  const F = DEMO_FACTS;
  let k = 0;
  const dots = SCENE.candidate
    .map((g, i) => {
      const [x, y] = finalPos(SCENE.candidate, i, g === 3 ? k++ : 0);
      return `<circle class="hs-dot ${g === 3 ? 'ok' : 'ab'}" r="4" cx="${r1(x)}" cy="${r1(y)}" data-o="${lane(i)}" data-b="${SCENE.baseline[i]}" data-c="${g}"/>`;
    })
    .join('');
  const top = (x) => SCENE.cy - half(x);
  const gates = SCENE.gates
    .map(
      (x) =>
        `<line class="hs-gate" x1="${x}" x2="${x}" y1="${r1(top(x) + 2)}" y2="${r1(SCENE.cy + half(x) - 2)}"/>`,
    )
    .join('');
  const labels = [...SCENE.gates, 462]
    .map((x, i) => `<text class="hs-lbl" x="${x}" y="252" text-anchor="middle">${esc(s.stages[i])}</text>`)
    .join('');
  const chips = s.chips
    .map(
      (t, i) =>
        `<g class="hs-chip" data-i="${i}"><rect x="${i * 162}" y="268" width="152" height="24" rx="7"/><text x="${i * 162 + 76}" y="284" text-anchor="middle">${esc(t)}</text></g>`,
    )
    .join('');
  const routes = s.routes
    .map((t, i) => {
      const y = 318 + i * 21;
      return `<path class="hs-wire" id="hs-in-${i}" d="M98 ${y + 9} C140 ${y + 9} 140 363 180 363"/><g class="hs-route"><rect x="0" y="${y}" width="98" height="18" rx="9"/><text x="49" y="${y + 13}" text-anchor="middle">${esc(t)}</text></g>`;
    })
    .join('');
  const outs = s.outputs
    .map((t, i) => {
      const y = 322 + i * 30;
      return `<path class="hs-wire" id="hs-out-${i}" d="M304 363 C334 363 334 ${y + 11} 362 ${y + 11}"/><g class="hs-out" data-i="${i}"><rect x="362" y="${y}" width="118" height="22" rx="11"/><text x="421" y="${y + 15}" text-anchor="middle">${esc(t)}</text></g>`;
    })
    .join('');
  const fx = SCENE.gates[1];
  const legend = s.legend
    .map((t, i) => {
      const y = 10 + i * 15;
      const mark =
        i === 2
          ? `<path class="hs-warn" d="M366 ${y + 4} l4 -7 l4 7z"/>`
          : `<circle class="hs-dot ${i ? 'ab' : 'ok'}" cx="370" cy="${y}" r="4"/>`;
      return `${mark}<text class="hs-lbl" x="380" y="${y + 4}">${esc(t)}</text>`;
    })
    .join('');
  return `<figure class="scene card" id="scene">
  <svg class="hs" viewBox="0 0 480 420" role="img" aria-label="${esc(c.hero.sceneLabel)}" focusable="false">
    <g aria-hidden="true">
      <text class="hs-k" x="0" y="12">${esc(s.baseline)}</text>
      <text class="hs-v" x="0" y="40" data-k="b">${F.baseline}%</text>
      <text class="hs-k" x="118" y="12">${esc(s.candidate)}</text>
      <text class="hs-v" x="118" y="40" data-k="c">${F.candidate}%</text>
      <g class="hs-delta" data-k="d"><rect x="236" y="18" width="84" height="26" rx="13"/><text x="278" y="36" text-anchor="middle">+${F.delta} pp</text></g>
      ${legend}
      <path class="hs-funnel" d="M40 58 L440 108 L440 180 L40 230 Z"/>
      ${gates}
      <g class="hs-friction"><path class="hs-warn" d="M${fx - 7} ${r1(top(fx) - 4)} l7 -12 l7 12z"/><text class="hs-lbl hs-flbl" x="${fx}" y="${r1(top(fx) - 20)}" text-anchor="middle">${esc(s.friction)}</text></g>
      ${labels}
      ${dots}
      ${chips}
      <line class="hs-div" x1="0" x2="480" y1="305" y2="305"/>
      ${routes}
      ${outs}
      <g class="hs-core"><rect x="180" y="340" width="124" height="46" rx="10"/><text x="242" y="368" text-anchor="middle">▲ BUYER ARENA</text></g>
    </g>
  </svg>
  <figcaption class="scene-cap"><span>${esc(c.hero.caption)}</span><button class="scene-btn" type="button" id="sceneBtn" hidden data-pause="${esc(c.hero.pause)}" data-play="${esc(c.hero.play)}" data-replay="${esc(c.hero.replay)}">${I.pause}<span>${esc(c.hero.pause)}</span></button></figcaption>
</figure>`;
}

/* ───────────────────────── offline boundary (moment #3) ───────────────────────── */
const MODES = ['offline', 'local', 'hybrid', 'online'];
function boundary(c) {
  const o = c.offline;
  const radios = MODES.map(
    (m) =>
      `<label><input type="radio" name="netmode" value="${m}"${m === 'local' ? ' checked' : ''}><span>${m.toUpperCase()}</span></label>`,
  ).join('');
  const link = (cls, allowedByDefault) =>
    `<div class="bd-link ${cls}${allowedByDefault ? '' : ' is-blocked'}"><span class="bd-st st-allowed"${allowedByDefault ? '' : ' hidden'}>${esc(o.allowed)}</span><span class="bd-st st-blocked"${allowedByDefault ? ' hidden' : ''}>✕ ${esc(o.blocked)}</span></div>`;
  return `<div class="boundary card" id="boundary" data-mode="local">
    <fieldset class="modes">
      <legend>${esc(o.modesTitle)}</legend>
      <div class="seg seg-radio modes-seg">${radios}</div>
    </fieldset>
    <div class="bd">
      <div class="bd-machine">
        <p class="bd-title">${esc(o.machine)}</p>
        <ul>${o.machineItems.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>
      ${link('bd-l-lan', true)}
      <div class="bd-box bd-lan"><p>${esc(o.lan)}</p></div>
      ${link('bd-l-cloud', false)}
      <div class="bd-box bd-cloud">
        <p class="bd-title">${esc(o.cloud)}</p>
        <p class="c-sel">${esc(o.cloudItem)}</p>
        <p class="c-any" hidden>${esc(o.cloudAny)}</p>
      </div>
    </div>
    <ul class="mode-desc">${MODES.map((m) => `<li data-m="${m}"${m === 'local' ? ' class="on"' : ''}><b>${m.toUpperCase()}</b> ${esc(o.modes[m])}</li>`).join('')}</ul>
    <p class="sr" id="bdLive" aria-live="polite"></p>
  </div>`;
}

export function indexPage(ctx) {
  const lang = ctx.lang || 'en';
  const c = content[lang];
  const pub = isPublic(ctx);
  const names = Object.fromEntries(PANELS.map((p) => [p, c.panels.items[p].name]));
  const h = c.hero;
  const reportHref = `${ctx.base}${DEMO_REPORT}`;
  const F = DEMO_FACTS;

  const panelCards = PANELS.map((p) => {
    const it = c.panels.items[p];
    return `<article class="card panel">
      <div class="panel-top"><span class="ic p-${p}-ic">${ICONS[p]}</span><code class="key">${p}</code></div>
      <h3>${esc(it.name)}</h3>
      <p class="intent">${esc(it.intent)}</p>
      <ul class="ticks">${it.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${it.note ? `<p class="note"><span class="dot" aria-hidden="true"></span>${esc(it.note)}</p>` : ''}
    </article>`;
  }).join('\n');

  const m = c.mix;
  const q = c.quick;
  const r = c.report;
  const stepKeys = pub
    ? ['clone', 'cd', 'install', 'demo', 'studio', 'launch', 'agentEval']
    : ['install', 'demo', 'studio', 'launch', 'agentEval'];
  const steps = stepKeys
    .map(
      (k, i) => `<li class="qs">
      <span class="qs-n" aria-hidden="true">${i + 1}</span>
      <div class="qs-t">${esc(q.steps[k])}</div>
      ${codeBlock(`cmd-${k}`, COMMANDS[k], q)}
    </li>`,
    )
    .join('\n');

  const flow = c.how.steps
    .map(
      ([t, d], i) => `<li class="flow-step">
        <span class="flow-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
        <div class="flow-body"><h3><span class="sr">${i + 1}. </span>${esc(t)}</h3><p>${esc(d)}</p>${c.how.tags[i] ? `<span class="tag mono">${esc(c.how.tags[i])}</span>` : ''}</div>
      </li>`,
    )
    .join('\n');

  const facts = [
    [`${F.baseline} %`, r.facts.baseline],
    [`${F.candidate} %`, r.facts.candidate],
    [`+${F.delta} pp`, `${r.facts.delta} +${F.ciLow} … +${F.ciHigh} pp`, 'good'],
    [`${F.journeys}`, `${r.facts.journeys} · ${F.shots} ${r.facts.shots}`],
    ['$0', r.facts.cost],
  ]
    .map(
      ([v, l, cls]) =>
        `<div class="fact${cls ? ' ' + cls : ''}"><dt>${esc(l)}</dt><dd>${esc(v)}</dd></div>`,
    )
    .join('');

  const capItems = c.caps.items
    .map(
      ([t, d, exp]) =>
        `<li class="cap${exp ? ' exp' : ''}"><h3>${esc(t)}${exp ? ` <span class="badge b-experimental">${esc(c.caps.experimental)}</span>` : ''}</h3><p>${d}</p></li>`,
    )
    .join('');

  const ig = c.integ;
  const wall = INTEGRATIONS.map(
    (g) => `<section class="ig-group card" aria-labelledby="ig-${g.key}">
        <h3 id="ig-${g.key}" class="ig-h">${esc(ig.groups[g.key])}</h3>
        <ul>${g.items
          .map(
            ([name, st, note]) =>
              `<li><span class="ig-name">${esc(name)}${note ? `<small>${esc(ig.notes[note])}</small>` : ''}</span><span class="badge b-${st}">${STATUS_LABEL[st]}</span></li>`,
          )
          .join('')}</ul>
      </section>`,
  ).join('\n      ');
  const legend = STATUSES.map(
    (st) => `<div><dt><span class="badge b-${st}">${STATUS_LABEL[st]}</span></dt><dd>${esc(ig.legend[st])}</dd></div>`,
  ).join('');

  const o = c.offline;
  const sa = c.selfAudit;

  return `<!doctype html>
<html lang="${lang}">
${head(ctx, c.meta.index, 'index')}
<body>
${nav(ctx, 'index')}
<main class="wrap" id="main">
  <section class="hero" id="top" aria-labelledby="h-hero">
    <div class="hero-copy">
      <p class="state-pill ${pub ? 'is-public' : ''}"><span class="state-dot" aria-hidden="true"></span>${esc(pub ? c.state.public : c.state.prelaunch)}${ctx.version ? ` <span class="mono state-v">v${esc(ctx.version)}</span>` : ''}</p>
      <h1 id="h-hero"><span class="h1-brand"><span aria-hidden="true">▲ </span>BUYER ARENA</span> ${h.title}</h1>
      <p class="sub">${esc(h.sub)}</p>
      <div class="ctas">
        <a class="btn btn-primary btn-lg" href="#quickstart">${esc(h.cta1)}</a>
        <a class="btn btn-ghost btn-lg" href="${reportHref}">${esc(h.cta2)} ${I.arrow}</a>
        ${sourceCta(ctx, c)}
      </div>
    </div>
    ${heroScene(c)}
  </section>

  <section id="how" aria-labelledby="h-how">
    <div class="sec-head"><h2 id="h-how">${esc(c.how.title)}</h2><p>${esc(c.how.lead)}</p></div>
    <ol class="flow" id="flow">
${flow}
    </ol>
  </section>

  <section id="report" aria-labelledby="h-report">
    <div class="sec-head"><h2 id="h-report">${esc(r.title)}</h2><p>${esc(r.lead)}</p></div>
    <div class="report card">
      <div class="report-main">
        <p class="fiction"><span class="dot" aria-hidden="true"></span>${esc(r.note)}</p>
        <dl class="facts">${facts}</dl>
        <ul class="checks">${r.points.map((x) => `<li>${I.check}<span>${x}</span></li>`).join('')}</ul>
        <p class="report-cta"><a class="btn btn-primary btn-lg" href="${reportHref}">${esc(r.cta)} ${I.arrow}</a><span class="dim">${esc(r.meta)}</span></p>
      </div>
    </div>
  </section>

  <section id="limits" aria-labelledby="h-limits">
    <div class="sec-head"><h2 id="h-limits">${esc(c.limits.title)}</h2><p>${esc(c.limits.lead)}</p></div>
    <ul class="limits">${c.limits.items.map(([t, d]) => `<li class="card"><span class="ic warn-ic">${I.alert}</span><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></li>`).join('')}</ul>
  </section>

  <section id="panels" aria-labelledby="h-panels">
    <div class="sec-head"><h2 id="h-panels">${esc(c.panels.title)}</h2><p>${esc(c.panels.lead)}</p></div>
    <div class="panels">
${panelCards}
    </div>
  </section>

  <section id="capabilities" aria-labelledby="h-caps">
    <div class="sec-head"><h2 id="h-caps">${esc(c.caps.title)}</h2><p>${esc(c.caps.lead)}</p></div>
    <ul class="caps">${capItems}</ul>
  </section>

  <section id="integrations" aria-labelledby="h-integ">
    <div class="sec-head"><h2 id="h-integ">${esc(ig.title)}</h2><p>${esc(ig.lead)}</p></div>
    <div class="wall">
      ${wall}
    </div>
    <p class="disclaimer">${esc(ig.disclaimer)}</p>
    <div class="legend card">
      <h3 class="h3-sm">${esc(ig.legendTitle)}</h3>
      <dl>${legend}</dl>
    </div>
  </section>

  <section id="offline" aria-labelledby="h-offline">
    <div class="sec-head"><h2 id="h-offline">${esc(o.title)}</h2><p>${esc(o.lead)}</p></div>
    <ul class="offline-points">${o.points.map((x) => `<li>${I.check}<span>${esc(x)}</span></li>`).join('')}</ul>
    ${boundary(c)}
    <p class="ledger">${esc(o.ledger)}</p>
  </section>

  <section id="mix" aria-labelledby="h-mix">
    <div class="sec-head"><h2 id="h-mix">${esc(m.title)}</h2><p>${esc(m.lead)}</p></div>
    <div class="grid-2">
      <div class="card pad">
        <p class="eyebrow">${esc(m.exampleLabel)}</p>
        ${stacked({ users: 45, developers: 15, commercial: 15, security: 10, segments: 15 }, names)}
      </div>
      <div class="card pad">
        <h3 class="h3-sm">${esc(m.depthTitle)}</h3>
        <dl class="depths">${['quick', 'standard', 'deep'].map((d) => `<div${d === 'standard' ? ' class="on"' : ''}><dt><code>${d}</code> ${esc(m.depth[d][0])}</dt><dd>${esc(m.depth[d][1])}</dd></div>`).join('')}</dl>
        <a class="btn btn-primary" href="${ctx.base}${pagePath(lang, 'run')}">${esc(m.cta)} ${I.arrow}</a>
      </div>
    </div>
  </section>

  <section id="quickstart" aria-labelledby="h-quick">
    <div class="sec-head"><h2 id="h-quick">${esc(q.title)}</h2><p>${esc(q.lead)}</p></div>
    ${pub ? '' : `<div class="soon" role="note"><span class="ic warn-ic">${I.lock}</span><div><p class="soon-t">${esc(q.soonTitle)}</p><p>${esc(q.soonText)}</p></div></div>`}
    <ol class="card qs-list">
${steps}
    </ol>
    <div class="grid-2 qs-more">
      <div class="card pad">
        <h3 class="h3-sm">${esc(q.ciTitle)}</h3>
        <p class="muted">${esc(q.ciText)}</p>
        ${pub ? `<a class="btn btn-ghost" href="${WORKFLOW}" rel="noopener">${I.github} ${esc(q.ciLink)} ${I.ext}</a>` : `<span class="btn btn-ghost is-disabled" role="link" aria-disabled="true">${I.lock} ${esc(q.ciLink)} · ${esc(c.state.soon)}</span>`}
      </div>
      <div class="card pad" id="agents">
        <h3 class="h3-sm">${esc(q.agentsTitle)}</h3>
        <p class="muted">${esc(q.agentsText)}</p>
        ${codeBlock('cmd-mcp', COMMANDS.mcp, q)}
        <p class="note good-note"><span class="dot" aria-hidden="true"></span>${esc(q.agentsNote)}</p>
      </div>
    </div>
  </section>

  <section id="safety" aria-labelledby="h-safety">
    <div class="sec-head"><h2 id="h-safety">${esc(c.safety.title)}</h2><p>${esc(c.safety.lead)}</p></div>
    <ul class="safety">${c.safety.items.map(([t, d]) => `<li class="card"><span class="ic good-ic">${I.check}</span><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></li>`).join('')}</ul>
  </section>

  <section id="self-audit" class="self-audit" aria-labelledby="h-self">
    <div class="card pad self-card">
      <p class="self-label">${esc(sa.label)}</p>
      <h2 id="h-self" class="h3-sm">${esc(sa.title)}</h2>
      <p class="muted">${esc(sa.text)}</p>
      ${ctx.hasSelfAudit ? `<a href="${ctx.base}report/">${esc(sa.link)}</a>` : ''}
    </div>
  </section>
</main>
${footer(ctx, 'index')}
</body>
</html>
`;
}

export function runPage(ctx) {
  const lang = ctx.lang;
  const c = content[lang];
  const r = c.run;
  const pub = isPublic(ctx);
  const names = Object.fromEntries(PANELS.map((p) => [p, c.panels.items[p].name]));
  const defaults = { users: 40, developers: 15, commercial: 15, security: 15, segments: 15 };
  const i18n = {
    copy: r.copy,
    copied: r.copied,
    minutes: r.minutes,
    skipped: r.skipped,
    under1: r.under1,
    zeroError: r.zeroError,
    locale: c.locale,
  };
  const sliders = PANELS.map(
    (p) => `<div class="slider">
          <label for="w-${p}"><span class="sw p-${p}" aria-hidden="true"></span>${esc(names[p])}</label>
          <input type="range" id="w-${p}" name="${p}" min="0" max="100" step="1" value="${defaults[p]}" data-panel="${p}">
          <output for="w-${p}" id="o-${p}">${defaults[p]}</output>
        </div>`,
  ).join('\n        ');
  const rows = PANELS.map(
    (p) =>
      `<tr><th scope="row"><span class="sw p-${p}" aria-hidden="true"></span>${esc(names[p])}</th><td class="num" id="s-${p}">—</td><td class="num" id="n-${p}">—</td></tr>`,
  ).join('');

  return `<!doctype html>
<html lang="${lang}">
${head(ctx, c.meta.run, 'run')}
<body>
${nav(ctx, 'run')}
<main class="wrap" id="main">
  <section class="page-head" aria-labelledby="h-run">
    <p class="eyebrow">${esc(r.eyebrow)}</p>
    <h1 class="h1-page" id="h-run">${esc(r.title)}</h1>
    <p class="sub">${esc(r.lead)}</p>
    ${pub ? '' : `<p class="state-pill"><span class="state-dot" aria-hidden="true"></span>${esc(r.soonNote)}</p>`}
  </section>
  <form class="builder" id="builder" autocomplete="off" novalidate>
    <div class="card pad">
      <fieldset class="fs">
        <legend>${esc(r.mixTitle)}</legend>
        <p class="help-text">${esc(r.mixHelp)}</p>
        ${sliders}
      </fieldset>
      <div class="fields">
        <div class="field">
          <label for="size">${esc(r.size)}</label>
          <input type="number" id="size" name="size" min="1" max="500" step="1" value="40" inputmode="numeric">
        </div>
        <fieldset class="field">
          <legend>${esc(r.depth)}</legend>
          <div class="seg seg-radio">${['quick', 'standard', 'deep'].map((d) => `<label><input type="radio" name="depth" value="${d}"${d === 'standard' ? ' checked' : ''}><span>${esc(r.depthOpts[d])}</span></label>`).join('')}</div>
        </fieldset>
        <div class="field">
          <label for="repo">${esc(r.repo)}</label>
          <input type="text" id="repo" name="repo" value="." spellcheck="false">
        </div>
        <div class="field">
          <label for="url">${esc(r.url)}</label>
          <input type="url" id="url" name="url" value="https://your-site.example" spellcheck="false">
        </div>
        <div class="field check-field">
          <input type="checkbox" id="execute" name="execute">
          <label for="execute">${esc(r.execute)}<small>${esc(r.executeHelp)}</small></label>
        </div>
      </div>
      <p class="help-text">${esc(r.minNote)} ${esc(r.depthNote)}</p>
      <button class="btn btn-ghost" type="button" id="reset">${esc(r.reset)}</button>
    </div>

    <div class="result">
      <div class="card pad" aria-live="polite">
        <h2 class="h2-sm">${esc(r.resultTitle)}</h2>
        <div class="stack" id="stack" aria-hidden="true">${PANELS.map((p) => `<i class="p-${p}" data-seg="${p}"></i>`).join('')}</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th scope="col"><span class="sr">${esc(r.panel)}</span></th><th scope="col" class="num">${esc(r.share)}</th><th scope="col" class="num">${esc(r.participants)}</th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><th scope="row">${esc(r.total)}</th><td class="num">100 %</td><td class="num" id="n-total">—</td></tr></tfoot>
          </table>
        </div>
        <p class="estimate"><span class="dim">${esc(r.estimate)}</span> <b id="est">—</b></p>
        <p class="help-text">${esc(r.estimateNote)}</p>
        <p class="error" id="err" hidden></p>
      </div>
      <div class="card pad">
        <h2 class="h2-sm">${esc(r.command)}</h2>
        <div class="code"><pre><code id="cmd"></code></pre><button class="copy" type="button" data-copy-target="cmd" data-copied="${esc(r.copied)}">${esc(r.copy)}</button></div>
      </div>
      <div class="card pad">
        <h2 class="h2-sm">${esc(r.ghTitle)}</h2>
        <p class="muted">${esc(r.ghLead)}</p>
        <dl class="gh" id="gh">
          <div><dt>url</dt><dd><code id="gh-url"></code></dd></div>
          <div><dt>mix</dt><dd><code id="gh-mix"></code></dd></div>
          <div><dt>size</dt><dd><code id="gh-size"></code></dd></div>
          <div><dt>depth</dt><dd><code id="gh-depth"></code></dd></div>
        </dl>
        ${pub ? `<a class="btn btn-ghost" href="${WORKFLOW}" rel="noopener">${I.github} ${esc(r.ghLink)} ${I.ext}</a>` : `<span class="btn btn-ghost is-disabled" role="link" aria-disabled="true">${I.lock} ${esc(r.ghLink)} · ${esc(c.state.soon)}</span>`}
      </div>
    </div>
  </form>
  <p class="sr" id="live" aria-live="polite"></p>
  <script type="application/json" id="i18n">${JSON.stringify(i18n).replace(/</g, '\\u003c')}</script>
</main>
${footer(ctx, 'run')}
</body>
</html>
`;
}

export function notFoundPage(ctx) {
  const blocks = LANGS.map((l) => {
    const n = content[l].notFound;
    return `<div class="card pad nf" lang="${l}"><h2 class="h2-sm">${esc(n.title)}</h2><p class="muted">${esc(n.text)}</p><a class="btn btn-primary" href="${ctx.base}${pagePath(l, 'index')}">${esc(n.home)} ${I.arrow}</a></div>`;
  }).join('\n');
  const c = content.en;
  return `<!doctype html>
<html lang="en">
${head({ ...ctx, lang: 'en' }, c.meta.notFound, '404')}
<body>
${nav({ ...ctx, lang: 'en' }, '404')}
<main class="wrap" id="main">
  <section class="page-head" aria-labelledby="h-404">
    <p class="eyebrow">404</p>
    <h1 class="h1-page" id="h-404">Page not found</h1>
  </section>
  <div class="nf-grid">
${blocks}
  </div>
</main>
${footer({ ...ctx, lang: 'en' }, '404')}
</body>
</html>
`;
}
