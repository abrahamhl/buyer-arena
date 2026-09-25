/** Single-file studio page (Apple Terminal style, ES · EN · NL). No external requests. */
export const STUDIO_HTML = (fontB64: string): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><title>Buyer Arena · Studio</title>
<style>
@font-face{font-family:'Inter';font-weight:100 900;font-display:swap;src:url(data:font/woff2;base64,${fontB64}) format('woff2')}
:root{--bg:#f5f5f7;--surface:#fff;--line:#e8e8ed;--line-2:#d2d2d7;--text:#1d1d1f;--text-2:#6e6e73;--text-3:#86868b;--accent:#0071e3;--good:#1a7f37;--warn:#b25000;--bad:#d70015;
--sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;--mono:'SF Mono',ui-monospace,'JetBrains Mono',Menlo,Consolas,monospace;
--c-users:#0071e3;--c-developers:#5e5ce6;--c-investors:#1a7f37;--c-security:#d70015;--c-segments:#b25000}
@media (prefers-color-scheme:dark){:root{--bg:#000;--surface:#161618;--line:#2a2a2d;--line-2:#3a3a3d;--text:#f5f5f7;--text-2:#a1a1a6;--text-3:#86868b;--accent:#2997ff;--good:#30d158;--warn:#ff9f0a;--bad:#ff453a;
--c-users:#2997ff;--c-developers:#7d7aff;--c-investors:#30d158;--c-security:#ff453a;--c-segments:#ff9f0a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 var(--sans);-webkit-font-smoothing:antialiased}
.nav{position:fixed;inset:0 0 auto;height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:color-mix(in srgb,var(--bg) 80%,transparent);backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid var(--line);z-index:10}
.brand{font-weight:650;letter-spacing:-.01em}.brand span{color:var(--text-3);font-weight:500}
.seg{display:inline-flex;background:var(--line);border-radius:999px;padding:2px}.seg button{border:0;background:none;font:inherit;font-size:12.5px;font-weight:600;color:var(--text-2);padding:5px 11px;border-radius:999px;cursor:pointer;min-height:30px}
.seg button[aria-pressed=true]{background:var(--surface);color:var(--text);box-shadow:0 1px 3px rgba(0,0,0,.12)}
main{max-width:1080px;margin:0 auto;padding:84px 20px 60px}
h1{font-size:clamp(28px,4vw,44px);letter-spacing:-.03em;line-height:1.08;margin:0 0 8px}.lead{color:var(--text-2);font-size:17px;margin:0 0 28px;max-width:60ch}
.grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px}.grid>*{min-width:0}
.card{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:20px}
.card h2{font-size:17px;margin:0 0 14px;font-weight:650}
label.f{display:block;font-size:13px;font-weight:600;color:var(--text-2);margin:12px 0 6px}
input[type=text],input[type=url],input[type=number],select{width:100%;font:inherit;font-size:14px;padding:9px 12px;border-radius:10px;border:1px solid var(--line-2);background:var(--bg);color:var(--text)}
.tog{display:flex;align-items:center;gap:10px;margin-top:12px;font-size:14px}.tog input{width:18px;height:18px;accent-color:var(--accent)}
.hint{font-size:12.5px;color:var(--text-3);margin:4px 0 0}
.mix-row{display:grid;grid-template-columns:110px minmax(0,1fr) 46px 40px;gap:10px;align-items:center;margin:8px 0}
.mix-row b{font-size:14px;font-weight:600}.mix-row input{width:100%}.mix-row .v,.mix-row .n{font:12.5px var(--mono);text-align:right;color:var(--text-2)}
.stack{display:flex;height:10px;border-radius:999px;overflow:hidden;background:var(--line);margin:14px 0 6px}.stack i{display:block;height:100%}
.run{display:flex;gap:10px;align-items:center;margin-top:20px;flex-wrap:wrap}
.btn{border:0;border-radius:999px;font:inherit;font-weight:600;padding:11px 22px;cursor:pointer;min-height:44px;background:var(--accent);color:#fff}.btn[disabled]{opacity:.45;cursor:default}
.btn.ghost{background:var(--line);color:var(--text)}
.bars{display:grid;gap:10px}.pb{display:grid;grid-template-columns:110px minmax(0,1fr) 88px;gap:10px;align-items:center;font-size:13.5px}
.pb .track{height:8px;background:var(--line);border-radius:999px;overflow:hidden}.pb .fill{height:100%;width:0;border-radius:999px;transition:width .4s}
.pb .r{font:12px var(--mono);text-align:right;color:var(--text-2)}.pb.total{font-weight:650;border-top:1px solid var(--line);padding-top:10px;margin-top:4px}
.term{background:#1d1d1f;color:#e8e8ed;border-radius:14px;overflow:hidden;margin-top:20px}.term-bar{display:flex;gap:6px;align-items:center;padding:10px 14px;background:#2a2a2d}
.term-bar i{width:11px;height:11px;border-radius:50%;background:#ff5f57}.term-bar i+i{background:#febc2e}.term-bar i+i+i{background:#28c840}.term-bar span{margin-left:8px;font-size:12px;color:#a1a1a6}
.term pre{margin:0;padding:14px 16px;font:12.5px/1.6 var(--mono);height:260px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}
.t-dim{color:#86868b}.t-ok{color:#30d158}.t-bad{color:#ff453a}.t-acc{color:#64d2ff}
.done{display:none;margin-top:20px}.done.on{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.done .big{font-size:44px;font-weight:700;letter-spacing:-.03em}
.sec{font-size:12.5px;color:var(--text-3);margin-top:28px}
@media (max-width:820px){.grid{grid-template-columns:1fr}.mix-row{grid-template-columns:92px minmax(0,1fr) 42px 34px}.pb{grid-template-columns:92px minmax(0,1fr) 70px}}
</style></head><body>
<header class="nav"><div class="brand">Buyer Arena <span>Studio</span></div><div class="seg" id="lang" role="group" aria-label="Language"></div></header>
<main>
<h1 data-t="title"></h1><p class="lead" data-t="lead"></p>
<div class="grid">
<section class="card"><h2 data-t="target"></h2>
<label class="f" for="mode" data-t="web"></label>
<select id="mode"><option value="demo" data-t="demo"></option><option value="url" data-t="url"></option><option value="none" data-t="noweb"></option></select>
<div id="urlBox" hidden><label class="f" for="url">URL</label><input id="url" type="url" placeholder="https://"></div>
<label class="f" for="repo" data-t="repo"></label><select id="repo"></select>
<label class="tog"><input type="checkbox" id="execute"><span data-t="execute"></span></label><p class="hint" data-t="execute.h"></p>
<label class="tog" id="argusRow" hidden><input type="checkbox" id="argus"><span data-t="argus"></span></label>
<label class="f" for="size" data-t="size"></label><input id="size" type="number" min="5" max="200" value="40">
<label class="f" data-t="depth"></label><div class="seg" id="depth" role="group"></div>
</section>
<section class="card"><h2 data-t="mix"></h2><p class="hint" data-t="mix.h" style="margin:-8px 0 8px"></p><div id="mixRows"></div><div class="stack" id="stack"></div><p class="hint" id="est"></p>
<div class="run"><button class="btn" id="go" data-t="run"></button><button class="btn ghost" id="stop" disabled data-t="cancel"></button></div></section>
</div>
<section class="card" style="margin-top:20px"><h2 data-t="progress"></h2><div class="bars" id="bars"></div>
<div class="done" id="done"><div class="big" id="overall"></div><div><div data-t="ready"></div><a id="open" target="_blank" rel="noopener" data-t="open"></a></div></div>
<div class="term" aria-live="polite"><div class="term-bar"><i></i><i></i><i></i><span data-t="terminal"></span></div><pre id="log"></pre></div>
</section>
<p class="sec" data-t="security"></p>
</main>
<script>
(() => {
  'use strict';
  const M = {
    en: { title: 'Launch check', lead: 'Choose what to review, how much attention each audience gets, and watch every step run.', target: 'What to review', web: 'Website', demo: 'Bundled demo store', url: 'A URL', noweb: 'No website', repo: 'Repository', none: 'None', execute: 'Install, build and run it (sandboxed copy)', 'execute.h': 'Only npm/pnpm/yarn scripts from an allow-list, in a throw-away clone.', argus: 'Passive website audit with Argus', size: 'Participants', depth: 'Depth', quick: 'Quick', standard: 'Standard', deep: 'Deep', mix: 'Attention mix', 'mix.h': 'Drag to give each audience more or less weight. Shares are normalised to 100%.', run: 'Run launch check', cancel: 'Cancel', progress: 'Progress', terminal: 'Commands and log', ready: 'Report ready', open: 'Open the report →', est: '{n} participants · about {m} min', security: 'Local only: bound to 127.0.0.1, per-session token, no cookies, no third-party requests.', users: 'End users', developers: 'Developers', investors: 'Investors', security_p: 'Red team', segments: 'Segments', queued: 'queued', skipped: 'skipped', working: 'working…', total: 'Overall' },
    es: { title: 'Revisión de lanzamiento', lead: 'Elige qué revisar, cuánta atención recibe cada público y mira cómo se ejecuta cada paso.', target: 'Qué revisar', web: 'Sitio web', demo: 'Tienda de demostración incluida', url: 'Una URL', noweb: 'Sin sitio web', repo: 'Repositorio', none: 'Ninguno', execute: 'Instalar, compilar y ejecutar (copia aislada)', 'execute.h': 'Solo scripts npm/pnpm/yarn de una lista permitida, en un clon desechable.', argus: 'Auditoría web pasiva con Argus', size: 'Participantes', depth: 'Profundidad', quick: 'Rápida', standard: 'Estándar', deep: 'Profunda', mix: 'Reparto de la atención', 'mix.h': 'Arrastra para dar más o menos peso a cada público. Los porcentajes se normalizan al 100 %.', run: 'Ejecutar la revisión', cancel: 'Cancelar', progress: 'Progreso', terminal: 'Comandos y registro', ready: 'Informe listo', open: 'Abrir el informe →', est: '{n} participantes · unos {m} min', security: 'Solo local: escucha en 127.0.0.1, token por sesión, sin cookies ni peticiones a terceros.', users: 'Usuarios finales', developers: 'Desarrolladores', investors: 'Inversores', security_p: 'Equipo rojo', segments: 'Segmentos', queued: 'en cola', skipped: 'omitido', working: 'trabajando…', total: 'Total' },
    nl: { title: 'Lanceringscheck', lead: 'Kies wat je laat beoordelen, hoeveel aandacht elke doelgroep krijgt, en volg elke stap live.', target: 'Wat beoordelen', web: 'Website', demo: 'Meegeleverde demowinkel', url: 'Een URL', noweb: 'Geen website', repo: 'Repository', none: 'Geen', execute: 'Installeren, bouwen en draaien (geïsoleerde kopie)', 'execute.h': 'Alleen npm/pnpm/yarn-scripts van een toegestane lijst, in een wegwerpkloon.', argus: 'Passieve website-audit met Argus', size: 'Deelnemers', depth: 'Diepte', quick: 'Snel', standard: 'Standaard', deep: 'Diep', mix: 'Verdeling van de aandacht', 'mix.h': 'Sleep om elke doelgroep meer of minder gewicht te geven. Aandelen worden genormaliseerd naar 100%.', run: 'Lanceringscheck starten', cancel: 'Annuleren', progress: 'Voortgang', terminal: 'Commando’s en log', ready: 'Rapport klaar', open: 'Rapport openen →', est: '{n} deelnemers · ongeveer {m} min', security: 'Alleen lokaal: luistert op 127.0.0.1, token per sessie, geen cookies, geen verzoeken naar derden.', users: 'Eindgebruikers', developers: 'Ontwikkelaars', investors: 'Investeerders', security_p: 'Red team', segments: 'Segmenten', queued: 'in wachtrij', skipped: 'overgeslagen', working: 'bezig…', total: 'Totaal' },
  };
  const token = (location.hash.match(/token=([a-f0-9]+)/) || [])[1] || '';
  history.replaceState(null, '', location.pathname);
  let lang = (navigator.language || 'en').slice(0, 2);
  if (!M[lang]) lang = 'en';
  const t = (k, p = {}) => (M[lang][k] ?? M.en[k] ?? k).replace(/\\{(\\w+)\\}/g, (_, x) => p[x] ?? '');
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const pname = (id) => t(id === 'security' ? 'security_p' : id);
  const api = (path, body) => fetch(path, { method: body ? 'POST' : 'GET', headers: { 'x-ba-token': token, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());
  let cfg = { panels: ['users', 'developers', 'investors', 'security', 'segments'], mix: {}, repos: [] };
  const mix = { users: 40, developers: 15, investors: 15, security: 15, segments: 15 };
  let depth = 'standard';
  const state = {};
  const log = [];

  function paint() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-t]').forEach((el) => (el.textContent = t(el.dataset.t)));
    $('#lang').innerHTML = ['es', 'en', 'nl'].map((l) => '<button type="button" data-l="' + l + '" aria-pressed="' + (l === lang) + '">' + l.toUpperCase() + '</button>').join('');
    $('#depth').innerHTML = ['quick', 'standard', 'deep'].map((d) => '<button type="button" data-d="' + d + '" aria-pressed="' + (d === depth) + '">' + esc(t(d)) + '</button>').join('');
    const repoSel = $('#repo');
    const cur = repoSel.value;
    repoSel.innerHTML = '<option value="">' + esc(t('none')) + '</option>' + cfg.repos.map((r) => '<option value="' + esc(r) + '">' + esc(r) + '</option>').join('');
    repoSel.value = cur || cfg.repos[0] || '';
    $('#mixRows').innerHTML = cfg.panels.map((id) => '<div class="mix-row"><b>' + esc(pname(id)) + '</b><input type="range" min="0" max="100" step="5" value="' + mix[id] + '" data-mix="' + id + '" aria-label="' + esc(pname(id)) + '"><span class="v" id="v-' + id + '"></span><span class="n" id="n-' + id + '"></span></div>').join('');
    plan();
    bars();
  }
  function shares() {
    const tot = cfg.panels.reduce((s, id) => s + mix[id], 0) || 1;
    return Object.fromEntries(cfg.panels.map((id) => [id, Math.round((mix[id] / tot) * 100)]));
  }
  async function plan() {
    const sh = shares();
    $('#stack').innerHTML = cfg.panels.map((id) => '<i style="width:' + sh[id] + '%;background:var(--c-' + id + ')" title="' + esc(pname(id)) + ' ' + sh[id] + '%"></i>').join('');
    cfg.panels.forEach((id) => ($('#v-' + id).textContent = sh[id] + '%'));
    try {
      const q = new URLSearchParams({ mix: cfg.panels.map((id) => id + '=' + mix[id]).join(','), size: $('#size').value, depth });
      const p = await api('/api/plan?' + q);
      if (!p.allocations) return;
      p.allocations.forEach((a) => {
        const el = $('#n-' + a.panel);
        if (el) el.textContent = a.participants;
      });
      $('#est').textContent = t('est', { n: p.allocations.reduce((s, a) => s + a.participants, 0), m: Math.max(1, Math.round(p.estimate_s / 60)) });
    } catch {
      /* offline */
    }
  }
  function bars() {
    let tot = 0, got = 0;
    const rows = cfg.panels.map((id) => {
      const s = state[id] || { share: shares()[id], st: 'wait', done: 0, total: 0 };
      const f = s.st === 'done' || s.st === 'skipped' ? 1 : s.total ? s.done / s.total : s.st === 'run' ? 0.05 : 0;
      tot += s.share; got += s.share * f;
      const r = s.st === 'done' ? (s.score ?? '—') + '/100' : s.st === 'skipped' ? t('skipped') : s.st === 'run' ? (s.total ? s.done + '/' + s.total : t('working')) : t('queued');
      return '<div class="pb"><span>' + esc(pname(id)) + '</span><div class="track"><div class="fill" style="width:' + Math.round(f * 100) + '%;background:var(--c-' + id + ')"></div></div><span class="r">' + esc(r) + '</span></div>';
    });
    const all = tot ? Math.round((got / tot) * 100) : 0;
    rows.push('<div class="pb total"><span>' + esc(t('total')) + '</span><div class="track"><div class="fill" style="width:' + all + '%;background:var(--text)"></div></div><span class="r">' + all + '%</span></div>');
    $('#bars').innerHTML = rows.join('');
  }
  function addLog(html) {
    log.push(html);
    if (log.length > 400) log.shift();
    const pre = $('#log');
    pre.innerHTML = log.join('\\n');
    pre.scrollTop = pre.scrollHeight;
  }
  function onEvent(e) {
    if (e.type === 'reset') {
      for (const k in state) delete state[k];
      log.length = 0; $('#log').innerHTML = ''; $('#done').classList.remove('on');
    } else if (e.type === 'plan') {
      e.panels.forEach((p) => (state[p.id] = { share: p.share, st: 'wait', done: 0, total: 0 }));
      addLog('<span class="t-dim">$</span> buyer-arena launch-check ' + e.panels.map((p) => p.id + '=' + p.share).join(','));
    } else if (e.type === 'panel') {
      const s = state[e.panel] || (state[e.panel] = { share: 0, done: 0, total: 0 });
      s.st = e.state === 'start' ? 'run' : e.state;
      s.score = e.score;
      addLog('<span class="t-acc">[' + esc(e.panel) + ']</span> ' + esc(e.state) + (e.score != null ? ' <span class="t-ok">' + e.score + '/100</span>' : '') + (e.note ? ' <span class="t-dim">(' + esc(e.note) + ')</span>' : ''));
    } else if (e.type === 'progress') {
      const s = state[e.panel];
      if (s) { s.done = e.done; s.total = e.total; }
    } else if (e.type === 'log') {
      addLog('<span class="t-acc">[' + esc(e.panel) + ']</span> ' + esc(e.line));
    } else if (e.type === 'error') {
      addLog('<span class="t-bad">✕ ' + esc(e.message) + '</span>');
      running(false);
    } else if (e.type === 'done') {
      $('#overall').textContent = (e.overall ?? '—') + '/100';
      const id = String(e.dir).split(/[\\\\/]/).pop();
      $('#open').href = '/launch/' + encodeURIComponent(id) + '/report.html?lang=' + lang;
      $('#done').classList.add('on');
      addLog('<span class="t-ok">✓ done</span>');
      running(false);
    }
    bars();
  }
  function running(on) {
    $('#go').disabled = on;
    $('#stop').disabled = !on;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.l) { lang = b.dataset.l; paint(); }
    else if (b.dataset.d) { depth = b.dataset.d; paint(); }
    else if (b.id === 'go') {
      const mode = $('#mode').value;
      running(true);
      api('/api/run', { mix, size: Number($('#size').value), depth, demo: mode === 'demo', url: mode === 'url' ? $('#url').value.trim() : '', repo: $('#repo').value, execute: $('#execute').checked, argus: $('#argus').checked })
        .then((r) => { if (r.error) { addLog('<span class="t-bad">✕ ' + esc(r.error) + '</span>'); running(false); } });
    } else if (b.id === 'stop') api('/api/cancel', {});
  });
  document.addEventListener('input', (e) => {
    const id = e.target.dataset && e.target.dataset.mix;
    if (id) { mix[id] = Number(e.target.value); plan(); bars(); }
    if (e.target.id === 'size') plan();
  });
  $('#mode').addEventListener('change', () => ($('#urlBox').hidden = $('#mode').value !== 'url'));
  api('/api/config').then((c) => {
    cfg = c;
    cfg.panels.forEach((id) => (mix[id] = c.mix[id] ?? 20));
    $('#argusRow').hidden = !c.argus;
    running(c.running);
    paint();
    const es = new EventSource('/api/events?token=' + token);
    es.onmessage = (m) => onEvent(JSON.parse(m.data));
  });
  paint();
})();
</script></body></html>`;
