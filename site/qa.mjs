#!/usr/bin/env node
// Quality gate for site-dist/. Serves it on 127.0.0.1 under SITE_BASE and checks every page
// at 375 and 1440 px, light and dark, plus static checks on the built HTML (launch-state honesty,
// wording, self-audit labelling, internal links, reduced motion, no third-party assets).
// Exit code 1 if any problem is found.
//   SITE_BASE=/buyer-arena-site/ node scripts/build-site.mjs && node site/qa.mjs [--og]
// BUYER_ARENA_CHROMIUM_PATH points Playwright at an existing Chromium (optional).
// --og also renders site/og.png (1200×630) from the English home page; rebuild afterwards.
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(HERE, '..', 'site-dist');
const SHOTS = join(HERE, 'qa-shots');
let base = process.env.SITE_BASE ?? '/buyer-arena-site/';
if (!base.startsWith('/')) base = '/' + base;
if (!base.endsWith('/')) base += '/';
if (/^\/[A-Za-z]:\//.test(base) || base.includes('\\')) {
  console.error(
    'SITE_BASE looks like a rewritten Windows path (' + base + '). In Git Bash use MSYS_NO_PATHCONV=1.',
  );
  process.exit(1);
}

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('site-dist/ is missing: run node scripts/build-site.mjs first');
  process.exit(1);
}

/* ───────────── static checks on the generated files ───────────── */
const staticProblems = [];
const sp = (where, msg) => staticProblems.push(`${where}: ${msg}`);
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
const rel = (f) => f.slice(DIST.length + 1);
const htmlFiles = walk(DIST).filter((f) => f.endsWith('.html'));
const siteHtml = htmlFiles.filter((f) => !rel(f).startsWith('report/'));
const read = (f) => readFileSync(f, 'utf8');
const launchState = /<meta name="ba-launch-state" content="(\w+)">/.exec(read(join(DIST, 'index.html')))?.[1];
if (launchState !== 'prelaunch' && launchState !== 'public')
  sp('index.html', `unknown launch state ${launchState}`);

for (const l of ['es', 'en', 'nl']) {
  for (const page of ['index.html', 'run.html']) {
    const f = join(DIST, l, page);
    if (!existsSync(f)) {
      sp(`${l}/${page}`, 'missing');
      continue;
    }
    const h = read(f);
    for (const alt of ['es', 'en', 'nl', 'x-default'])
      if (!h.includes(`hreflang="${alt}"`)) sp(`${l}/${page}`, `missing hreflang ${alt}`);
    if (!h.includes(`<html lang="${l}">`)) sp(`${l}/${page}`, 'wrong html lang');
  }
}

const SELF_LABELS = [
  'SELF-AUDIT — NOT EXTERNAL VALIDATION',
  'AUTOAUDITORÍA — NO ES UNA VALIDACIÓN EXTERNA',
  'ZELFAUDIT — GEEN EXTERNE VALIDATIE',
];
const CLONE_WORDS =
  /clone the repository|clona el repositorio|kloon de repository|open source, available now|available now as open source/i;
