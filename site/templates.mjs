// HTML templates for the Buyer Arena website. Pure functions: (ctx) => string. No dependencies.
import { LANGS, REPO, WORKFLOW, COMMANDS, PANELS, content } from './content.mjs';

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

const ICONS = {
  users:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/></svg>',
  developers:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="m7.5 10 2.5 2-2.5 2M12.5 15h4"/></svg>',
  investors:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5h16"/><path d="m5 15 4.5-4.5 3.5 3L19 7.5"/><path d="M15 7.5h4v4"/></svg>',
  security:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.2 5 6v5.4c0 4.3 3 7.9 7 9.4 4-1.5 7-5.1 7-9.4V6z"/><path d="M12 8.5v4.2M12 15.6v.1"/></svg>',
  segments:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="10" r="5.2"/><circle cx="15" cy="10" r="5.2"/><circle cx="12" cy="15" r="5.2"/></svg>',
};

const I = {
  theme:
    '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 3.8a8.2 8.2 0 0 1 0 16.4z" fill="currentColor"/></svg>',
  arrow:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  ext: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
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
    sameAs: [REPO],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  };
  return `\n  <script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

function langSwitch(ctx, page, id) {
  const cur = ctx.lang || 'en';
  const c = content[cur];
  const links = LANGS.map((l) => {
    const on = l === cur;
    return `<a class="lb" href="${ctx.base}${pagePath(l, page)}" hreflang="${l}" lang="${l}"${on ? ' aria-current="page"' : ''} title="${content[l].label}">${l.toUpperCase()}</a>`;
  }).join('');
  return `<nav class="seg lang" ${id ? `id="${id}" ` : ''}aria-label="${esc(c.nav.langLabel)}">${links}</nav>`;
}

function nav(ctx, page) {
  const c = content[ctx.lang || 'en'];
  const home = `${ctx.base}${pagePath(ctx.lang, 'index')}`;
  const pre = page === 'index' ? '' : home;
  const items = [
    ['panels', c.nav.panels],
    ['evidence', c.nav.evidence],
    ['mix', c.nav.mix],
    ['quickstart', c.nav.quickstart],
    ['phone', c.nav.phone],
    ['safety', c.nav.safety],
  ];
  const links = items.map(([id, t]) => `<a href="${pre}#${id}">${esc(t)}</a>`).join('');
  const runHref = `${ctx.base}${pagePath(ctx.lang || 'en', 'run')}`;
  const runOn = page === 'run' ? ' aria-current="page"' : '';
  return `<a class="skip" href="#main">${esc(c.nav.skip)}</a>
<header class="nav" id="nav">
  <div class="wrap nav-row">
    <a class="brand" href="${home}"><span class="brand-mark" aria-hidden="true">▲</span><span>Buyer Arena</span></a>
    <nav class="links" aria-label="${esc(c.nav.sections)}">${links}</nav>
    <div class="controls">
      ${langSwitch(ctx, page, 'lang')}
      <button class="icon-btn" id="themeBtn" type="button" aria-label="${esc(c.nav.theme)}" title="${esc(c.nav.theme)}">${I.theme}</button>
      <a class="btn btn-primary run-btn" href="${runHref}"${runOn}>${esc(c.nav.run)}</a>
    </div>
  </div>
  <nav class="subnav" aria-label="${esc(c.nav.sections)}">
    <a class="sub-run" href="${runHref}"${runOn}>${esc(c.nav.run)}</a>${links}
  </nav>
</header>`;
}

function footer(ctx, page) {
  const c = content[ctx.lang || 'en'];
  return `<footer class="foot">
  <div class="wrap foot-grid">
    <div>
      <a class="brand" href="${ctx.base}${pagePath(ctx.lang, 'index')}"><span class="brand-mark" aria-hidden="true">▲</span><span>Buyer Arena</span></a>
      <p class="muted foot-tag">${esc(c.footer.tagline)}</p>
      <p class="foot-privacy-wrap"><a class="pill good foot-privacy" href="${ctx.base}${ctx.lang || 'en'}/#safety" rel="privacy-policy"><span class="dot"></span>${esc(c.footer.privacy)}</a></p>
    </div>
    <ul class="foot-links">
      <li><a href="${REPO}" rel="noopener">${I.github}${esc(c.footer.github)}</a></li>
      <li><a href="${REPO}/blob/main/LICENSE" rel="noopener license">${esc(c.footer.license)}</a></li>
      <li><a href="${ctx.base}report/">${esc(c.footer.report)}</a></li>
      <li><a href="${ctx.base}${pagePath(ctx.lang || 'en', 'run')}">${esc(c.nav.run)}</a></li>
    </ul>
    <div class="foot-lang">
      <span class="dim">${esc(c.footer.langs)}</span>
      ${langSwitch(ctx, page === '404' ? 'index' : page)}
    </div>
  </div>
