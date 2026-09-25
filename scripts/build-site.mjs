#!/usr/bin/env node
// Build the static Buyer Arena website into site-dist/.
// Node built-ins only. Base path from env SITE_BASE (default /buyer-arena-site/), origin from SITE_ORIGIN.
// SITE_LAUNCH_STATE=prelaunch|public (default prelaunch): prelaunch never shows clone commands or
// claims the repository is public; public shows the GitHub source link and the clone quickstart.
//   SITE_BASE=/buyer-arena-site/ SITE_LAUNCH_STATE=prelaunch node scripts/build-site.mjs
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const OUT = join(ROOT, 'site-dist');

let base = process.env.SITE_BASE ?? '/buyer-arena-site/';
if (!base.startsWith('/')) base = '/' + base;
if (!base.endsWith('/')) base += '/';
if (/^\/[A-Za-z]:\//.test(base) || base.includes('\\')) {
  console.error(
    'SITE_BASE looks like a rewritten Windows path (' + base + '). In Git Bash use MSYS_NO_PATHCONV=1.',
  );
  process.exit(1);
}
const state = process.env.SITE_LAUNCH_STATE ?? 'prelaunch';
if (state !== 'prelaunch' && state !== 'public') {
  console.error(`SITE_LAUNCH_STATE must be "prelaunch" or "public" (got "${state}")`);
  process.exit(1);
}
const origin = (process.env.SITE_ORIGIN ?? 'https://abrahamhl.github.io').replace(/\/+$/, '');

const { LANGS, content } = await import(pathToFileURL(join(SITE, 'content.mjs')).href);
const { indexPage, runPage, notFoundPage, pagePath } = await import(
  pathToFileURL(join(SITE, 'templates.mjs')).href
);

const hash = (buf) => createHash('md5').update(buf).digest('hex').slice(0, 10);
const write = (rel, data) => {
  const file = join(OUT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Assets (self-hosted; no third-party requests).
const css = readFileSync(join(SITE, 'styles.css'));
const js = readFileSync(join(SITE, 'app.js'));
write('assets/styles.css', css);
write('assets/app.js', js);
write('assets/favicon.svg', readFileSync(join(SITE, 'favicon.svg')));
cpSync(
  join(ROOT, 'src/reports/assets/fonts/inter-latin-wght.woff2'),
  join(OUT, 'assets/inter-latin-wght.woff2'),
);
const ofl = join(ROOT, 'src/reports/assets/fonts/OFL-Inter.txt');
if (existsSync(ofl)) cpSync(ofl, join(OUT, 'assets/inter-OFL.txt'));
const og = join(SITE, 'og.png');
const hasOg = existsSync(og);
if (hasOg) cpSync(og, join(OUT, 'assets/og.png'));

const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const reportSrc = join(SITE, 'report');
// The self-audit report (report/index.html) is optional and placed by another step.
const hasSelfAudit = existsSync(join(reportSrc, 'index.html'));
const hasDemo = existsSync(join(reportSrc, 'demo', 'report.html'));
if (!hasDemo)
  console.warn('warning: site/report/demo/report.html is missing: the "real report" links will 404');

const ctxBase = { base, origin, hasOg, state, version, hasSelfAudit, v: { css: hash(css), js: hash(js) } };
const pages = [];

// Language pages.
for (const lang of LANGS) {
  const ctx = { ...ctxBase, lang };
  write(join(lang, 'index.html'), indexPage(ctx));
  write(join(lang, 'run.html'), runPage(ctx));
  pages.push(`${lang}/index.html`, `${lang}/run.html`);
}
// Root = English content, x-default.
write('index.html', indexPage({ ...ctxBase, lang: undefined }));
write('404.html', notFoundPage(ctxBase));
pages.push('index.html', '404.html');

// Real demo report (site/report/demo/) and the optional self-audit report (site/report/index.html).
if (existsSync(reportSrc)) cpSync(reportSrc, join(OUT, 'report'), { recursive: true });

// robots.txt + sitemap.xml with hreflang alternates.
write(
  'robots.txt',
  `User-agent: *\nAllow: /\nDisallow: ${base}404.html\n\nSitemap: ${origin}${base}sitemap.xml\n`,
);
const abs = (p) => origin + base + p;
const urls = [];
for (const page of ['index', 'run']) {
  const alts =
    LANGS.map(
      (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${abs(pagePath(l, page))}"/>`,
    ).join('\n') +
    `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(page === 'run' ? pagePath('en', 'run') : '')}"/>`;
  const locs = LANGS.map((l) => pagePath(l, page));
  if (page === 'index') locs.push('');
  for (const loc of locs) urls.push(`  <url>\n    <loc>${abs(loc)}</loc>\n${alts}\n  </url>`);
}
write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`,
);
// GitHub Pages: serve files as-is (no Jekyll processing).
write('.nojekyll', '');

console.log(
  `site-dist: ${pages.length} pages (${LANGS.map((l) => content[l].lang).join(' · ')}), base ${base}, state ${state}, og image ${hasOg ? 'yes' : 'no'}, demo report ${hasDemo ? 'copied' : 'MISSING'}, self-audit ${hasSelfAudit ? 'copied' : 'not present'}`,
);