for (const f of siteHtml) {
  const h = read(f);
  const where = rel(f);
  const text = h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');
  if (launchState === 'prelaunch') {
    if (/git clone/.test(h)) sp(where, 'prelaunch build shows a clone command');
    if (CLONE_WORDS.test(text)) sp(where, `prelaunch build says "${CLONE_WORDS.exec(text)[0]}"`);
    if (/href="https:\/\/github\.com\/abrahamhl\/buyer-arena[/"]/.test(h))
      sp(where, 'prelaunch build links to the (private) source repository');
    if (/Open source · Apache-2\.0|Código abierto · Apache-2\.0/.test(text))
      sp(where, 'prelaunch build claims the source is open');
  } else if (/\/index\.html$/.test(where) && !where.startsWith('404') && !/git clone/.test(h)) {
    sp(where, 'public build is missing the clone quickstart');
  }
  if (/\bInvestors?\b(?! lens)|Inversión(?![a-z])|\bInvesteerders\b|investors=/.test(text))
    sp(where, 'old "Investors" panel wording');
  // Any self-audit score (e.g. 84/100) must sit next to the self-audit label.
  if (/\b\d{2,3}\s*\/\s*100\b/.test(text) && !SELF_LABELS.some((x) => text.includes(x)))
    sp(where, 'a /100 score shown without the self-audit label');
  // Only first-party assets: scripts, styles, fonts, icons, images.
  const assetRefs = [
    ...h.matchAll(/<script[^>]*\ssrc="([^"]+)"/g),
    ...h.matchAll(/<img[^>]*\ssrc="([^"]+)"/g),
    ...h.matchAll(/<source[^>]*\ssrcset="([^"]+)"/g),
    ...[...h.matchAll(/<link[^>]*>/g)]
      .filter((m) => /rel="(stylesheet|preload|icon|modulepreload|apple-touch-icon)"/.test(m[0]))
      .map((m) => /href="([^"]+)"/.exec(m[0]) || [null, '']),
  ].map((m) => m[1]);
  for (const u of assetRefs) if (/^(https?:)?\/\//.test(u)) sp(where, `external asset ${u}`);
  // In-page anchors must exist.
  const ids = new Set([...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of h.matchAll(/href="#([^"]+)"/g)) if (!ids.has(m[1])) sp(where, `broken anchor #${m[1]}`);
}
for (const f of walk(DIST).filter((x) => x.endsWith('.css'))) {
  const css = read(f);
  if (/@import|url\(\s*['"]?(https?:)?\/\//.test(css)) sp(rel(f), 'external CSS import/url');
}
const css = read(join(DIST, 'assets/styles.css'));
const rm = css.indexOf('@media (prefers-reduced-motion: reduce)');
if (rm < 0 || !/animation:\s*none/.test(css.slice(rm)) || !/transition:\s*none/.test(css.slice(rm)))
  sp('assets/styles.css', 'reduced-motion rules missing');
if (!read(join(DIST, 'assets/app.js')).includes('prefers-reduced-motion'))
  sp('assets/app.js', 'script does not honour prefers-reduced-motion');
// The real demo report and every screenshot it references.
const demo = join(DIST, 'report/demo/report.html');
if (!existsSync(demo)) sp('report/demo/report.html', 'missing (primary proof link would 404)');
else {
  const h = read(demo);
  const shots = new Set(h.match(/runs\/[a-z]+\/p-\d+\/shots\/[^"\\]+\.(jpg|png)/g) ?? []);
  let missing = 0;
  for (const s of shots) if (!existsSync(join(DIST, 'report/demo', s))) missing++;
  if (missing) sp('report/demo/report.html', `${missing} referenced screenshots missing`);
  if (/trace\.zip/.test(h)) sp('report/demo/report.html', 'links to stripped trace.zip files');
  for (const m of h.matchAll(/<(?:script|img|link)[^>]*\s(?:src|href)="((?:https?:)?\/\/[^"]+)"/g))
    sp('report/demo/report.html', `external asset ${m[1]}`);
}
// Pricing: nothing is purchasable, prices match docs/PRICING.md, the free Apache tier is present.
const PREVIEW = [
  'Proposed pricing — nothing is on sale',
  'Precios propuestos — nada está a la venta',
  'Voorgestelde prijzen — niets is te koop',
];
const pricingDoc = readFileSync(resolve(HERE, '..', 'docs/PRICING.md'), 'utf8');
const { PLANS, SERVICES } = await import('./pricing.mjs');
for (const x of [...PLANS, ...SERVICES])
  if (!pricingDoc.includes(`€${x.price.toLocaleString('en-US')}`))
    sp('site/pricing.mjs', `${x.key} €${x.price} is not in docs/PRICING.md`);
for (const l of ['es', 'en', 'nl']) {
  const f = join(DIST, l, 'index.html');
  if (!existsSync(f)) continue;
  const h = read(f);
  const sec = /<section id="pricing"[\s\S]*?<\/section>/.exec(h)?.[0];
  if (!sec) {
    sp(`${l}/index.html`, 'pricing section missing');
    continue;
  }
  if (!PREVIEW.some((x) => sec.includes(x))) sp(`${l}/index.html`, 'pricing is not labelled as not on sale');
  if (!sec.includes('Apache-2.0')) sp(`${l}/index.html`, 'free Apache-2.0 tier missing from pricing');
  if (/mailto:|checkout|stripe|paypal|href="https?:/i.test(sec))
    sp(`${l}/index.html`, 'pricing section has a purchase, contact or external link');
  if (launchState === 'prelaunch' && /<a\b/.test(sec))
    sp(`${l}/index.html`, 'prelaunch pricing section has a call to action');
}
if (existsSync(join(DIST, 'report/index.html'))) {
  const text = read(join(DIST, 'report/index.html'));
  if (/95\s*\/\s*100/.test(text) && !/self-audit|autoauditor|zelfaudit/i.test(text))
    sp('report/index.html', 'self-audit report does not say it is a self-audit');
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

/** Map a URL path to a file in site-dist (null if missing). */
function resolveFile(pathname) {
  if (!pathname.startsWith(base)) return null;
  let rel = decodeURIComponent(pathname.slice(base.length));
  let file = normalize(join(DIST, rel));
  if (!file.startsWith(DIST)) return null;
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  return existsSync(file) ? file : null;
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const file = resolveFile(url.pathname);
  if (!file) {
    // GitHub Pages behaviour: redirect a bare base without slash, else serve 404.html.
    if (url.pathname + '/' === base) {
      res.writeHead(301, { location: base });
      return res.end();
    }
    res.writeHead(404, { 'content-type': TYPES['.html'] });
    return res.end(readFileSync(join(DIST, '404.html')));
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const ORIGIN = `http://127.0.0.1:${PORT}`;

const PAGES = [
  { path: '', lang: 'en', kind: 'index' },
  ...['es', 'en', 'nl'].flatMap((l) => [
    { path: `${l}/`, lang: l, kind: 'index' },
    { path: `${l}/run.html`, lang: l, kind: 'run' },
  ]),
  { path: '404.html', lang: 'en', kind: '404' },
  { path: 'report/demo/report.html', lang: null, kind: 'report' },
];
const WIDTHS = [375, 1440];
const SCHEMES = ['light', 'dark'];

const problems = [];
const notes = new Set();
let loads = 0;
let linksChecked = 0;
const add = (where, msg) => problems.push(`${where}: ${msg}`);

const browser = await chromium.launch(
  process.env.BUYER_ARENA_CHROMIUM_PATH ? { executablePath: process.env.BUYER_ARENA_CHROMIUM_PATH } : {},
);
try {
  for (const scheme of SCHEMES) {
    for (const width of WIDTHS) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
      for (const pg of PAGES) {
        const where = `/${pg.path || ''} @${width} ${scheme}`;
        const page = await context.newPage();
        page.on('console', (m) => {
          // Chromium's implicit /favicon.ico probe (report page has no icon link) is not a site error.
          if (m.type() === 'error' && !/favicon\.ico$/.test(m.location()?.url ?? ''))
            add(where, `console error: ${m.text()} ${m.location()?.url ?? ''}`);
        });
        page.on('pageerror', (e) => add(where, `page error: ${e.message}`));
        page.on('request', (r) => {
          const u = new URL(r.url());
          if (u.protocol === 'data:' || u.protocol === 'blob:') return;
          if (u.hostname !== '127.0.0.1') add(where, `third-party request: ${r.url()}`);
        });
        page.on('requestfailed', (r) => add(where, `failed request: ${r.url()} (${r.failure()?.errorText})`));
        page.on('response', (r) => {
          const expect404 = pg.kind === '404' && r.url() === `${ORIGIN}${base}${pg.path}`;
          if (r.status() >= 400 && !expect404) add(where, `HTTP ${r.status()}: ${r.url()}`);
        });

        await page.goto(`${ORIGIN}${base}${pg.path}`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        loads++;
        if (pg.kind === 'report') {
          // Product artifact: only network hygiene + errors (listeners above) and no overflow.
          const ov = await page.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          );
          if (ov) add(where, 'horizontal overflow');
          await page.close();
          continue;
        }

        const r = await page.evaluate(
          ({ kind, lang }) => {
            const out = { errs: [], links: [] };
            const vw = document.documentElement.clientWidth;
            if (document.documentElement.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1)
              out.errs.push(
                `horizontal overflow: scrollWidth ${document.documentElement.scrollWidth} > ${vw}`,
              );
            // Elements sticking out of the viewport that are not inside a scrolling/clipping container.
            const clipped = (el) => {
              for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
                const ox = getComputedStyle(p).overflowX;
                if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
              }
              return false;
            };
            const over = [];
            for (const el of document.body.querySelectorAll('*')) {
              const b = el.getBoundingClientRect();
              if (!b.width || getComputedStyle(el).position === 'fixed') continue;
              if ((b.right > vw + 1 || b.left < -1) && !clipped(el) && !el.closest('.skip, .sr'))
                over.push(
                  `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} right=${Math.round(b.right)}`,
                );
            }
            if (over.length) out.errs.push(`elements outside viewport: ${over.slice(0, 4).join(', ')}`);

            const title = document.querySelector('title')?.textContent.trim();
            if (!title) out.errs.push('missing <title>');
            const desc = document.querySelector('meta[name="description"]')?.content?.trim();
            if (!desc) out.errs.push('missing meta description');
            else if (desc.length > 165) out.errs.push(`meta description too long (${desc.length})`);
            if (document.documentElement.lang !== lang)
              out.errs.push(`html lang=${document.documentElement.lang}, expected ${lang}`);
            if (kind !== '404') {
              if (!document.querySelector('link[rel="canonical"]')?.href) out.errs.push('missing canonical');
              for (const h of ['es', 'en', 'nl', 'x-default'])
                if (!document.querySelector(`link[rel="alternate"][hreflang="${h}"]`))
                  out.errs.push(`missing hreflang ${h}`);
            }
            const h1 = document.querySelectorAll('h1').length;
            if (h1 !== 1) out.errs.push(`${h1} <h1> elements`);
            const noAlt = [...document.images].filter((i) => !i.hasAttribute('alt'));
            if (noAlt.length) out.errs.push(`${noAlt.length} <img> without alt`);
            for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
              try {
                JSON.parse(s.textContent);
              } catch {
                out.errs.push('invalid JSON-LD');
              }
            }
            const ids = new Set([...document.querySelectorAll('[id]')].map((e) => e.id));
            for (const a of document.querySelectorAll('a[href]')) {
              const u = new URL(a.href);
              if (u.origin === location.origin) out.links.push(u.pathname + u.hash);
              if (
                a.getAttribute('href').startsWith('#') &&
                a.getAttribute('href').length > 1 &&
                !ids.has(a.getAttribute('href').slice(1))
              )
                out.errs.push(`broken anchor ${a.getAttribute('href')}`);
            }
            // Nav must stay visible after scrolling.
            window.scrollTo(0, 2000);
            const nav = document.getElementById('nav');
            const nb = nav?.getBoundingClientRect();
            if (!nav || nb.top !== 0 || getComputedStyle(nav).visibility === 'hidden')
              out.errs.push('nav not visible after scroll');
            window.scrollTo(0, 0);
            return out;
          },
          { kind: pg.kind, lang: pg.lang },
        );
        r.errs.forEach((e) => add(where, e));

        // Internal links: the target file must exist (hash targets on other pages too).
        if (width === 1440 && scheme === 'light') {
          for (const l of new Set(r.links)) {
            linksChecked++;
            const [p, hash] = l.split('#');
            const file = resolveFile(p);
            if (!file) {
              if (p === `${base}report/`)
                notes.add(`link ${p} has no target yet (report is placed by another step)`);
              else add(where, `broken link ${l}`);
              continue;
            }
            if (hash && file.endsWith('.html') && !readFileSync(file, 'utf8').includes(`id="${hash}"`))
              add(where, `broken anchor ${l}`);
          }
        }

        // Run builder: default command must be exact; changing inputs must update it.
        if (pg.kind === 'run' && width === 1440 && scheme === 'light') {
          await page.evaluate(() => localStorage.clear());
          await page.reload({ waitUntil: 'networkidle' });
          const expected =
            'npm run ba -- launch-check --repo . --url https://your-site.example --mix users=40,developers=15,commercial=15,security=15,segments=15 --size 40 --depth standard';
          const got = await page.textContent('#cmd');
          if (got !== expected) add(where, `default command mismatch: ${got}`);
          await page.check('#execute');
          await page.fill('#w-security', '0');
          await page.dispatchEvent('#w-security', 'input');
          await page.check('input[name="depth"][value="deep"]', { force: true });
          const got2 = await page.textContent('#cmd');
          if (
            !got2.endsWith(
              '--mix users=40,developers=15,commercial=15,security=0,segments=15 --size 40 --depth deep --execute',
            )
          )
            add(where, `command did not update: ${got2}`);
          const users = await page.textContent('#n-users');
          if (users !== '38' && users !== String(Math.round(40 * 0.47 * 2)))
            add(where, `unexpected users participants: ${users}`);
          await page.click('#reset');
          await page.evaluate(() => localStorage.clear());
        }

        await page.evaluate(() => window.scrollTo(0, 0));
        if (scheme === 'light') {
          mkdirSync(SHOTS, { recursive: true });
          if (pg.path === 'es/' && width === 1440)
            await page.screenshot({ path: join(SHOTS, 'es-1440.png'), fullPage: true });
          if (pg.path === 'en/run.html' && width === 1440)
            await page.screenshot({ path: join(SHOTS, 'en-run-1440.png'), fullPage: true });
          if (pg.path === 'nl/' && width === 375)
            await page.screenshot({ path: join(SHOTS, 'nl-375.png'), fullPage: true });
        }
        if (scheme === 'dark' && pg.path === 'en/' && width === 1440)
          await page.screenshot({ path: join(SHOTS, 'en-1440-dark.png') });
        await page.close();
      }
      await context.close();
    }
  }

  // Motion: the hero scene animates (button visible) normally; with reduced motion it stays on the
  // final frame, the button stays hidden and the flow connector is static.
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion });
    const page = await ctx.newPage();
    await page.goto(`${ORIGIN}${base}en/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const st = await page.evaluate(() => ({
      btn: !document.getElementById('sceneBtn').hidden,
      live: document.getElementById('flow').classList.contains('flow-live'),
      c: document.querySelector('#scene [data-k="c"]').textContent,
      label: document.querySelector('#scene svg').getAttribute('aria-label') || '',
    }));
    const where = `/en/ reducedMotion=${reducedMotion}`;
    if (!st.label) add(where, 'hero scene has no aria-label');
    if (reducedMotion === 'reduce') {
      if (st.btn || st.live || st.c !== '75%') add(where, `scene/flow not static: ${JSON.stringify(st)}`);
    } else {
      if (!st.btn) add(where, 'scene pause button not shown while animating');
      await page.click('#sceneBtn');
      const txt = await page.textContent('#sceneBtn');
      if (!/play|replay/i.test(txt)) add(where, `pause button did not toggle: ${txt}`);
    }
    // ROI calculator: default = the worked example in docs/PRICING.md; inputs recompute it.
    const roi0 = await page.textContent('#roi-out-ratio');
    if (roi0.replace(/\s/g, '') !== '168%') add(where, `ROI default is ${roi0}, expected 168%`);
    await page.fill('#roi-uplift', '0');
    const roi1 = await page.textContent('#roi-out-net');
    if (!/212/.test(roi1)) add(where, `ROI did not recompute (net ${roi1}, expected €212)`);
    // Network-mode switcher updates the boundary diagram.
    await page.check('input[name="netmode"][value="offline"]', { force: true });
    const blocked = await page.evaluate(() =>
      document.querySelector('.bd-l-lan').classList.contains('is-blocked'),
    );
    if (!blocked) add(where, 'OFFLINE did not block the private network link');
    await ctx.close();
  }

  if (process.argv.includes('--og')) {
    // Reduced motion renders the hero's final frame (never a mid-animation state).
    const ctx = await browser.newContext({
      viewport: { width: 1200, height: 630 },
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    await page.goto(`${ORIGIN}${base}en/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(HERE, 'og.png') });
    await ctx.close();
    console.log('wrote site/og.png — rebuild to include it');
  }
} finally {
  await browser.close();
  server.close();
}

const uniq = [...new Set([...staticProblems, ...problems])];
console.log(
  `QA (${launchState}): ${PAGES.length} pages × ${WIDTHS.length} widths × ${SCHEMES.length} themes = ${loads} loads, ${linksChecked} internal links checked, ${siteHtml.length} HTML files statically checked`,
);
for (const n of notes) console.log(`note: ${n}`);
if (uniq.length) {
  console.log(`${uniq.length} problems:`);
  uniq.forEach((p) => console.log(' - ' + p));
  process.exit(1);
}
console.log('0 problems');
