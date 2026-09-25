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

  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── hero scene (moment #1). The HTML already holds the final frame; animate only when motion
     is allowed, start when visible, pause offscreen, and offer a pause/replay button. ── */
  (function scene() {
    var fig = document.getElementById('scene');
    if (!fig || reduced || !window.requestAnimationFrame) return;
    var svgEl = fig.querySelector('svg');
    var btn = document.getElementById('sceneBtn');
    var NS = 'http://www.w3.org/2000/svg';
    var GATES = [150, 250, 350];
    var GOAL = 440;
    var CY = 144;
    var X0 = 16;
    var TRAVEL = 2000;
    var GAP = 120;
    var A = 0; // baseline run
    var B = 5000; // candidate run
    var C = 9800; // model routes → Buyer Arena
    var END = 13000;
    function half(x) {
      return 86 - (Math.max(40, Math.min(440, x)) - 40) * (50 / 400);
    }
    function laneY(o, x) {
      return CY + o * half(x) * 0.8;
    }
    function clamp01(v) {
      return v < 0 ? 0 : v > 1 ? 1 : v;
    }
    function ease(v) {
      return v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2;
    }
    var dots = [].slice.call(svgEl.querySelectorAll('circle.hs-dot[data-o]')).map(function (el) {
      return { el: el, o: +el.dataset.o, b: +el.dataset.b, c: +el.dataset.c };
    });
    var q = function (sel) {
      return svgEl.querySelector(sel);
    };
    var vb = q('[data-k="b"]');
    var vc = q('[data-k="c"]');
    var delta = q('[data-k="d"]');
    var deltaText = delta.querySelector('text');
    var finalDelta = deltaText.textContent;
    var friction = q('.hs-friction');
    var chips = [].slice.call(svgEl.querySelectorAll('.hs-chip'));
    var routes = [].slice.call(svgEl.querySelectorAll('.hs-route'));
    var outs = [].slice.call(svgEl.querySelectorAll('.hs-out'));
    var wiresIn = routes.map(function (_, i) {
      return document.getElementById('hs-in-' + i);
    });
    var wiresOut = outs.map(function (_, i) {
      return document.getElementById('hs-out-' + i);
    });
    var pulses = wiresIn.concat(wiresOut).map(function () {
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('r', '3.5');
      c.setAttribute('class', 'hs-pulse');
      c.style.opacity = '0';
      svgEl.firstElementChild.appendChild(c);
      return c;
    });
    function slots(key) {
      var k = 0;
      return dots.map(function (d) {
        return d[key] === 3 ? k++ : -1;
      });
    }
    var slotB = slots('b');
    var slotC = slots('c');
    var total = dots.length;

    // Position every buyer at time t (ms) of a run; returns the number that reached the goal.
    function run(key, slot, t) {
      var passed = 0;
      dots.forEach(function (d, i) {
        var dt = t - i * GAP;
        var out = d[key];
        var x = X0 + ((GOAL - X0) * Math.max(0, dt)) / TRAVEL;
        var y;
        var cls = 'hs-dot';
        if (out < 3) {
          var stop = GATES[out] - 7;
          if (x >= stop) {
            x = stop;
            cls += ' ab';
          }
          y = laneY(d.o, x);
        } else if (x >= GOAL) {
          var k = slot[i];
          var sx = 452 + (k % 3) * 10;
          var sy = 124 + Math.floor(k / 3) * 10;
          var arr = clamp01((dt - TRAVEL) / 260);
          x = GOAL + (sx - GOAL) * ease(arr);
          y = laneY(d.o, GOAL) + (sy - laneY(d.o, GOAL)) * ease(arr);
          cls += ' ok';
          passed++;
        } else {
          y = laneY(d.o, x);
        }
        d.el.setAttribute('cx', x.toFixed(1));
        d.el.setAttribute('cy', y.toFixed(1));
        d.el.setAttribute('class', cls);
        d.el.style.opacity = dt < 0 ? '0.35' : '1';
      });
      return passed;
    }
    function pct(n) {
      return Math.round((n / total) * 100) + '%';
    }
    function along(path, dot, v) {
      if (v <= 0 || v >= 1) {
        dot.style.opacity = '0';
        return;
      }
      var p = path.getPointAtLength(path.getTotalLength() * v);
      dot.setAttribute('cx', p.x.toFixed(1));
      dot.setAttribute('cy', p.y.toFixed(1));
      dot.style.opacity = '1';
    }
    var baseFinal = dots.filter(function (d) {
      return d.b === 3;
    }).length;

    function draw(t) {
      if (t < B) {
        var n = run('b', slotB, t - A);
        vb.textContent = pct(n);
        vc.textContent = '—';
        var fade = clamp01((t - (B - 500)) / 500);
        dots.forEach(function (d) {
          if (fade) d.el.style.opacity = String(1 - fade);
        });
      } else {
        vb.textContent = pct(baseFinal);
        var m = run('c', slotC, t - B);
        vc.textContent = pct(m);
      }
      friction.style.opacity = t > A + 1 * GAP + 900 ? '1' : '0';
      chips.forEach(function (c, i) {
        c.style.opacity = String(clamp01((t - (1500 + i * 600)) / 300));
      });
      var dOn = clamp01((t - (C - 200)) / 300);
      delta.style.opacity = String(dOn);
      deltaText.textContent = finalDelta;
      // Beat 2: model routes flow into Buyer Arena, which emits disagreement · evidence · confidence.
      routes.forEach(function (r, i) {
        var s = C + i * 150;
        r.setAttribute('class', 'hs-route' + (t >= s && t < s + 900 ? ' on' : ''));
        along(wiresIn[i], pulses[i], (t - s) / 900);
      });
      outs.forEach(function (o, j) {
        var s = C + 1500 + j * 250;
        along(wiresOut[j], pulses[wiresIn.length + j], (t - s) / 700);
        o.style.opacity = String(clamp01((t - (s + 600)) / 300));
      });
    }

    var t = 0;
    var last = 0;
    var raf = 0;
    var visible = false;
    var paused = false;
    var done = false;
    function label(kind) {
      btn.lastElementChild.textContent = btn.dataset[kind];
    }
    function tick(now) {
      if (last) t += Math.min(64, now - last);
      last = now;
      if (t >= END) {
        t = END;
        done = true;
        draw(END);
        stop();
        label('replay');
        return;
      }
      draw(t);
      raf = requestAnimationFrame(tick);
    }
    function start() {
      if (raf || paused || done || !visible) return;
      last = 0;
      raf = requestAnimationFrame(tick);
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }
    btn.hidden = false;
    btn.addEventListener('click', function () {
      if (done) {
        done = false;
        paused = false;
        t = 0;
        label('pause');
        start();
      } else if (paused) {
        paused = false;
        label('pause');
        start();
      } else {
        paused = true;
        stop();
        label('play');
      }
    });
    draw(0);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        function (entries) {
          visible = entries[0].isIntersecting;
          if (visible) start();
          else stop();
        },
        { threshold: 0.25 },
      ).observe(fig);
    } else {
      visible = true;
      start();
    }
  })();

  /* ── seven-step flow (moment #2): the connector fills with scroll and steps light up.
     Without JS or with reduced motion, every step is shown as complete. ── */
  (function flow() {
    var list = document.getElementById('flow');
    if (!list || reduced) return;
    var steps = [].slice.call(list.children);
    list.classList.add('flow-live');
    var pending = false;
    function update() {
      pending = false;
      var vh = window.innerHeight;
      var line = vh * 0.62;
      var r = list.getBoundingClientRect();
      var p = r.height ? (line - r.top) / r.height : 1;
      list.style.setProperty('--p', String(Math.max(0, Math.min(1, p))));
      steps.forEach(function (s) {
        s.classList.toggle('on', s.getBoundingClientRect().top < line);
      });
    }
    function onScroll() {
      if (!pending) {
        pending = true;
        requestAnimationFrame(update);
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  })();

  /* ── offline boundary (moment #3): network policy modes change what may leave the machine ── */
  (function boundary() {
    var box = document.getElementById('boundary');
    if (!box) return;
    var live = document.getElementById('bdLive');
    // [private network allowed, cloud allowed, cloud = any host]
    var RULES = {
      offline: [false, false, false],
      local: [true, false, false],
      hybrid: [true, true, false],
      online: [true, true, true],
    };
    function setLink(el, ok) {
      el.classList.toggle('is-blocked', !ok);
      el.querySelector('.st-allowed').hidden = !ok;
      el.querySelector('.st-blocked').hidden = ok;
      return (ok ? el.querySelector('.st-allowed') : el.querySelector('.st-blocked')).textContent;
    }
    function apply(mode, announce) {
      var r = RULES[mode];
      if (!r) return;
      box.dataset.mode = mode;
      var lan = setLink(box.querySelector('.bd-l-lan'), r[0]);
      var cloud = setLink(box.querySelector('.bd-l-cloud'), r[1]);
      box.querySelector('.c-sel').hidden = r[2];
      box.querySelector('.c-any').hidden = !r[2];
      [].forEach.call(box.querySelectorAll('.mode-desc li'), function (li) {
        li.classList.toggle('on', li.dataset.m === mode);
      });
      if (announce && live) {
        live.textContent =
          mode.toUpperCase() +
          ': ' +
          box.querySelector('.bd-lan p').textContent +
          ' — ' +
          lan +
          '; ' +
          box.querySelector('.bd-cloud .bd-title').textContent +
          ' — ' +
          cloud;
      }
    }
    box.addEventListener('change', function (e) {
      if (e.target && e.target.name === 'netmode') apply(e.target.value, true);
    });
    var checked = box.querySelector('input[name="netmode"]:checked');
    if (checked) apply(checked.value, false);
  })();

  /* run builder — mirrors src/panels/mix.ts (normalise, allocate, estimateSeconds) */
  var form = document.getElementById('builder');
  if (!form) return;
  var t = {};
  try {
    t = JSON.parse(document.getElementById('i18n').textContent);
  } catch {
    /* storage unavailable */
  }
  var PANELS = ['users', 'developers', 'commercial', 'security', 'segments'];
  var DEF = {
    users: 40,
    developers: 15,
    commercial: 15,
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
      if (x.panel === 'commercial') s += 2;
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
