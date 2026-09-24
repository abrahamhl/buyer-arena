/* global window, document, innerWidth -- evaluated inside the browser page */
// Render a report to PNGs for the README (and for visual QA).
// usage: node scripts/screenshot-report.mjs <report.html> <outDir> [width]
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';

const [, , file, out = 'assets/demo', width = '1440'] = process.argv;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(file).href);
await page.waitForTimeout(300);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: `${out}/report-hero.png` });
await page.screenshot({ path: `${out}/report-full.png`, fullPage: true });
for (const [id, name] of [
  ['explorer', 'journey-explorer'],
  ['auditors', 'auditors'],
]) {
  const el = page.locator(`#${id}`).first();
  const target = id === 'auditors' ? el.locator('xpath=..') : el;
  await target.screenshot({ path: `${out}/report-${name}.png` }).catch((e) => console.error(id, e.message));
}
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
console.log('horizontal overflow px:', overflow);
await browser.close();
