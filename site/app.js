// Buyer Arena website — tiny client script. No network, no cookies. localStorage only for the
// theme and the last run-builder settings (both optional, wrapped in try/catch).
(function () {
  'use strict';
  var root = document.documentElement;

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch {
      return null;
    }
    return null;
  }

  /* theme */
  var themeBtn = document.getElementById('themeBtn');
  function currentTheme() {
    if (root.dataset.theme) return root.dataset.theme;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  if (themeBtn) {
    themeBtn.setAttribute('aria-pressed', String(currentTheme() === 'dark'));
    themeBtn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      themeBtn.setAttribute('aria-pressed', String(next === 'dark'));
      store('ba-theme', next);
    });
  }

  /* nav: never hides, only the background firms up past 60 px */
  var nav = document.getElementById('nav');
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('stuck', window.scrollY > 60);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* copy buttons */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      try {
        if (document.execCommand('copy')) resolve();
        else reject(new Error('copy failed'));
      } catch (e) {
        reject(e);
      }
      document.body.removeChild(ta);
    });
  }
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest ? ev.target.closest('[data-copy-target]') : null;
    if (!btn) return;
    var el = document.getElementById(btn.getAttribute('data-copy-target'));
    if (!el) return;
    var label = btn.dataset.label || btn.textContent;
    btn.dataset.label = label;
    copyText(el.textContent).then(
      function () {
        btn.textContent = btn.getAttribute('data-copied') || 'Copied';
        btn.classList.add('done');
        setTimeout(function () {
          btn.textContent = label;
          btn.classList.remove('done');
        }, 1600);
      },
      function () {
        var range = document.createRange();
        range.selectNodeContents(el);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      },
    );
  });

  /* run builder — mirrors src/panels/mix.ts (normalise, allocate, estimateSeconds) */
  var form = document.getElementById('builder');
  if (!form) return;
  var t = {};
  try {
    t = JSON.parse(document.getElementById('i18n').textContent);
  } catch {
    /* storage unavailable */
  }
  var PANELS = ['users', 'developers', 'investors', 'security', 'segments'];
  var DEF = {
    users: 40,
    developers: 15,
    investors: 15,
    security: 15,
    segments: 15,
    size: 40,
    depth: 'standard',
    repo: '.',
    url: 'https://your-site.example',
    execute: false,
  };
  var DEPTH_FACTOR = { quick: 0.5, standard: 1, deep: 2 };
  var KEY = 'ba-run-builder';
  var $ = function (id) {
    return document.getElementById(id);
  };
  var nf = new Intl.NumberFormat(t.locale || 'en');

  function read() {
    var s = {};
    PANELS.forEach(function (p) {
      s[p] = clamp(parseInt($('w-' + p).value, 10), 0, 100);
    });
    s.size = clamp(parseInt($('size').value, 10), 1, 500);
    var d = form.querySelector('input[name="depth"]:checked');
    s.depth = d ? d.value : 'standard';
    s.repo = $('repo').value.trim() || '.';
    s.url = $('url').value.trim() || DEF.url;
    s.execute = $('execute').checked;
    return s;
  }
  function write(s) {
    PANELS.forEach(function (p) {
      $('w-' + p).value = s[p];
    });
    $('size').value = s.size;
    var d = form.querySelector('input[name="depth"][value="' + s.depth + '"]');
    if (d) d.checked = true;
    $('repo').value = s.repo;
    $('url').value = s.url;
    $('execute').checked = !!s.execute;
  }
  function clamp(n, lo, hi) {
    if (isNaN(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
  }
  function normalise(s) {
    var total = PANELS.reduce(function (a, p) {
      return a + s[p];
    }, 0);
    if (!total) return null;
    var out = {};
    PANELS.forEach(function (p) {
      out[p] = Math.round((s[p] / total) * 100);
    });
    return out;
  }
  function allocate(mix, size, depth) {
    var f = DEPTH_FACTOR[depth];
    return PANELS.map(function (panel) {
      var share = mix[panel];
      if (!share) return { panel: panel, share: share, participants: 0, level: 0 };
      var n = Math.max(panel === 'users' ? 5 : 2, Math.round(size * (share / 100) * f));
      var level = share >= 30 || depth === 'deep' ? 3 : share >= 12 || depth === 'standard' ? 2 : 1;
      return {
        panel: panel,
        share: share,
        participants: Math.min(n, panel === 'users' ? 200 : 60),
        level: level,
      };
    });
  }
  function estimateSeconds(a, execute) {
    var s = 5;
    a.forEach(function (x) {
      if (!x.participants) return;
      if (x.panel === 'users') s += x.participants * 1.2;
      if (x.panel === 'developers') s += execute ? 60 + x.level * 30 : 3;
      if (x.panel === 'investors') s += 2;
      if (x.panel === 'security') s += 5 + x.level * 10;
      if (x.panel === 'segments') s += x.participants * 3;
    });
    return Math.round(s);
  }
  // Quote a value for POSIX shells (bash/zsh) only when needed.
  function q(v) {
    return /^[A-Za-z0-9_./:@%+=,~-]+$/.test(v) ? v : "'" + v.replace(/'/g, "'\\''") + "'";
  }

  function render() {
    var s = read();
    PANELS.forEach(function (p) {
      $('o-' + p).textContent = s[p];
    });
    var mix = normalise(s);
    var err = $('err');
    var mixStr = PANELS.map(function (p) {
      return p + '=' + s[p];
    }).join(',');
    if (!mix) {
      err.textContent = t.zeroError || 'Give at least one panel some attention.';
      err.hidden = false;
      PANELS.forEach(function (p) {
        $('s-' + p).textContent = '—';
        $('n-' + p).textContent = '—';
        form.querySelector('[data-seg="' + p + '"]').style.width = '0%';
      });
      $('n-total').textContent = '—';
      $('est').textContent = '—';
      $('cmd').textContent = '';
      return;
    }
    err.hidden = true;
    var alloc = allocate(mix, s.size, s.depth);
    var total = 0;
    alloc.forEach(function (a) {
      total += a.participants;
      $('s-' + a.panel).textContent = nf.format(a.share) + ' %';
      var cell = $('n-' + a.panel);
      cell.textContent = a.participants ? nf.format(a.participants) : t.skipped || 'skipped';
      cell.classList.toggle('skip-v', !a.participants);
      form.querySelector('[data-seg="' + a.panel + '"]').style.width = a.share + '%';
    });
    $('n-total').textContent = nf.format(total);
    var sec = estimateSeconds(alloc, s.execute);
    $('est').textContent =
      sec < 60
        ? t.under1 || 'under 1 min'
        : '≈ ' + nf.format(Math.ceil(sec / 60)) + ' ' + (t.minutes || 'min');

    var cmd =
      'npm run ba -- launch-check --repo ' +
      q(s.repo) +
      ' --url ' +
      q(s.url) +
      ' --mix ' +
      mixStr +
      ' --size ' +
      s.size +
      ' --depth ' +
      s.depth +
      (s.execute ? ' --execute' : '');
    $('cmd').textContent = cmd;
    $('gh-url').textContent = s.url;
    $('gh-mix').textContent = mixStr;
    $('gh-size').textContent = String(s.size);
    $('gh-depth').textContent = s.depth;
    store(KEY, JSON.stringify(s));
  }

  var saved = null;
  try {
    saved = JSON.parse(store(KEY) || 'null');
  } catch {
    saved = null;
  }
  if (saved && typeof saved === 'object') {
    var merged = {};
    Object.keys(DEF).forEach(function (k) {
      merged[k] = saved[k] !== undefined ? saved[k] : DEF[k];
    });
    try {
      write(merged);
    } catch {
      write(DEF);
    }
  }
  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
  });
  $('reset').addEventListener('click', function () {
    write(DEF);
    render();
  });
  render();
})();