</footer>`;
}

function codeBlock(id, cmd, c) {
  return `<div class="code"><pre><code id="${id}">${esc(cmd)}</code></pre><button class="copy" type="button" data-copy-target="${id}" data-copied="${esc(c.copied)}">${esc(c.copy)}</button></div>`;
}

function term(title, lines, extraClass = '') {
  return `<div class="term ${extraClass}" role="img" aria-label="${esc(title)}">
  <div class="term-bar"><i></i><i></i><i></i><span>${esc(title)}</span></div>
  <pre>${lines.join('\n')}</pre>
</div>`;
}

function stacked(mix, names) {
  const total = PANELS.reduce((s, p) => s + mix[p], 0) || 1;
  const segs = PANELS.map(
    (p) => `<i class="p-${p}" style="width:${((mix[p] / total) * 100).toFixed(2)}%"></i>`,
  ).join('');
  const legend = PANELS.map(
    (p) =>
      `<li><span class="sw p-${p}" aria-hidden="true"></span><span>${esc(names[p])}</span><b>${Math.round((mix[p] / total) * 100)} %</b></li>`,
  ).join('');
  return `<div class="stack" aria-hidden="true">${segs}</div><ul class="stack-legend">${legend}</ul>`;
}

export function indexPage(ctx) {
  const lang = ctx.lang || 'en';
  const c = content[lang];
  const names = Object.fromEntries(PANELS.map((p) => [p, c.panels.items[p].name]));
  const h = c.hero;

  const panelCards = PANELS.map((p) => {
    const it = c.panels.items[p];
    return `<article class="card panel p-${p}-card">
      <div class="panel-top"><span class="ic p-${p}-ic">${ICONS[p]}</span><code class="key">${p}</code></div>
      <h3>${esc(it.name)}</h3>
      <p class="intent">${esc(it.intent)}</p>
      <ul class="ticks">${it.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${it.note ? `<p class="note"><span class="dot"></span>${esc(it.note)}</p>` : ''}
    </article>`;
  }).join('\n');

  const e = c.evidence;
  const m = c.mix;
  const q = c.quick;

  const steps = q.steps
    .map(
      ([t, k], i) => `<li class="qs">
      <span class="qs-n" aria-hidden="true">${i + 1}</span>
      <div class="qs-t">${esc(t)}</div>
      ${codeBlock(`cmd-${k}`, COMMANDS[k], q)}
    </li>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="${lang}">
${head(ctx, c.meta.index, 'index')}
<body>
${nav(ctx, 'index')}
<main class="wrap" id="main">
  <section class="hero" id="top">
    <div>
      <p class="eyebrow">${esc(h.eyebrow)}</p>
      <h1><span class="h1-brand">${esc(h.brand)} —</span> ${h.title}</h1>
      <p class="sub">${esc(h.sub)}</p>
      <p class="price"><span class="price-dot" aria-hidden="true"></span>${esc(h.price)}</p>
      <div class="ctas">
        <a class="btn btn-primary btn-lg" href="#quickstart">${esc(h.cta1)}</a>
        <a class="btn btn-ghost btn-lg" href="${ctx.base}report/">${esc(h.cta2)} ${I.arrow}</a>
      </div>
    </div>
    ${term(h.termTitle, h.term)}
  </section>

  <section id="panels" aria-labelledby="h-panels">
    <div class="sec-head"><div><h2 id="h-panels">${esc(c.panels.title)}</h2><p>${esc(c.panels.lead)}</p></div></div>
    <div class="panels">
${panelCards}
    </div>
  </section>

  <section id="evidence" aria-labelledby="h-evidence">
    <div class="sec-head"><div><h2 id="h-evidence">${esc(e.title)}</h2><p>${esc(e.lead)}</p></div></div>
    <div class="grid-2">
      <div class="card pad">
        <ul class="checks">${e.points.map((x) => `<li>${I.check}<span>${x}</span></li>`).join('')}</ul>
        <div class="kv"><span class="dim">${esc(e.exportsLabel)}</span><div class="chips">${['CSV', 'PNG', 'JPG', 'Markdown', 'JSON', 'PDF'].map((x) => `<span class="chip mono">${x}</span>`).join('')}</div></div>
        <div class="kv"><span class="dim">${esc(e.langsLabel)}</span><div class="chips">${LANGS.map((l) => `<span class="chip mono">${l.toUpperCase()}</span>`).join('')}</div></div>
      </div>
      <div class="card pad sample">
        <p class="eyebrow">${esc(e.sampleLabel)} · users</p>
        <h3>${esc(e.sampleTitle)}</h3>
        <div class="score-row"><span class="stars" role="img" aria-label="4/5">★★★★<span class="off">★</span></span><b>80 %</b></div>
        <div class="bar"><i style="width:80%"></i></div>
        <p class="muted">${esc(e.sampleNote)}</p>
        <div class="chips"><span class="ev">journey p-007:e12</span><span class="ev">src/checkout/guest.ts:88</span><span class="ev">https://shop.example/cart</span></div>
      </div>
    </div>
  </section>

  <section id="mix" aria-labelledby="h-mix">
    <div class="sec-head"><div><h2 id="h-mix">${esc(m.title)}</h2><p>${esc(m.lead)}</p></div></div>
    <div class="grid-2">
      <div class="card pad">
        <p class="eyebrow">${esc(m.exampleLabel)}</p>
        ${stacked({ users: 35, developers: 15, investors: 30, security: 5, segments: 15 }, names)}
        <h3 class="sub-h">${esc(m.depthTitle)}</h3>
        <dl class="depths">${['quick', 'standard', 'deep'].map((d) => `<div${d === 'standard' ? ' class="on"' : ''}><dt><code>${d}</code> ${esc(m.depth[d][0])}</dt><dd>${esc(m.depth[d][1])}</dd></div>`).join('')}</dl>
        <a class="btn btn-primary" href="${ctx.base}${pagePath(lang, 'run')}">${esc(m.cta)} ${I.arrow}</a>
      </div>
      <div class="studio">
        <h3 class="sub-h">${esc(m.studioTitle)}</h3>
        <p class="muted">${m.studioText}</p>
        ${term('buyer-arena studio', m.studioLines)}
      </div>
    </div>
  </section>

  <section id="quickstart" aria-labelledby="h-quick">
    <div class="sec-head"><div><h2 id="h-quick">${esc(q.title)}</h2><p>${esc(q.lead)}</p></div></div>
    <ol class="card qs-list">
${steps}
    </ol>
  </section>

  <section id="phone" aria-labelledby="h-phone">
    <div class="grid-2">
      <div>
        <div class="sec-head"><div><h2 id="h-phone">${esc(c.phone.title)}</h2><p>${esc(c.phone.lead)}</p></div></div>
        <ol class="timeline">${c.phone.steps.map((s, i) => `<li><span class="node" aria-hidden="true">${i + 1}</span><span>${s}</span></li>`).join('')}</ol>
        <a class="btn btn-ghost" href="${WORKFLOW}" rel="noopener">${I.github} ${esc(c.phone.link)} ${I.ext}</a>
      </div>
      <div id="agents" class="card pad agents">
        <h2 class="h2-sm">${esc(c.agents.title)}</h2>
        <p>${esc(c.agents.lead)}</p>
        ${codeBlock('cmd-mcp', COMMANDS.mcp, q)}
        <p class="note"><span class="dot"></span>${esc(c.agents.text)}</p>
      </div>
    </div>
  </section>

  <section id="safety" aria-labelledby="h-safety">
    <div class="sec-head"><div><h2 id="h-safety">${esc(c.safety.title)}</h2><p>${esc(c.safety.lead)}</p></div></div>
    <ul class="safety">${c.safety.items.map(([t, d]) => `<li class="card"><span class="ic good-ic">${I.check}</span><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></li>`).join('')}</ul>
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
  const names = Object.fromEntries(PANELS.map((p) => [p, c.panels.items[p].name]));
  const defaults = { users: 40, developers: 15, investors: 15, security: 15, segments: 15 };
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
  <section class="page-head">
    <p class="eyebrow">${esc(r.eyebrow)}</p>
    <h1 class="h1-page">${esc(r.title)}</h1>
    <p class="sub">${esc(r.lead)}</p>
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
            <thead><tr><th scope="col"><span class="sr">Panel</span></th><th scope="col" class="num">${esc(r.share)}</th><th scope="col" class="num">${esc(r.participants)}</th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><th scope="row">${esc(r.total)}</th><td class="num">100 %</td><td class="num" id="n-total">—</td></tr></tfoot>
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
        <a class="btn btn-ghost" href="${WORKFLOW}" rel="noopener">${I.github} ${esc(r.ghLink)} ${I.ext}</a>
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
  <section class="page-head">
    <p class="eyebrow">404</p>
    <h1 class="h1-page">Page not found</h1>
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
