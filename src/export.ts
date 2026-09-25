import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { ensureDir, writeFileAtomic } from './core/fs.js';
import type { Lang } from './i18n/messages.js';
import { PANELS } from './panels/types.js';

export const EXPORT_FORMATS = ['pdf', 'png', 'jpg', 'md', 'csv', 'json'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export const EXPORT_SCOPES = ['all', ...PANELS, 'actions'] as const;
export type ExportScope = (typeof EXPORT_SCOPES)[number];

export interface ExportOptions {
  formats: ExportFormat[];
  scope?: ExportScope;
  lang?: Lang;
  out?: string;
}

/**
 * Export a launch report headlessly. It drives the report's own export code (window.BA.launch),
 * so CLI files are identical to the buttons in the page. The page is offline: every non-file
 * request is aborted.
 */
export async function exportLaunch(launchDir: string, o: ExportOptions): Promise<string[]> {
  const dir = resolve(launchDir);
  const html = join(dir, 'report.html');
  if (!existsSync(html)) throw new Error(`no report.html in ${dir} — run launch-check first`);
  const scope = o.scope ?? 'all';
  const lang = o.lang ?? 'en';
  const out = resolve(o.out ?? join(dir, 'exports'));
  ensureDir(out);
  const base = join(out, `buyer-arena-${scope}-${lang}`);
  const written: string[] = [];
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 2,
      acceptDownloads: false,
    });
    await ctx.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    const page = await ctx.newPage();
    await page.goto(`${pathToFileURL(html).href}?lang=${lang}&noguide=1`);
    await page.waitForFunction(() =>
      Boolean((window as unknown as { BA?: { launch?: unknown } }).BA?.launch),
    );
    type LaunchApi = Record<'csv' | 'md' | 'json' | 'show', (s: string) => string | undefined>;
    const api = (m: keyof LaunchApi) =>
      page.evaluate(
        ([fn, s]) =>
          (window as unknown as { BA: { launch: LaunchApi } }).BA.launch[fn as keyof LaunchApi](s) ?? '',
        [m, scope] as const,
      );
    for (const f of o.formats) {
      const file = `${base}.${f}`;
      if (f === 'csv') writeFileAtomic(file, await api('csv'));
      else if (f === 'md') writeFileAtomic(file, await api('md'));
      else if (f === 'json') writeFileAtomic(file, await api('json'));
      else {
        await api('show');
        await page.emulateMedia({ media: scope === 'all' ? 'print' : 'screen' });
        await page.evaluate(() => {
          document.querySelectorAll('details.chk').forEach((d) => ((d as HTMLDetailsElement).open = true));
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(300);
        if (f === 'pdf') {
          await page.emulateMedia({ media: 'print' });
          await page.pdf({
            path: file,
            format: 'A4',
            printBackground: true,
            margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
          });
        } else
          await page.screenshot({
            path: file,
            fullPage: true,
            type: f === 'jpg' ? 'jpeg' : 'png',
            ...(f === 'jpg' ? { quality: 88 } : {}),
          });
      }
      written.push(file);
    }
  } finally {
    await browser.close();
  }
  return written;
}
