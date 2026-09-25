/* Buyer Arena report client. Plain browser JS, no dependencies, works from file://. */
(() => {
  'use strict';
  const D = JSON.parse(document.getElementById('ba-data').textContent);
  const M = D.messages;
  const LANGS = ['es', 'en', 'nl'];
  const LOCALE = { es: 'es-ES', en: 'en-GB', nl: 'nl-NL' };
  const store = {
    get(k) {
      try {
        return localStorage.getItem('ba.' + k);
      } catch {
        return null;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('ba.' + k, v);
      } catch {
        /* private mode: fine */
      }
    },
  };
  const params = new URLSearchParams(location.search);
  const initialLang = () => {
    const forced = params.get('lang');
    if (LANGS.includes(forced)) return forced;
    const saved = store.get('lang');
    if (LANGS.includes(saved)) return saved;
    const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return LANGS.includes(nav) ? nav : 'en';
  };
  const state = {
    lang: initialLang(),
    mode: params.get('mode') || store.get('mode') || 'simple',
    theme: params.get('theme') || store.get('theme') || 'auto',
    auditVariant: null,
    frictionVariant: null,
    filter: 'all',
    run: null,
    ev: null,
  };

  /* ───────── helpers ───────── */
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const C = D.comparison;
  const V = D.summaries.map((s) => s.variant);
  const B = C ? C.baseline : V[0];
  const K = C ? C.candidate : V[0];
  const sum = (v) => D.summaries.find((s) => s.variant === v);
  const J = D.journeys;
  const HAS_USERS = D.summaries.length > 0;
  const LAUNCH = document.body.classList.contains('launch');
  const segArch = {};
  J.forEach((j) => (segArch[j.segment] = j.archetype));

  function t(key, p = {}) {
    let s = (M[state.lang] && M[state.lang][key]) ?? M.en[key] ?? key;
    return s.replace(/\{(\w+)\}/g, (_, k) => (p[k] === undefined ? '{' + k + '}' : resolveParam(k, p[k])));
  }
  function resolveParam(name, v) {
    if (typeof v === 'number') return num(v);
    if (typeof v !== 'string') return String(v);
    if (v.startsWith('@')) return t(v.slice(1));
    if (name === 'segment') return segName(v);
    if (['variant', 'other', 'candidate', 'baseline'].includes(name)) return variantName(v);
    return v;
  }
  /** Render an i18n object {k, p} from the engine; falls back to English text. */
  function tx(o, fallback = '') {
    if (!o) return fallback;
    if (o.k === '@raw') return (o.p && o.p.text) || fallback;
    return t(o.k, o.p || {});
  }
  const num = (v, d = 0) => new Intl.NumberFormat(LOCALE[state.lang], { maximumFractionDigits: d }).format(v);
  const pct = (v) =>
    v == null || Number.isNaN(v)
      ? '—'
      : new Intl.NumberFormat(LOCALE[state.lang], { style: 'percent', maximumFractionDigits: 0 }).format(v);
  const pp = (v, signed = true) => {
    if (v == null || Number.isNaN(v)) return '—';
    const n = Math.round(v * 100);
    return (signed ? (n > 0 ? '+' : n < 0 ? '−' : '±') : '') + Math.abs(n) + ' pp';
  };
  function fmt(v, unit) {
    if (v == null || Number.isNaN(v)) return '—';
    if (unit === 'pct') return pct(v);
    if (unit === 'steps') return num(v, 1);
    return num(v, 2);
  }
  function fd(v, unit) {
    if (v == null || Number.isNaN(v)) return '—';
    if (unit === 'pct') return pp(v);
    const s = v > 0 ? '+' : v < 0 ? '−' : '±';
    return s + num(Math.abs(v), unit === 'steps' ? 1 : 2);
  }
  /** Long form for sentences ("the candidate"), short form for labels ("Candidate"). Custom names pass through. */
  const variantName = (v) => (M.en['var.' + v] ? t('var.' + v) : v);
  const vs = (v) => (M.en['var.s.' + v] ? t('var.s.' + v) : v);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function segName(raw) {
    const a = segArch[raw];
    const key = a && `seg.${D.meta.template}.${a}`;
    return key && (M[state.lang][key] || M.en[key]) ? t(key) : raw;
  }
  const clusterTitle = (code, fallback) => (M.en['fr.' + code] ? t('fr.' + code) : fallback || code);

  /* ───────── avatars: deterministic, synthetic, no real faces ───────── */
  const PALETTES = [
    ['#FFD7BA', '#F4A261', '#2B2D42'],
    ['#CDE7FF', '#5B8DEF', '#1D3557'],
    ['#D8F3DC', '#52B788', '#1B4332'],
    ['#FDE2E4', '#E5989B', '#6D2E46'],
    ['#E9E3FF', '#8E7DFF', '#2E2A5A'],
    ['#FFF1C1', '#E9C46A', '#5C4B1C'],
    ['#D7F9F8', '#2EC4B6', '#0B3D3A'],
    ['#F1E4D8', '#B08968', '#3E2C23'],
  ];
  function hash(s) {
    let h = 2166136261;
    for (const ch of s) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function avatar(id, label = '') {
    const h = hash(id);
    const [bg, skin, ink] = PALETTES[h % PALETTES.length];
    const r = (n) => ((h >> n) & 15) / 15;
    const tilt = Math.round((r(3) - 0.5) * 18);
    const eyeY = 42 + Math.round(r(7) * 4);
    const mouth =
      r(11) > 0.5
        ? `M40 ${64 + r(15) * 3} Q50 ${70 + r(19) * 4} 60 ${64 + r(15) * 3}`
        : `M42 ${66 + r(19) * 2} L58 ${66 + r(19) * 2}`;
    const hair = r(23) > 0.35;
    const hairPath =
      r(27) > 0.5
        ? 'M22 44 Q24 16 50 16 Q76 16 78 44 Q70 30 50 30 Q30 30 22 44Z'
        : 'M24 40 Q30 14 56 18 Q80 22 76 46 Q64 28 44 30 Q30 32 24 40Z';
    return `<svg viewBox="0 0 100 100" role="img" aria-label="${esc(label)}"><rect width="100" height="100" fill="${bg}"/><g transform="rotate(${tilt} 50 60)"><circle cx="50" cy="56" r="30" fill="${skin}"/>${hair ? `<path d="${hairPath}" fill="${ink}" opacity=".9"/>` : ''}<circle cx="40" cy="${eyeY}" r="3.2" fill="${ink}"/><circle cx="60" cy="${eyeY}" r="3.2" fill="${ink}"/><path d="${mouth}" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/></g></svg>`;
  }

  const ICONS = {
    ux: '<path d="M4 5h16v10H4z M8 19h8 M12 15v4" />',
    business: '<path d="M4 19V9 M10 19V5 M16 19v-7 M22 19H2" />',
    engineering: '<path d="M8 8l-4 4 4 4 M16 8l4 4-4 4 M13 5l-2 14" />',
    customer: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0" />',
    redteam: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M12 8v5 M12 16h.01" />',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6 M12 17h.01"/>',
    guide: '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M15.5 8.5l-2 5-5 2 2-5z"/>',
  };
  const icon = (n, s = 18) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

  /* ───────── chrome: nav, language, mode, theme ───────── */
  function applyTheme() {
    const dark =
      state.theme === 'dark' ||
      (state.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }
  function renderNav() {
    const sections = [
      ['overview', 'nav.overview'],
      ['friction', 'nav.friction'],
      ['experiments', 'nav.experiments'],
      ['auditors', 'nav.auditors'],
      ['journeys', 'nav.journeys'],
      ['method', 'nav.method'],
    ];
    const links = sections
      .map(
        ([id, k]) =>
          `<a href="#${id}" class="${id === 'auditors' || id === 'method' ? 'expert-only' : ''}">${esc(t(k))}</a>`,
      )
      .join('');
    // Launch reports replace these section links with panel tabs (launch.js).
    if (!LAUNCH) {
      $('#links').innerHTML = links;
      $('#subnav').innerHTML = links;
    }
    $('#tagline').textContent = t('app.tagline');
    $('#lang').innerHTML = LANGS.map(
      (l) =>
        `<button type="button" data-lang="${l}" aria-pressed="${l === state.lang}" lang="${l}">${l.toUpperCase()}</button>`,
    ).join('');
    $('#lang').setAttribute('aria-label', t('ui.language'));
    $('#mode').innerHTML = ['simple', 'expert']
      .map(
        (m) =>
          `<button type="button" data-mode="${m}" aria-pressed="${m === state.mode}">${esc(t('ui.' + m))}</button>`,
      )
      .join('');
    $('#themeBtn').innerHTML = icon(
      state.theme === 'dark' ? 'moon' : state.theme === 'light' ? 'sun' : 'auto',
    );
    $('#themeBtn').setAttribute('aria-label', t('ui.theme'));
    $('#guideBtn').innerHTML = `${icon('guide', 16)}<span class="guide-label">${esc(t('ui.guide'))}</span>`;
  }

  /* ───────── hero ───────── */
  function renderHero() {
    const s = sum(K);
    let title;
    if (C) {
      const d = C.headline.delta;
      const key = Math.abs(d) < 0.005 ? 'hero.title.same' : d > 0 ? 'hero.title.compare' : 'hero.title.worse';
      title = esc(cap(t(key, { candidate: K, baseline: B, delta: '§' }))).replace(
        '§',
        `<em class="${d < 0 ? 'neg' : ''}">${pp(Math.abs(d), false)}</em>`,
      );
    } else title = esc(t('hero.title.single', { rate: pct(s.completion.rate) }));
    const personas = [...new Map(J.map((j) => [j.persona_id, j])).values()];
    const faces = personas
      .slice(0, 8)
      .map((j) => avatar(j.persona_id, j.name))
      .join('');
    $('#hero').innerHTML = `
      <div>
        <div class="eyebrow">${esc(t('hero.eyebrow', { session: D.meta.session, seed: D.meta.seed }))}</div>
        <h1>${title}</h1>
        <p class="sub">${esc(t('hero.sub', { buyers: D.meta.buyers, segments: D.meta.segments, variants: V.length }))}</p>
        <div class="pills">
          <span class="pill accent" title="${esc(t('badge.proxy.tip'))}"><span class="dot"></span>${esc(t('badge.proxy'))}</span>
          ${C ? `<span class="pill warn" title="${esc(t('label.tip'))}"><span class="dot"></span>${esc(t('label.' + C.label))}</span>` : ''}
          ${C ? `<span class="pill expert-only mono">${esc(t('hero.interval', { lo: pp(C.headline.lo), hi: pp(C.headline.hi) }))}</span>` : ''}
        </div>
        <div class="faces">${faces}<span>${esc(C ? t('hero.flips', { gained: C.discordant.gained, lost: C.discordant.lost }) : '')}</span></div>
      </div>
      <div class="term" aria-label="CLI">
        <div class="term-bar"><i></i><i></i><i></i><span>buyer-arena — zsh</span></div>
        <pre>${terminal()}</pre>
      </div>`;
  }
  function terminal() {
    const lines = [];
    lines.push(
      `<span class="t-dim">$</span> buyer-arena ${C ? 'compare' : 'run'} <span class="t-dim">--size ${D.meta.buyers} --seed ${D.meta.seed}</span>`,
    );
    const n = J.length;
    const done = J.filter((j) => j.completed).length;
    lines.push(`<span class="t-ok">✓</span> ${esc(t('term.done', { n, done }))}`);
    if (C) {
      const r = C.rows.find((x) => x.key === 'completion');
      lines.push('');
      lines.push(
        `<span class="t-dim">${esc(t('row.completion').padEnd(20).slice(0, 20))}</span> ${fmt(r.baseline, 'pct')} <span class="t-dim">→</span> ${fmt(r.candidate, 'pct')}  <span class="${r.delta >= 0 ? 't-ok' : 't-bad'}">${fd(r.delta, 'pct')}</span>`,
      );
      const a = C.rows.find((x) => x.key === 'abandonment');
      lines.push(
        `<span class="t-dim">${esc(t('row.abandonment').padEnd(20).slice(0, 20))}</span> ${fmt(a.baseline, 'pct')} <span class="t-dim">→</span> ${fmt(a.candidate, 'pct')}  <span class="${a.delta <= 0 ? 't-ok' : 't-bad'}">${fd(a.delta, 'pct')}</span>`,
      );
      lines.push(
        `<span class="t-warn">${esc(t('label.' + C.label))}</span> <span class="t-dim">· n=${C.n_pairs}</span>`,
      );
    }
    const top = D.backlog[0];
    if (top) {
      const item = findItem(top.id);
      lines.push('');
      lines.push(
        `<span class="t-acc">#1</span> ${esc(item ? tx(item.i18n.title, top.title) : clusterTitle(top.topic, top.title))}`,
      );
      lines.push(
        `<span class="t-dim">   ${esc(t('bl.iffixed', { pp: Math.round(top.ceiling_pp * 100) }))}</span>`,
      );
    }
    return lines.join('\n');
  }

  /* ───────── simple summary ───────── */
  function renderPlain() {
    const s = sum(K);
    const top = D.backlog[0];
    const item = top && findItem(top.id);
    const cl = top && D.clusters.find((c) => c.variant === D.backlog_variant && c.code === top.topic);
    const what = C
      ? t('simple.what.text', {
          buyers: D.meta.buyers,
          baseline: B,
          candidate: K,
          rate_b: pct(sum(B).completion.rate),
          rate_c: pct(s.completion.rate),
        })
      : t('simple.what.single', { buyers: D.meta.buyers, rate: pct(s.completion.rate) });
    const why =
      top && cl && cl.blocking_runs > 0
        ? t('simple.why.text', {
            title: item ? tx(item.i18n.title) : clusterTitle(top.topic),
            ended: cl.blocking_runs,
          })
        : t('simple.why.none');
    const next = top
      ? item
        ? tx(item.i18n.experiment, top.experiment)
        : top.experiment
      : t('simple.next.none');
    $('#plain').innerHTML = `
      <div class="plain">
        <div><h3><b>1</b>${esc(t('simple.what'))}</h3><p>${esc(what)}</p></div>
        <div><h3><b>2</b>${esc(t('simple.why'))}</h3><p>${esc(why)}</p></div>
        <div><h3><b>3</b>${esc(t('simple.next'))}</h3><p>${esc(next)}${top ? ` <span class="gain" style="margin:8px 0 0">${esc(t('bl.iffixed', { pp: Math.round(top.ceiling_pp * 100) }))}</span>` : ''}</p></div>
      </div>
      <div class="plain-foot">${esc(t('simple.caveat'))}</div>`;
  }

  /* ───────── KPIs ───────── */
  function renderKpis() {
    const defs = [
      ['completion', 'kpi.completion', (s) => [s.completion.rate, 'pct'], 'completion', false],
      ['abandonment', 'kpi.abandonment', (s) => [s.abandonment.rate, 'pct'], 'abandonment', false],
      ['friction', 'kpi.friction', (s) => [s.friction_events_per_buyer, 'count'], 'friction', true],
      ['errors', 'kpi.errors', (s) => [s.error_rate.rate, 'pct'], 'errors', true],
      ['steps', 'kpi.steps', (s) => [s.median_steps, 'steps'], 'steps_all', true],
    ];
    $('#kpis').innerHTML = defs
      .map(([id, label, get, rowKey, expert]) => {
        const [c, u] = get(sum(K));
        const b = C ? get(sum(B))[0] : null;
        const r = C && C.rows.find((x) => x.key === rowKey);
        const cls = r
          ? r.verdict === 'improved'
            ? 'good'
            : r.verdict === 'regressed'
              ? 'bad'
              : 'flat'
          : 'flat';
        return `<div class="card kpi ${expert ? 'expert-only' : ''}" data-kpi="${id}">
          <div class="l">${esc(t(label))}<button class="help" type="button" data-tip="kpi.help.${id}" aria-label="${esc(t('ui.help'))}">${icon('help', 15)}</button></div>
          <div class="v">${C ? `<small>${fmt(b, u)} →</small>` : ''}${fmt(c, u)}</div>
          ${r ? `<div class="d ${cls}">${fd(r.delta, r.unit)} · ${esc(t('verdict.' + r.verdict))}</div>${r.ci ? `<div class="ci expert-only">95% ${fd(r.ci[0], r.unit)} … ${fd(r.ci[1], r.unit)}</div>` : ''}` : ''}
        </div>`;
      })
      .join('');
  }

  /* ───────── funnel & segments ───────── */
  function renderFunnel() {
    const fb = C ? sum(B).funnel : null;
    const fc = sum(K).funnel;
    $('#funnel').innerHTML = `<div class="funnel">${fc
      .map(
        (f, i) => `<div class="row"><div class="lbl">${esc(t('stage.' + f.stage))}</div>
        <div class="bars">${fb ? `<div class="bar"><i class="base" style="width:${fb[i].rate * 100}%"></i></div>` : ''}<div class="bar"><i style="width:${f.rate * 100}%"></i></div></div>
        <div class="n">${fb ? pct(fb[i].rate) + ' → ' : ''}${pct(f.rate)}</div></div>`,
      )
      .join('')}</div>
      ${C ? `<div class="legend"><span><i style="background:var(--base-bar)"></i>${esc(vs(B))}</span><span><i style="background:var(--accent)"></i>${esc(vs(K))}</span></div>` : ''}
      <p class="dim" style="font-size:12.5px;margin:12px 0 0">${esc(t('sec.funnel.note'))}</p>`;
    const segs = sum(K).segments;
    $('#segments').innerHTML =
      `<table><thead><tr><th>${esc(t('col.segment'))}</th><th class="num">${esc(t('col.n'))}</th>${C ? `<th class="num">${esc(vs(B))}</th>` : ''}<th class="num">${esc(vs(K))}</th>${C ? `<th class="num">${esc(t('col.delta'))}</th>` : ''}</tr></thead><tbody>${segs
        .map((s) => {
          const sb = C && sum(B).segments.find((x) => x.archetype === s.archetype);
          const d = sb ? s.completion.rate - sb.completion.rate : 0;
          const face = J.find((j) => j.archetype === s.archetype);
          return `<tr><td><div class="who">${face ? avatar(face.persona_id, face.name) : ''}<div><b>${esc(segName(s.segment))}</b><small>${esc(t('arch.' + s.archetype))}</small></div></div></td>
          <td class="num">${s.n}</td>${C ? `<td class="num">${sb ? pct(sb.completion.rate) : '—'}</td>` : ''}<td class="num">${pct(s.completion.rate)}</td>
          ${C ? `<td class="num ${d > 0 ? 'good' : d < 0 ? 'bad' : 'flat'}">${pp(d)}</td>` : ''}</tr>`;
        })
        .join('')}</tbody></table>`;
  }

  /* ───────── friction ───────── */
  function reasonOf(j) {
    return j ? tx(j.abandon_i18n, j.abandon_reason || '') : '';
  }
  function renderFriction() {
    const v = state.frictionVariant || K;
    const cl = D.clusters.filter((c) => c.variant === v);
    const diffs = C ? C.friction : [];
    const tabs =
      V.length > 1
        ? `<div class="seg" role="group">${V.map((x) => `<button type="button" data-fv="${esc(x)}" aria-pressed="${x === v}">${esc(vs(x))}</button>`).join('')}</div>`
        : '';
    $('#frictionTabs').innerHTML = tabs;
    if (!cl.length) {
      $('#friction').innerHTML = `<div class="pad muted">${esc(t('fr.none'))}</div>`;
      return;
    }
    const rows = cl.map((c) => {
      const d = diffs.find((x) => x.code === c.code);
      const status = d && v === K && C ? d.status : null;
      const quoteRun =
        J.find((j) => c.affected_runs.includes(j.run_id) && !j.completed) ||
        J.find((j) => c.affected_runs.includes(j.run_id));
      const quote = quoteRun && reasonOf(quoteRun);
      const ev = c.evidence_ids
        .slice(0, 5)
        .map((id) => `<button class="ev" type="button" data-ev="${esc(id)}">${esc(id)}</button>`)
        .join('');
      return `<div class="fr">
        <div>
          <h3>${esc(clusterTitle(c.code))}${status ? `<span class="pill ${status === 'new' ? 'bad' : status === 'resolved' ? 'good' : 'warn'}">${esc(t('status.' + status))}</span>` : ''}<span class="pill expert-only">${esc(t('sev.' + c.severity))}</span></h3>
          <div class="chips">${Object.keys(c.segments)
            .map((s) => `<span class="chip">${esc(segName(s))} · ${c.segments[s]}</span>`)
            .join('')}</div>
          ${quote ? `<div class="quote">${avatar(quoteRun.persona_id, quoteRun.name)}<p>${esc(quote)}</p></div>` : ''}
          <div class="chips">${ev}${c.evidence_ids.length > 5 ? `<span class="chip">${esc(t('ui.more', { n: c.evidence_ids.length - 5 }))}</span>` : ''}</div>
        </div>
        <div class="meter"><b>${c.affected}</b><span class="of"> / ${c.population}</span>
          <div class="bar"><i style="width:${(c.affected / c.population) * 100}%"></i></div>
          <small>${esc(t('fr.ended', { b: c.blocking_runs }))}</small></div>
      </div>`;
    });
    const resolved =
      C && v === K && D.resolved.length
        ? `<div class="resolved"><span class="muted" style="font-size:13px">${esc(t('fr.resolved', { baseline: B }))}</span>${D.resolved.map((r) => `<span class="pill good">✓ ${esc(clusterTitle(r.code, r.title))} · ${r.baseline_affected} → 0</span>`).join('')}</div>`
        : '';
    $('#friction').innerHTML = rows.join('') + resolved;
  }

  /* ───────── experiments ───────── */
  function findItem(id) {
    for (const v of Object.keys(D.audits)) {
      const it = D.audits[v].consensus.find((c) => c.id === id);
      if (it) return it;
    }
    return null;
  }
  function renderBacklog() {
    if (!D.backlog.length) {
      $('#backlog').innerHTML = `<div class="pad muted">${esc(t('bl.none'))}</div>`;
      return;
    }
    $('#backlog').innerHTML = D.backlog
      .map((o) => {
        const it = findItem(o.id);
        const title = it ? tx(it.i18n.title, o.title) : clusterTitle(o.topic, o.title);
        const exp = it ? tx(it.i18n.experiment, o.experiment) : o.experiment;
        const f = o.factors;
        const lev =
          o.leverage === 'HIGH-LEVERAGE EXPERIMENT' ? 'good' : o.leverage === 'MEDIUM' ? 'warn' : '';
        return `<div class="exp">
          <div class="rank">${o.rank}</div>
          <div>
            <h3>${esc(title)}</h3>
            ${o.ceiling_pp > 0 ? `<div class="gain">↑ ${esc(t('bl.iffixed', { pp: Math.round(o.ceiling_pp * 100) }))}</div>` : ''}
            <p>${esc(exp)}</p>
            <div class="muted" style="font-size:13px">${esc(t('bl.meta', { affected: o.affected, effort: t('effort.' + f.effort), confidence: t('conf.' + (it ? it.confidence : 'medium')) }))}</div>
            <div class="chips expert-only" style="margin-top:10px">${o.evidence_ids
              .slice(0, 4)
              .map((id) => `<button class="ev" type="button" data-ev="${esc(id)}">${esc(id)}</button>`)
              .join('')}</div>
          </div>
          <div class="score"><span class="pill ${lev}">${esc(t('lev.' + o.leverage))}</span><b class="expert-only">${num(o.score, 1)}</b></div>
        </div>`;
      })
      .join('');
    $('#formula').innerHTML = `<summary>${esc(t('bl.formula'))}</summary><code>${esc(D.meta.formula)}</code>`;
  }

  /* ───────── auditors ───────── */
  function renderAuditors() {
    const v = state.auditVariant || K;
    const au = D.audits[v];
    $('#auditTabs').innerHTML =
      V.length > 1
        ? `<div class="seg">${V.map((x) => `<button type="button" data-av="${esc(x)}" aria-pressed="${x === v}">${esc(vs(x))}</button>`).join('')}</div>`
        : '';
    if (!au) return;
    const ids = ['ux', 'business', 'engineering', 'customer', 'redteam'];
    $('#auds').innerHTML = ids
      .map((a) => {
        const n = au.findings.filter((f) => f.auditor === a).length;
        const deg = au.degraded.find((d) => d.auditor === a);
        return `<div class="card aud ${a === 'redteam' ? 'red' : ''}"><div class="ic">${icon(a, 18)}</div><b>${esc(t('aud.' + a))}</b><small>${esc(t('aud.' + a + '.q'))}</small><div class="n">${n}<span>${esc(t('aud.findings'))}</span></div>${deg ? `<small class="bad">${esc(t('aud.degraded'))}</small>` : ''}</div>`;
      })
      .join('');
    const mode = au.auditor_mode === 'deterministic' ? 'deterministic' : au.auditor_mode;
    $('#consMeta').textContent = t('aud.meta', {
      mode,
      items: au.consensus.length,
      rejected: au.rejected.length,
    });
    $('#consensus').innerHTML = au.consensus
      .map((c) => {
        const i = c.i18n;
        const src = (c.sources || []).map((s) => `<span class="chip">${esc(t('src.' + s))}</span>`).join('');
        return `<div class="cons">
          <h3><span class="id">${esc(c.id)}</span>${esc(tx(i.title, c.title))}<span class="pill">${esc(t('sev.' + c.severity))}</span><span class="pill">${esc(t('conf.' + c.confidence))}</span></h3>
          <div class="claim"><div class="k fact">${esc(t('claim.fact'))}</div><div>${esc(tx(i.fact, c.observed_fact))}</div></div>
          <div class="claim"><div class="k ${c.claim}">${esc(t('claim.' + c.claim))}</div><div>${esc(tx(i.interp, c.interpretation))}</div></div>
          ${i.counterfactual ? `<div class="claim"><div class="k cf">${esc(t('claim.counterfactual'))}</div><div>${esc(tx(i.counterfactual))}</div></div>` : ''}
          <div class="claim"><div class="k fact">${esc(t('cons.experiment'))}</div><div>${esc(tx(i.experiment, c.proposed_experiments[0] || ''))}</div></div>
          ${i.challenges.map((ch) => `<div class="redteam"><b>${esc(t('cons.redteam'))}</b>${esc(tx(ch))}</div>`).join('')}
          <div class="cons-foot">${esc(t('cons.sources'))} ${src} ${c.evidence_ids
            .slice(0, 4)
            .map((id) => `<button class="ev" type="button" data-ev="${esc(id)}">${esc(id)}</button>`)
            .join('')}</div>
        </div>`;
      })
      .join('');
  }

  /* ───────── journeys ───────── */
  const statusClass = (j) =>
    j.completed ? 'ok' : j.status === 'step_limit' || j.status === 'timeout' ? 'lim' : 'no';
  function renderRoster() {
    const byP = new Map();
    J.forEach((j) => {
      if (!byP.has(j.persona_id)) byP.set(j.persona_id, {});
      byP.get(j.persona_id)[j.variant] = j;
    });
    const f = state.filter;
    $('#jrFilter').innerHTML = ['all', 'failed', 'completed']
      .map(
        (x) =>
          `<button type="button" data-filter="${x}" aria-pressed="${x === f}">${esc(t('jr.filter.' + x))}</button>`,
      )
      .join('');
    const rows = [...byP.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .filter(([, runs]) => {
        const k = runs[K] || runs[V[0]];
        return f === 'all' || (f === 'failed' ? !k.completed : k.completed);
      })
      .map(([id, runs]) => {
        const any = runs[K] || runs[V[0]];
        return `<div class="person"><div class="who">${avatar(id, any.name)}<div><b>${esc(any.name)}</b><small>${esc(segName(any.segment))}</small></div></div>
          <div class="runs">${V.map((v) => {
            const j = runs[v];
            if (!j) return '';
            return `<button type="button" class="run ${statusClass(j)} ${state.run === j.run_id ? 'sel' : ''}" data-run="${esc(j.run_id)}" title="${esc(vs(v) + ' · ' + t('st.' + j.status))}"><small>${esc(vs(v).slice(0, 1).toUpperCase())}</small>${j.completed ? '✓' : '✕'} ${j.steps}</button>`;
          }).join('')}</div></div>`;
      });
    $('#roster').innerHTML = rows.join('');
  }
  const EV_BAD = new Set([
    'abandon',
    'objection',
    'form_error',
    'page_error',
    'console_error',
    'http_error',
    'request_failed',
    'error',
    'provider_error',
    'timeout',
    'blocked_offsite',
  ]);
  const EV_OK = new Set(['milestone', 'goal_complete']);
  function eventText(e) {
    if (e.i18n) return tx(e.i18n, e.detail);
    if (e.type === 'milestone') return t('stage.' + e.target);
    if (e.type === 'goal_complete') return t('ev.goal_complete');
    if (e.type === 'navigate') return e.url;
    // Element descriptors look like button:"No thanks"; show just the visible label.
    if (
      e.target &&
      /^\w+:"/.test(e.target) &&
      (e.type === 'click' || e.type === 'dismiss_modal' || e.type === 'submit' || e.type === 'fill')
    )
      return [e.target.replace(/^\w+:/, ''), e.type === 'fill' ? e.detail : ''].filter(Boolean).join(' — ');
    return [e.target, e.detail].filter(Boolean).join(' — ');
  }
  function renderDetail() {
    const j = J.find((x) => x.run_id === state.run);
    if (!j) {
      $('#detail').innerHTML = `<p class="empty">${esc(t('jr.select'))}</p>`;
      return;
    }
    const steps = new Map();
    j.events.forEach((e) => {
      if (!steps.has(e.step)) steps.set(e.step, []);
      steps.get(e.step).push(e);
    });
    const story = (j.stories && (j.stories[state.lang] || j.stories.en)) || '';
    const lastStep = Math.max(...steps.keys());
    const timeline = [...steps.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([n, es]) => {
        const shot = es.find((e) => e.shot);
        const visible = es.filter(
          (e) => e.type !== 'observe' && !(e.type === 'navigate' && es.some((x) => x.type === 'decision')),
        );
        const endCls = n === lastStep ? (j.completed ? 'good' : 'bad') : '';
        return `<div class="step ${n === lastStep ? 'end ' + endCls : ''}">
          <div class="node">${n === 0 ? '•' : n}</div>
          ${shot ? `<div class="browser" data-zoom="${esc(shot.shot)}"><div class="browser-bar"><i></i><i></i><i></i><span>${esc(shot.url)}</span></div><img loading="lazy" src="${esc(shot.shot)}" alt="${esc(t('jr.step', { n }))}"></div>` : '<div></div>'}
          <div class="evs">${visible
            .map(
              (e) =>
                `<div class="e ${e.type} ${EV_BAD.has(e.type) ? 'bad' : EV_OK.has(e.type) ? 'ok' : ''} ${e.id === state.ev ? 'hl' : ''}" id="ev-${esc(e.id)}"><div class="ty">${esc(t('ev.' + e.type))}</div><div class="tx">${esc(eventText(e))}<span class="id">${esc(e.id.split(':')[1])}</span></div></div>`,
            )
            .join('')}</div>
        </div>`;
      })
      .join('');
    $('#detail').innerHTML = `
      <div class="d-head">${avatar(j.persona_id, j.name)}<div><h3>${esc(j.name)}</h3>
        <div class="d-meta"><span class="pill">${esc(vs(j.variant))}</span><span class="pill">${esc(segName(j.segment))}</span><span class="pill">${esc(t('dev.' + j.device_kind))} · ${j.viewport}</span><span class="pill">${esc(t('jr.budget', { budget: j.budget, currency: j.currency }))}</span></div></div></div>
      ${story ? `<div class="story">${esc(story)}</div>` : ''}
      <div class="outcome ${j.completed ? 'ok' : 'no'}">${j.completed ? '✓ ' + esc(t('jr.completed', { steps: j.steps })) : '✕ ' + esc(reasonOf(j) || t('st.' + j.status)) + ' · ' + esc(t('jr.failed', { steps: j.steps }))}</div>
      ${j.trace ? `<div class="trace expert-only"><a href="${esc(j.trace)}">${esc(t('ui.open_trace'))}</a> ${esc(t('ui.trace_cmd'))} <span class="mono">npx playwright show-trace ${esc(j.trace)}</span></div>` : ''}
      <div class="timeline">${timeline}</div>`;
    if (state.ev) {
      const el = document.getElementById('ev-' + state.ev);
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }
  function openRun(runId, evId) {
    state.run = runId;
    state.ev = evId || null;
    renderRoster();
    renderDetail();
    if (!evId) $('#journeys').scrollIntoView({ behavior: 'smooth' });
  }

  /* ───────── method ───────── */
  function renderMethod() {
    const items = [t('cav.proxy')];
    if (C) {
      items.push(
        t('cav.sample', { n: C.n_pairs }),
        t('cav.bootstrap'),
        t('cav.flips', { gained: C.discordant.gained, lost: C.discordant.lost, baseline: B, candidate: K }),
        t('cav.resolved'),
      );
    }
    if (J.some((j) => j.policy === 'heuristic')) items.push(t('cav.heuristic'));
    items.push(t('cav.evidence'));
    const usage = D.meta.usage || [];
    items.push(
      usage.length
        ? t('cav.cost', {
            usage: usage
              .map((u) => `${u.provider}:${u.model} · ${u.calls} · ≈$${u.estimated_cost_usd.toFixed(4)}`)
              .join('; '),
          })
        : t('cav.cost.none'),
    );
    $('#method').innerHTML = `<ul class="method">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  }

  /* ───────── section headers ───────── */
  function renderHeads() {
    const set = (id, title, lead) => {
      const el = document.querySelector(`[data-head="${id}"]`);
      if (!el) return;
      el.querySelector('h2').textContent = t(title);
      const p = el.querySelector('p');
      if (p) p.textContent = lead ? t(lead) : '';
    };
    set('plain', 'simple.title');
    set('funnel', 'sec.funnel');
    set('segments', 'sec.segments');
    set('friction', 'sec.friction', 'sec.friction.lead');
    set('experiments', 'sec.experiments', 'sec.experiments.lead');
    set('auditors', 'sec.auditors', 'sec.auditors.lead');
    set('journeys', 'sec.journeys', 'sec.journeys.lead');
    set('method', 'sec.method');
    $('#footer').textContent =
      `Buyer Arena · ${t('badge.proxy')} · ${new Date(D.meta.generated).toLocaleString(LOCALE[state.lang])}`;
  }

  /* ───────── guide (in-app tour) ───────── */
  let tourKey = 'guide';
  let TOUR = [
    ['#hero h1', 'guide.1'],
    ['#mode', 'guide.2'],
    ['#friction', 'guide.3'],
    ['#backlog', 'guide.4'],
    ['#journeys .jr', 'guide.5'],
    ['#lang', 'guide.6'],
  ];
  let tourI = -1;
  function tour(i) {
    tourI = i;
    let hole = $('#tourHole');
    let card = $('#tourCard');
    if (i < 0 || i >= TOUR.length) {
      hole?.remove();
      card?.remove();
      tourI = -1;
      store.set(tourKey, 'seen');
      return;
    }
    if (!hole) {
      hole = document.createElement('div');
      hole.id = 'tourHole';
      hole.className = 'tour-hole';
      card = document.createElement('div');
      card.id = 'tourCard';
      card.className = 'tour-card';
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-modal', 'true');
      document.body.append(hole, card);
    }
    const [sel, key] = TOUR[i];
    const target = $(sel);
    if (!target) return tour(i + 1);
    target.scrollIntoView({
      block: 'center',
      behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto',
    });
    requestAnimationFrame(() => {
      const r = target.getBoundingClientRect();
      const m = 8;
      Object.assign(hole.style, {
        left: r.left - m + 'px',
        top: r.top - m + 'px',
        width: r.width + m * 2 + 'px',
        height: Math.min(r.height, innerHeight * 0.6) + m * 2 + 'px',
      });
      card.innerHTML = `<div class="dots">${TOUR.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
        <div class="stepn">${i + 1} / ${TOUR.length}</div><h4>${esc(t(key + '.t'))}</h4><p>${esc(t(key + '.b'))}</p>
        <div class="row"><button type="button" class="skip" data-tour="skip">${esc(t('ui.skip'))}</button>
        ${i > 0 ? `<button type="button" class="btn btn-ghost" data-tour="back">${esc(t('ui.back'))}</button>` : ''}
        <button type="button" class="btn btn-primary" data-tour="next">${esc(t(i === TOUR.length - 1 ? 'ui.done' : 'ui.next'))}</button></div>`;
      const below = r.bottom + 16 + 220 < innerHeight;
      // Below the target if it fits, else above it (never under the bar), else pinned to the bottom.
      const navH = document.querySelector('.nav').offsetHeight + 12;
      const top = below
        ? Math.min(r.top + Math.min(r.height, innerHeight * 0.6) + 20, innerHeight - 240)
        : r.top - 230 >= navH
          ? r.top - 230
          : innerHeight - card.offsetHeight - 24;
      const left = Math.min(Math.max(16, r.left), innerWidth - card.offsetWidth - 16);
      Object.assign(card.style, { top: top + 'px', left: left + 'px' });
      card.querySelector('[data-tour="next"]').focus();
    });
  }

  /* ───────── render all ───────── */
  function render() {
    document.documentElement.lang = state.lang;
    document.body.classList.toggle('simple', state.mode === 'simple');
    renderNav();
    renderHeads();
    // In a launch report the end-user panel may not have run: its sections stay empty.
    if (HAS_USERS) {
      renderHero();
      renderPlain();
      renderKpis();
      renderFunnel();
      renderFriction();
      renderBacklog();
      renderAuditors();
      renderRoster();
      renderDetail();
      renderMethod();
    }
    BA.hooks.forEach((f) => f());
    if (tourI >= 0) tour(tourI);
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('button, [data-zoom], a');
    if (!el) {
      document.querySelectorAll('.tip').forEach((x) => x.remove());
      return;
    }
    const d = el.dataset;
    if (d.lang) {
      state.lang = d.lang;
      store.set('lang', d.lang);
      render();
    } else if (d.mode) {
      state.mode = d.mode;
      store.set('mode', d.mode);
      render();
    } else if (el.id === 'themeBtn') {
      state.theme = state.theme === 'auto' ? 'dark' : state.theme === 'dark' ? 'light' : 'auto';
      store.set('theme', state.theme);
      applyTheme();
      renderNav();
    } else if (el.id === 'guideBtn') tour(0);
    else if (d.tour) tour(d.tour === 'next' ? tourI + 1 : d.tour === 'back' ? tourI - 1 : -1);
    else if (d.fv) {
      state.frictionVariant = d.fv;
      renderFriction();
    } else if (d.av) {
      state.auditVariant = d.av;
      renderAuditors();
    } else if (d.filter) {
      state.filter = d.filter;
      renderRoster();
    } else if (d.run) openRun(d.run);
    else if (d.ev) openRun(d.ev.slice(0, d.ev.lastIndexOf(':')), d.ev);
    else if (d.tip) {
      e.preventDefault();
      const card = el.closest('.kpi');
      const open = card.querySelector('.tip');
      document.querySelectorAll('.tip').forEach((x) => x.remove());
      if (!open)
        card.insertAdjacentHTML('beforeend', `<div class="tip" role="tooltip">${esc(t(d.tip))}</div>`);
    } else if (d.zoom) {
      const lb = $('#lightbox');
      lb.querySelector('img').src = d.zoom;
      lb.hidden = false;
    }
  });
  $('#lightbox').addEventListener('click', () => ($('#lightbox').hidden = true));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $('#lightbox').hidden = true;
      if (tourI >= 0) tour(-1);
    }
    if (tourI >= 0 && e.key === 'ArrowRight') tour(tourI + 1);
    if (tourI >= 0 && e.key === 'ArrowLeft' && tourI > 0) tour(tourI - 1);
  });
  addEventListener('resize', () => tourI >= 0 && tour(tourI));
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

  /** Small API for the launch-readiness tabs (launch.js), which reuse these helpers. */
  const BA = (window.BA = {
    t,
    tx,
    esc,
    icon,
    avatar,
    state,
    LOCALE,
    hooks: [],
    render: () => render(),
    setTour(steps) {
      TOUR = steps;
      tourKey = 'guide-launch';
    },
  });

  applyTheme();
  const top = D.backlog[0] && D.backlog[0].evidence_ids[0];
  const first =
    (top && J.find((j) => j.run_id === top.slice(0, top.lastIndexOf(':')) && !j.completed)) ||
    J.find((j) => j.variant === K && !j.completed) ||
    J[0];
  state.run = first ? first.run_id : null;
  render();
  window.scrollTo(0, 0);
  setTimeout(() => {
    if (!store.get(tourKey) && !/[?&]noguide/.test(location.search)) tour(0);
  }, 600);
})();
