/* Buyer Arena — launch-readiness tabs. Runs after report.js and reuses its helpers (window.BA). */
(() => {
  'use strict';
  const L = JSON.parse(document.getElementById('ba-launch').textContent);
  const BA = window.BA;
  const { t, esc, icon } = BA;
  const $ = (s, el = document) => el.querySelector(s);
  const PANELS = ['users', 'developers', 'commercial', 'security', 'segments'];
  const TABS = ['overview', ...PANELS, 'actions'];
  const ui = { tab: 'overview', status: {}, q: {}, actionPanel: 'all' };
  try {
    const h = location.hash.replace('#tab-', '');
    if (TABS.includes(h)) ui.tab = h;
  } catch {
    /* ignore */
  }
  const panel = (id) => L.panels.find((p) => p && p.id === id);
  const color = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
  const scoreColor = (s) =>
    s == null ? color('--text-3') : s >= 75 ? color('--good') : s >= 45 ? color('--warn') : color('--bad');
  const stars = (v, big) =>
    `<span class="stars ${big ? 'big' : ''}" role="img" aria-label="${v} / 5"><span>★★★★★</span><span class="on" style="width:${(v / 5) * 100}%">★★★★★</span></span>`;
  const starsOf = (s) => (s == null ? 0 : Math.round((s / 20) * 2) / 2);
  const chkTitle = (c) => t('chk.' + c.id);
  const chkDetail = (c) => t('det.' + c.id, c.params || {});
  const chkFix = (c) => t('fix.' + c.id);
  const panelName = (p) => t('panel.' + p);

  /* ───────── charts (SVG with resolved colours so PNG/JPG export is faithful) ───────── */
  function radar(items) {
    const n = items.length;
    const cx = 170;
    const cy = 150;
    const R = 105;
    const pt = (i, r) => [cx + r * Math.sin((2 * Math.PI * i) / n), cy - r * Math.cos((2 * Math.PI * i) / n)];
    const rings = [0.25, 0.5, 0.75, 1]
      .map(
        (f) =>
          `<polygon points="${items.map((_, i) => pt(i, R * f).join(',')).join(' ')}" fill="none" stroke="${color('--line-2')}" stroke-width="1"/>`,
      )
      .join('');
    const axes = items
      .map(
        (_, i) =>
          `<line x1="${cx}" y1="${cy}" x2="${pt(i, R)[0]}" y2="${pt(i, R)[1]}" stroke="${color('--line')}"/>`,
      )
      .join('');
    const poly = items.map((x, i) => pt(i, (R * (x.value ?? 0)) / 100).join(',')).join(' ');
    const labels = items
      .map((x, i) => {
        const [lx, ly] = pt(i, R + 26);
        return `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="600" fill="${color('--text')}">${esc(x.label)}</text><text x="${lx}" y="${ly + 15}" text-anchor="middle" font-size="11" fill="${color('--text-2')}">${x.value == null ? '—' : Math.round(x.value)}</text>`;
      })
      .join('');
    return `<svg class="chart" viewBox="0 0 340 310" role="img" aria-label="${esc(t('lc.radar'))}">${rings}${axes}<polygon points="${poly}" fill="${color('--accent')}" fill-opacity=".18" stroke="${color('--accent')}" stroke-width="2"/>${items.map((x, i) => `<circle cx="${pt(i, (R * (x.value ?? 0)) / 100)[0]}" cy="${pt(i, (R * (x.value ?? 0)) / 100)[1]}" r="3.5" fill="${color('--accent')}"/>`).join('')}${labels}</svg>`;
  }
  function hbars(items, { unit = '%', max = 100 } = {}) {
    const h = 30;
    const W = 520;
    const lw = 190;
    return `<svg class="chart" viewBox="0 0 ${W} ${items.length * h + 6}" role="img">${items
      .map((x, i) => {
        const y = i * h + 4;
        const w = ((W - lw - 60) * Math.max(0, x.value ?? 0)) / max;
        return `<text x="0" y="${y + 15}" font-size="12.5" fill="${color('--text')}">${esc(x.label.length > 28 ? x.label.slice(0, 27) + '…' : x.label)}</text><rect x="${lw}" y="${y + 5}" width="${W - lw - 60}" height="12" rx="6" fill="${color('--line')}"/><rect x="${lw}" y="${y + 5}" width="${w}" height="12" rx="6" fill="${x.color || scoreColor(x.value)}"/><text x="${W - 4}" y="${y + 15}" text-anchor="end" font-size="12" font-weight="600" fill="${color('--text-2')}">${x.value == null ? '—' : Math.round(x.value) + unit}</text>`;
      })
      .join('')}</svg>`;
  }
  function gauge(value, label, invert) {
    const v = value == null ? 0 : value;
    const a = Math.PI * (v / 100);
    const x = 100 - 80 * Math.cos(a);
    const y = 100 - 80 * Math.sin(a);
    const c = invert ? scoreColor(value == null ? null : 100 - value) : scoreColor(value);
    return `<svg class="chart gauge" viewBox="0 0 200 128" role="img" aria-label="${esc(label)}"><path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="${color('--line')}" stroke-width="14" stroke-linecap="round"/>${value == null ? '' : `<path d="M20 100 A80 80 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${c}" stroke-width="14" stroke-linecap="round"/>`}<text x="100" y="92" text-anchor="middle" font-size="30" font-weight="700" fill="${color('--text')}">${value == null ? '—' : Math.round(value)}</text><text x="100" y="120" text-anchor="middle" font-size="11.5" fill="${color('--text-2')}">${esc(label)}</text></svg>`;
  }
  function donut(parts) {
    const total = parts.reduce((s, p) => s + p.value, 0) || 1;
    let acc = 0;
    const r = 52;
    const C = 2 * Math.PI * r;
    const segs = parts
      .map((p) => {
        const len = (p.value / total) * C;
        const s = `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${p.color}" stroke-width="20" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-acc}" transform="rotate(-90 70 70)"/>`;
        acc += len;
        return s;
      })
      .join('');
    const legend = parts
      .map(
        (p, i) =>
          `<g transform="translate(160 ${18 + i * 22})"><rect width="11" height="11" rx="3" fill="${p.color}"/><text x="18" y="10" font-size="12.5" fill="${color('--text')}">${esc(p.label)} · ${Math.round(p.value)}%</text></g>`,
      )
      .join('');
    return `<svg class="chart" viewBox="0 0 340 140" role="img">${segs}${legend}</svg>`;
  }
  function strip(reviewers, key) {
    const W = 520;
    const dots = reviewers
      .map(
        (r, i) =>
          `<circle cx="${20 + ((W - 40) * r.score) / 100}" cy="${26 + (i % 3) * 10}" r="6.5" fill="${scoreColor(r.score)}" fill-opacity=".85"><title>${esc(t(key(r)))} · ${r.score}</title></circle>`,
      )
      .join('');
    const ticks = [0, 25, 50, 75, 100]
      .map(
        (v) =>
          `<text x="${20 + ((W - 40) * v) / 100}" y="66" text-anchor="middle" font-size="10.5" fill="${color('--text-3')}">${v}</text>`,
      )
      .join('');
    return `<svg class="chart" viewBox="0 0 ${W} 72" role="img"><line x1="20" y1="36" x2="${W - 20}" y2="36" stroke="${color('--line')}"/>${dots}${ticks}</svg>`;
  }
  const PCOL = () => ({
    users: color('--accent'),
    developers: '#8e7dff',
    commercial: '#e9a23b',
    security: color('--bad'),
    segments: color('--good'),
  });
  const chartCard = (title, svg, id) =>
    `<div class="card pad chart-card" data-chart="${id}"><div class="cc-head"><h3>${esc(title)}</h3><div class="cc-x"><button type="button" class="chip-btn" data-png="${id}">PNG</button><button type="button" class="chip-btn" data-jpg="${id}">JPG</button></div></div>${svg}</div>`;

  /* ───────── tabs ───────── */
  function renderTabs() {
    const links = TABS.map((k) => {
      const p = panel(k);
      const sc =
        p && p.score != null ? `<b style="color:${scoreColor(p.score)}">${Math.round(p.score)}</b>` : '';
      return `<a href="#tab-${k}" data-tab="${k}" class="${ui.tab === k ? 'on' : ''}">${esc(t('tab.' + k))}${sc ? ' ' + sc : ''}</a>`;
    }).join('');
    $('#links').innerHTML = links;
    $('#subnav').innerHTML = links;
    document.querySelectorAll('[data-pane]').forEach((el) => (el.hidden = el.dataset.pane !== ui.tab));
    const users = $('#tab-users-wrap');
    if (users) users.hidden = ui.tab !== 'users';
  }

  /* ───────── overview ───────── */
  function renderOverview() {
    const o = L.overall;
    const ran = L.panels.filter((p) => p && p.score != null);
    const minutes = Math.max(1, Math.round(L.duration_ms / 60000));
    const participants = L.allocations.reduce((s, a) => s + a.participants, 0);
    const radarItems = PANELS.map((p) => ({ label: panelName(p), value: panel(p) ? panel(p).score : null }));
    const mixParts = L.allocations
      .filter((a) => a.share > 0)
      .map((a) => ({ label: panelName(a.panel), value: a.share, color: PCOL()[a.panel] }));
    const b = L.brief;
    const briefBlock = b
      ? `<div class="card pad"><div class="cc-head"><h3>${esc(t('lc.brief'))}</h3><span class="pill ${b.coverage >= 80 ? 'good' : b.coverage >= 50 ? 'warn' : 'bad'}">${b.coverage}%</span></div>
        <p class="muted" style="margin:0 0 10px">${esc(t('lc.brief.sub', { done: b.items.filter((i) => i.status === 'done').length, partial: b.items.filter((i) => i.status === 'partial').length, missing: b.items.filter((i) => i.status === 'missing').length }))}</p>
        <div class="brief">${b.items.map((i) => `<div class="bi ${i.status}"><span class="dot"></span>${esc(i.text[BA.state.lang] || i.text.en)}${i.evidence[0] ? `<span class="mono dim"> ${esc(i.evidence[0].ref)}</span>` : ''}</div>`).join('')}</div></div>`
      : '';
    $('#lc-overview').innerHTML = `
      <div class="lc-hero">
        <div>
          <div class="eyebrow">${esc(L.name)} · ${esc(new Date(L.generated_at).toLocaleString(BA.LOCALE[BA.state.lang]))}</div>
          <h1>${esc(t('lc.title', { name: L.name }))}</h1>
          <p class="sub">${esc(t('lc.sub', { n: participants, panels: ran.length, depth: t('lc.depth.' + L.depth), minutes }))}</p>
          <div class="pills"><span class="pill accent">${esc(L.execute ? t('lc.executed') : t('lc.static'))}</span>${L.target.url ? `<span class="pill mono">${esc(L.target.url)}</span>` : ''}${L.target.demo ? '<span class="pill">demo</span>' : ''}</div>
          <div class="x-bar">${exportBar('all')}</div>
        </div>
        <div class="card score-card"><div class="l">${esc(t('lc.overall'))}</div>${gauge(o.score, t('lc.overall'))}<div class="c">${stars(o.stars, true)} <b>${o.stars.toFixed(1)}</b>/5</div></div>
      </div>
      <div class="panel-cards">${PANELS.map((p) => {
        const r = panel(p);
        return `<button type="button" class="card pcard" data-tab="${p}"><div class="pc-top"><span class="pc-ic" style="color:${PCOL()[p]}">${icon(p === 'security' ? 'redteam' : p === 'users' ? 'customer' : p === 'developers' ? 'engineering' : p === 'commercial' ? 'business' : 'ux', 18)}</span><span class="pc-share">${r ? r.share : 0}%</span></div>
          <b>${esc(panelName(p))}</b><small>${esc(t('panelq.' + p))}</small>
          <div class="pc-score">${r && r.score != null ? `<span style="color:${scoreColor(r.score)}">${Math.round(r.score)}</span><span class="of">/100</span>` : `<span class="dim">—</span>`}</div>
          ${r && r.score != null ? stars(r.stars) : `<small class="dim">${esc(t('lc.skipped', { why: r ? r.skipped : '' }))}</small>`}</button>`;
      }).join('')}</div>
      <div class="grid-2" style="margin-top:20px">${chartCard(t('lc.radar'), radar(radarItems), 'radar')}${chartCard(t('lc.mix'), donut(mixParts), 'mix')}</div>
      <div class="grid-2" style="margin-top:20px">${briefBlock}<div class="card pad"><div class="cc-head"><h3>${esc(t('lc.top'))}</h3><button type="button" class="chip-btn" data-tab="actions">${esc(t('tab.actions'))} →</button></div>${actionList(L.actions.slice(0, 5))}</div></div>`;
  }

  /* ───────── actions ───────── */
  function actionLabel(a) {
    if (a.topic) return BA.tx({ k: 'fr.' + a.topic }) || a.topic;
    return t('chk.' + a.check);
  }
  function actionFix(a) {
    if (a.topic) return t('exp.' + a.topic);
    return t('fix.' + a.check);
  }
  function actionList(list) {
    if (!list.length) return `<p class="muted">${esc(t('lc.no_actions'))}</p>`;
    return `<ol class="alist">${list
      .map(
        (a) =>
          `<li><span class="rk">${a.rank}</span><div><b>${esc(actionLabel(a))}</b><p>${esc(actionFix(a))}</p><small class="dim">${esc(t('lc.action.meta', { panel: panelName(a.panel), score: a.score, impact: a.impact }))}${a.ceiling_pp ? ' · ' + esc(t('bl.iffixed', { pp: Math.round(a.ceiling_pp * 100) })) : ''}</small></div></li>`,
      )
      .join('')}</ol>`;
  }
  function renderActions() {
    const f = ui.actionPanel;
    const list = L.actions.filter((a) => f === 'all' || a.panel === f);
    $('#lc-actions').innerHTML =
      `<div class="sec-head"><div><h2>${esc(t('tab.actions'))}</h2><p>${esc(t('lc.actions.lead'))}</p></div><div class="x-bar">${exportBar('actions')}</div></div>
      <div class="filters"><div class="seg">${['all', ...PANELS].map((p) => `<button type="button" data-apanel="${p}" aria-pressed="${p === f}">${esc(p === 'all' ? t('lc.filter.all') : panelName(p))}</button>`).join('')}</div></div>
      <div class="card pad">${actionList(list)}</div>`;
  }

  /* ───────── a panel tab ───────── */
  function renderPanel(id) {
    const r = panel(id);
    const el = $('#lc-' + id);
    if (!el) return;
    if (!r || (r.score == null && !r.checks.length)) {
      el.innerHTML = `<div class="sec-head"><div><h2>${esc(panelName(id))}</h2><p>${esc(t('panelq.' + id))}</p></div></div><div class="card pad muted">${esc(t('lc.skipped', { why: r ? r.skipped : '' }))}</div>`;
      return;
    }
    const st = ui.status[id] || 'all';
    const q = (ui.q[id] || '').toLowerCase();
    const checks = r.checks.filter(
      (c) =>
        (st === 'all' || c.status === st) &&
        (!q ||
          (
            chkTitle(c) +
            ' ' +
            chkDetail(c) +
            ' ' +
            c.evidence.map((e) => e.ref + ' ' + (e.excerpt || '')).join(' ')
          )
            .toLowerCase()
            .includes(q)),
    );
    const revKey = (x) =>
      id === 'users'
        ? 'arch.' + x.archetype
        : id === 'segments'
          ? 'segx.' + x.archetype
          : 'aud.' + id + '.' + x.archetype;
    const extra =
      id === 'commercial'
        ? commercialBlock(r)
        : id === 'security'
          ? securityBlock(r)
          : id === 'segments'
            ? segmentsBlock(r)
            : id === 'developers'
              ? developersBlock(r)
              : '';
    el.innerHTML = `
      <div class="sec-head"><div><h2>${esc(panelName(id))}</h2><p>${esc(t('panelq.' + id))}</p></div><div class="x-bar">${exportBar(id)}</div></div>
      <div class="p-head card pad"><div class="ph-score"><span style="color:${scoreColor(r.score)}">${r.score == null ? '—' : Math.round(r.score)}</span><small>/100</small></div><div>${stars(r.stars, true)}<div class="muted" style="font-size:13px;margin-top:4px">${esc(t('lc.share', { share: r.share }))} · ${esc(t('lc.reviewers', { n: r.reviewers.length }))}</div></div>
        ${r.reviewers.length ? `<div class="ph-strip expert-only">${strip(r.reviewers, revKey)}<small class="dim">${esc(t('lc.reviewers.sub'))}</small></div>` : ''}</div>
      ${extra}
      <div class="grid-2" style="margin-top:20px">${chartCard(t('lc.checks'), hbars(r.checks.filter((c) => c.score != null).map((c) => ({ label: chkTitle(c), value: c.score }))), 'checks-' + id)}${r.reviewers.length ? chartCard(t('lc.reviewers', { n: r.reviewers.length }), hbars(aggregateReviewers(r.reviewers, revKey)), 'rev-' + id) : ''}</div>
      <div class="filters"><div class="seg">${['all', 'fail', 'warn', 'pass', 'na'].map((s) => `<button type="button" data-status="${id}:${s}" aria-pressed="${s === st}">${esc(t('lc.filter.' + s))}</button>`).join('')}</div><input type="search" class="search" data-search="${id}" value="${esc(ui.q[id] || '')}" placeholder="${esc(t('lc.search'))}" aria-label="${esc(t('lc.search'))}"></div>
      <div class="card checks">${checks.map((c) => checkRow(c)).join('') || `<p class="pad muted">—</p>`}</div>`;
  }
  function aggregateReviewers(list, key) {
    const m = new Map();
    list.forEach((r) => {
      const k = r.archetype;
      m.set(k, [...(m.get(k) || []), r.score]);
    });
    return [...m.entries()].map(([k, v]) => ({
      label: t(key({ archetype: k })),
      value: v.reduce((a, b) => a + b, 0) / v.length,
    }));
  }
  function checkRow(c) {
    return `<details class="chk ${c.status}"><summary><span class="st ${c.status}">${esc(t('st2.' + c.status))}</span><span class="ct">${esc(chkTitle(c))}</span><span class="cs">${c.score == null ? '—' : stars(starsOf(c.score))}</span><span class="cp" style="color:${scoreColor(c.score)}">${c.score == null ? '—' : c.score + '%'}</span></summary>
      <div class="cbody"><p>${esc(chkDetail(c))}</p><p class="fix"><b>${esc(t('lc.fix'))}</b> ${esc(chkFix(c))}</p>
      ${c.evidence.length ? `<div class="evl"><b>${esc(t('lc.evidence'))}</b>${c.evidence.map((e) => `<div class="evi"><span class="mono">${esc(e.ref)}</span>${e.excerpt ? `<span class="dim"> — ${esc(e.excerpt)}</span>` : ''}</div>`).join('')}</div>` : ''}</div></details>`;
  }
  function commercialBlock(r) {
    const x = r.extra || {};
    const models = (x.models || []).map((m) => ({
      label: t('model.' + m.id),
      value: m.fit,
      color: m.id === x.recommended ? color('--accent') : color('--base-bar'),
    }));
    const rec = (x.models || [])[0];
    const reasons = rec
      ? rec.reasons.map((k) => `<span class="chip">${esc(t('sig.' + k))}</span>`).join('')
      : '';
    return `<div class="card pad reco"><div><div class="l">${esc(t('com.reco.l'))}</div><h3>${esc(t('model.' + x.recommended))}</h3><p class="muted">${esc(t('model.' + x.recommended + '.d'))}</p><div class="chips">${reasons}</div><small class="dim">${esc(t('com.reco.sub', { model: t('model.' + x.runner_up) }))}</small></div>${gauge(x.virality, t('com.viral'))}</div>
      <div class="grid-2" style="margin-top:20px">${chartCard(t('com.models'), hbars(models), 'models')}${chartCard(t('com.strategic'), hbars((x.strategic || []).map((s) => ({ label: t('strat.' + s.id), value: s.fit, color: '#e9a23b' }))), 'strategic')}</div>
      <div class="card pad" style="margin-top:20px"><div class="cc-head"><h3>${esc(t('com.viral'))}</h3><span class="pill">${x.virality}/100</span></div><div class="vgrid">${(x.viral || []).map((v) => `<div class="vi ${v.pts ? 'on' : ''}"><span>${v.pts ? '✓' : '·'}</span>${esc(t('viral.' + v.id))}<b>+${v.pts}</b></div>`).join('')}</div></div>`;
  }
  function securityBlock(r) {
    const x = r.extra || {};
    const rows = (x.threats || [])
      .map(
        (th) =>
          `<tr><td><b>${esc(t('thr.' + th.id))}</b><small class="dim" style="display:block">${esc(t('thr.' + th.id + '.d'))}</small></td><td class="num"><span class="pill ${th.status === 'found' ? 'bad' : th.status === 'mitigated' ? 'warn' : th.status === 'clear' ? 'good' : ''}">${esc(t('tstat.' + th.status))}</span></td><td class="num">${th.evidence}</td></tr>`,
      )
      .join('');
    return `<div class="grid-3">${`<div class="card pad center">${gauge(x.risk, t('sec.risk'), true)}<span class="pill ${x.criticity === 'low' ? 'good' : x.criticity === 'moderate' ? 'warn' : 'bad'}">${esc(t('crit.' + x.criticity))}</span></div>`}<div class="card pad center">${gauge(x.agent_risk, t('sec.agent_risk'), true)}<small class="muted">${esc(t('sec.agent_risk.sub'))}</small></div><div class="card pad"><h3 style="margin-top:0">${esc(t('sec.why'))}</h3><p class="muted" style="margin:0">${esc(t('sec.why.b'))}</p></div></div>
      <div class="card pad" style="margin-top:20px;overflow-x:auto"><div class="cc-head"><h3>${esc(t('sec.threats'))}</h3></div><table><thead><tr><th>${esc(t('sec.vector'))}</th><th class="num">${esc(t('sec.status'))}</th><th class="num">${esc(t('lc.evidence'))}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function segmentsBlock(r) {
    const tbl = ((r.extra || {}).table || []).map((s) => ({ label: t('segx.' + s.id), value: s.score }));
    return `<div style="margin-top:4px">${chartCard(t('lc.segments.chart'), hbars(tbl), 'segments')}</div>`;
  }
  function developersBlock(r) {
    const cmds = (r.extra || {}).commands || [];
    if (!cmds.length)
      return `<div class="card pad muted" style="margin-top:4px">${esc(t('lc.static.long'))}</div>`;
    return `<div class="term" style="margin-top:4px"><div class="term-bar"><i></i><i></i><i></i><span>${esc(t('lc.commands'))}</span></div><pre>${cmds.map((c) => `<span class="t-dim">$</span> ${esc(c.cmd)}  <span class="${c.ok ? 't-ok' : 't-bad'}">${c.ok ? '✓' : '✕'} ${c.seconds}s</span>`).join('\n')}</pre></div>`;
  }

  /* ───────── exports ───────── */
  function exportBar(scope) {
    return `<div class="xbtns" role="group" aria-label="${esc(t('x.export'))}"><span class="dim">${esc(t('x.export'))}</span>${['csv', 'md', 'json', 'pdf'].map((f) => `<button type="button" class="chip-btn" data-export="${scope}:${f}">${f.toUpperCase()}</button>`).join('')}</div>`;
  }
  const download = (name, mime, text) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = name;
    document.body.append(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  };
  const scopePanels = (scope) => (scope === 'all' || scope === 'actions' ? PANELS : [scope]);
  const csvCell = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  function toCsv(scope) {
    if (scope === 'actions') {
      const head = ['rank', 'panel', 'action', 'what_to_do', 'score', 'impact'];
      return [
        head.join(','),
        ...L.actions.map((a) =>
          [a.rank, panelName(a.panel), actionLabel(a), actionFix(a), a.score, a.impact]
            .map(csvCell)
            .join(','),
        ),
      ].join('\n');
    }
    const head = ['panel', 'check', 'status', 'score_pct', 'stars', 'detail', 'what_to_do', 'evidence'];
    const rows = [];
    for (const p of scopePanels(scope)) {
      const r = panel(p);
      if (!r) continue;
      for (const c of r.checks)
        rows.push(
          [
            panelName(p),
            chkTitle(c),
            t('st2.' + c.status),
            c.score ?? '',
            starsOf(c.score),
            chkDetail(c),
            chkFix(c),
            c.evidence.map((e) => e.ref).join(' | '),
          ]
            .map(csvCell)
            .join(','),
        );
    }
    return '﻿' + [head.join(','), ...rows].join('\n');
  }
  const starTxt = (v) => '★'.repeat(Math.floor(v)) + (v % 1 ? '½' : '') + '☆'.repeat(5 - Math.ceil(v));
  function toMd(scope) {
    const out = [];
    const o = L.overall;
    out.push(`# ${t('lc.title', { name: L.name })}`, '');
    out.push(
      `**${t('lc.overall')}: ${o.score ?? '—'}/100 · ${starTxt(o.stars)} (${o.stars}/5)** — ${new Date(L.generated_at).toLocaleString(BA.LOCALE[BA.state.lang])}`,
      '',
    );
    if (scope === 'all') {
      out.push(`| ${t('lc.panel')} | % | ★ | ${t('lc.mixcol')} |`, '|---|---:|---|---:|');
      for (const p of PANELS) {
        const r = panel(p);
        out.push(
          `| ${panelName(p)} | ${r && r.score != null ? r.score : '—'} | ${r ? starTxt(r.stars) : ''} | ${r ? r.share : 0}% |`,
        );
      }
      out.push('');
    }
    for (const p of scope === 'actions' ? [] : scopePanels(scope)) {
      const r = panel(p);
      if (!r) continue;
      out.push(
        `## ${panelName(p)} — ${r.score ?? '—'}/100 ${starTxt(r.stars)}`,
        '',
        `_${t('panelq.' + p)}_`,
        '',
      );
      if (r.skipped) {
        out.push(t('lc.skipped', { why: r.skipped }), '');
        continue;
      }
      if (p === 'commercial' && r.extra)
        out.push(
          `**${t('com.reco.l')}:** ${t('model.' + r.extra.recommended)} · ${t('com.viral')}: ${r.extra.virality}/100`,
          '',
        );
      if (p === 'security' && r.extra)
        out.push(
          `**${t('sec.risk')}:** ${r.extra.risk}/100 (${t('crit.' + r.extra.criticity)}) · **${t('sec.agent_risk')}:** ${r.extra.agent_risk ?? '—'}/100`,
          '',
        );
      out.push(`| ${t('lc.checks')} | % | ★ | ${t('lc.fix')} |`, '|---|---:|---|---|');
      for (const c of r.checks)
        out.push(`| ${chkTitle(c)} | ${c.score ?? '—'} | ${starTxt(starsOf(c.score))} | ${chkFix(c)} |`);
      out.push('');
    }
    if (scope === 'all' || scope === 'actions') {
      out.push(`## ${t('tab.actions')}`, '');
      L.actions.forEach((a) =>
        out.push(
          `${a.rank}. **${actionLabel(a)}** — ${actionFix(a)} _(${panelName(a.panel)}, impact ${a.impact})_`,
        ),
      );
      out.push('');
    }
    if (scope === 'all' && L.brief) {
      out.push(`## ${t('lc.brief')} — ${L.brief.coverage}%`, '');
      L.brief.items.forEach((i) =>
        out.push(
          `- [${i.status === 'done' ? 'x' : ' '}] ${i.text[BA.state.lang] || i.text.en}${i.status === 'partial' ? ' (partial)' : ''}`,
        ),
      );
    }
    return out.join('\n');
  }
  function doExport(scope, fmt) {
    const base = `buyer-arena-${L.id}-${scope}-${BA.state.lang}`;
    if (fmt === 'csv') download(base + '.csv', 'text/csv;charset=utf-8', toCsv(scope));
    else if (fmt === 'md') download(base + '.md', 'text/markdown;charset=utf-8', toMd(scope));
    else if (fmt === 'json') {
      const data =
        scope === 'all' || scope === 'actions'
          ? L
          : { ...L, panels: L.panels.filter((p) => p && p.id === scope) };
      download(base + '.json', 'application/json', JSON.stringify(data, null, 2));
    } else if (fmt === 'pdf') {
      document.body.dataset.print = scope;
      if (scope !== 'all') ui.tab = scope === 'actions' ? 'actions' : scope;
      renderTabs();
      setTimeout(() => {
        window.print();
        delete document.body.dataset.print;
        renderTabs();
      }, 50);
    }
  }
  function exportChart(id, type) {
    const svg = document.querySelector(`[data-chart="${id}"] svg`);
    if (!svg) return;
    const vb = svg.viewBox.baseVal;
    const scale = 3;
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', vb.width * scale);
    clone.setAttribute('height', vb.height * scale);
    clone.setAttribute('font-family', 'Inter, -apple-system, Segoe UI, sans-serif');
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = vb.width * scale;
      c.height = vb.height * scale + 60;
      const g = c.getContext('2d');
      g.fillStyle = color('--surface') || '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = color('--text');
      g.font = `600 ${14 * scale * 0.7}px Inter, sans-serif`;
      g.fillText((document.querySelector(`[data-chart="${id}"] h3`) || {}).textContent || id, 12, 30);
      g.drawImage(img, 0, 50);
      const a = document.createElement('a');
      a.href = c.toDataURL(type === 'jpg' ? 'image/jpeg' : 'image/png', 0.92);
      a.download = `buyer-arena-${id}-${BA.state.lang}.${type}`;
      a.click();
    };
    img.src =
      'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  }

  /* ───────── wiring ───────── */
  function renderAll() {
    renderTabs();
    renderOverview();
    PANELS.filter((p) => p !== 'users').forEach(renderPanel);
    renderUsersHead();
    renderActions();
  }
  function renderUsersHead() {
    const r = panel('users');
    const el = $('#lc-users-head');
    if (!el) return;
    el.innerHTML =
      r && r.score != null
        ? `<div class="sec-head"><div><h2>${esc(panelName('users'))}</h2><p>${esc(t('panelq.users'))}</p></div><div class="x-bar">${exportBar('users')}</div></div><div class="p-head card pad"><div class="ph-score"><span style="color:${scoreColor(r.score)}">${Math.round(r.score)}</span><small>/100</small></div><div>${stars(r.stars, true)}<div class="muted" style="font-size:13px;margin-top:4px">${esc(t('lc.share', { share: r.share }))}</div></div></div><div class="card checks" style="margin:16px 0 40px">${r.checks.map(checkRow).join('')}</div>`
        : `<div class="sec-head"><div><h2>${esc(panelName('users'))}</h2></div></div><div class="card pad muted">${esc(t('lc.skipped', { why: r ? r.skipped : '' }))}</div>`;
  }
  BA.hooks.push(renderAll);
  BA.setTour([
    ['#lc-overview .score-card', 'lguide.1'],
    ['#lc-overview .panel-cards', 'lguide.2'],
    ['#mode', 'lguide.3'],
    ['#links a[data-tab="commercial"], #subnav a[data-tab="commercial"]', 'lguide.4'],
    ['#lc-overview .x-bar', 'lguide.5'],
    ['#lang', 'lguide.6'],
  ]);
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-tab],[data-export],[data-png],[data-jpg],[data-status],[data-apanel]');
    if (!el) return;
    const d = el.dataset;
    if (d.tab) {
      e.preventDefault();
      ui.tab = d.tab;
      try {
        history.replaceState(null, '', '#tab-' + d.tab);
      } catch {
        /* file:// may refuse */
      }
      renderTabs();
      window.scrollTo({ top: 0 });
    } else if (d.export) {
      const [scope, fmt] = d.export.split(':');
      doExport(scope, fmt);
    } else if (d.png) exportChart(d.png, 'png');
    else if (d.jpg) exportChart(d.jpg, 'jpg');
    else if (d.status) {
      const [p, s] = d.status.split(':');
      ui.status[p] = s;
      renderPanel(p);
    } else if (d.apanel) {
      ui.actionPanel = d.apanel;
      renderActions();
    }
  });
  document.addEventListener('input', (e) => {
    const p = e.target.dataset && e.target.dataset.search;
    if (!p) return;
    ui.q[p] = e.target.value;
    const pos = e.target.selectionStart;
    renderPanel(p);
    const again = document.querySelector(`[data-search="${p}"]`);
    if (again) {
      again.focus();
      again.setSelectionRange(pos, pos);
    }
  });
  /** Used by `buyer-arena export` (headless) so CLI exports are identical to the buttons. */
  BA.launch = {
    csv: toCsv,
    md: toMd,
    json: (scope) =>
      JSON.stringify(
        scope === 'all' || scope === 'actions'
          ? L
          : { ...L, panels: L.panels.filter((p) => p && p.id === scope) },
        null,
        2,
      ),
    show(scope) {
      document.body.dataset.print = scope;
      ui.tab = scope === 'all' ? 'overview' : scope;
      renderTabs();
    },
  };
  renderAll();
})();
