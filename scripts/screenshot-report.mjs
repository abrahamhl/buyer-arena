/* global document, innerWidth -- evaluated inside the browser page */
// Visual QA + README assets for a report.
// usage: node scripts/screenshot-report.mjs <report.html> <outDir> [--qa]
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';

const [, , file, out = 'assets/demo', flag] = process.argv;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const url = (q) => `${pathToFileURL(file).href}?noguide=1&${q}`;
const problems = [];

async function open(width, q, theme = 'light') {
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: theme,
  });
  page.on('console', (m) => m.type() === 'error' && problems.push(`console ${width} ${q}: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`pageerror ${width} ${q}: ${e.message}`));
  await page.goto(url(q));
  await page.waitForTimeout(400);
  return page;
}

// QA pass: every language × width × mode; overflow, untranslated keys, placeholders.
if (flag === '--qa') {
  const texts = {};
  for (const lang of ['es', 'en', 'nl'])
    for (const width of [375, 1440])
      for (const mode of ['simple', 'expert']) {
        const page = await open(width, `lang=${lang}&mode=${mode}`);
        const r = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth - innerWidth,
          text: document.body.innerText,
        }));
        if (r.overflow > 1) problems.push(`overflow ${r.overflow}px at ${lang}/${width}/${mode}`);
        const raw = r.text.match(
          /\b(?:fr|exp|cause|fact|interp|chal|reason|stage|ev|st|kpi|sec|ui|hero|simple|seg|arch|obj|row|cav|guide|lev|sev|conf|aud|claim|src|jr|bl|dev|drv|sub|cf|label|badge|nav)\.[a-z_.-]+\b/g,
        );
        if (raw)
          problems.push(`raw keys at ${lang}/${width}/${mode}: ${[...new Set(raw)].slice(0, 5).join(', ')}`);
        if (/\{[a-z_]+\}/.test(r.text)) problems.push(`unfilled placeholder at ${lang}/${width}/${mode}`);
        if (width === 1440 && mode === 'expert') texts[lang] = r.text;
        await page.close();
      }
  const words = (s) => new Set(s.toLowerCase().match(/[a-záéíóúñüë']{5,}/g));
  const en = words(texts.en);
  for (const lang of ['es', 'nl']) {
    const w = [...words(texts[lang])];
    const shared = w.filter((x) => en.has(x)).length;
    console.log(
      `${lang}: ${w.length} distinct words, ${shared} also in EN (${Math.round((shared / w.length) * 100)}%)`,
    );
  }
}

// README assets (English, light) + a Spanish and a dark variant.
const shots = [
  [1440, 'lang=en&mode=simple', 'report-hero.png', false],
  [1440, 'lang=es&mode=simple', 'report-hero-es.png', false],
  [1440, 'lang=en&mode=expert&theme=dark', 'report-dark.png', false],
  [390, 'lang=nl&mode=simple', 'report-mobile-nl.png', false],
];
for (const [w, q, name] of shots) {
  const page = await open(w, q);
  await page.screenshot({ path: `${out}/${name}` });
  await page.close();
}
const page = await open(1440, 'lang=en&mode=expert');
await page.addStyleTag({ content: '.nav{display:none!important}' }); // section shots without the sticky bar
for (const [sel, name] of [
  ['#journeys', 'report-journey-explorer.png'],
  ['#auditors', 'report-auditors.png'],
  ['#friction-sec', 'report-friction.png'],
]) {
  await page
    .locator(sel)
    .screenshot({ path: `${out}/${name}` })
    .catch((e) => problems.push(`${sel}: ${e.message}`));
}
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'QA: 0 problems');
