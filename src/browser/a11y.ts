import type { Page } from 'playwright';

/** Light, dependency-free accessibility signals for one page (not a full WCAG audit). */
export interface PageCheck {
  url: string;
  lang: string;
  load_ms: number | null;
  unlabeled_inputs: number;
  images_without_alt: number;
  unnamed_controls: number;
  small_targets: number;
  low_contrast: number;
  interactive: number;
  samples: { kind: string; text: string }[];
}

// Plain JS string: evaluated in the page, so no bundler helpers may leak in.
const SCRIPT = String.raw`(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const samples = [];
  const note = (kind, el) => { if (samples.filter((x) => x.kind === kind).length < 3) samples.push({ kind, text: clean(el.outerHTML).slice(0, 120) }); };
  let unlabeled = 0, noAlt = 0, unnamed = 0, small = 0, lowContrast = 0, interactive = 0;
  for (const el of document.querySelectorAll('input:not([type=hidden]),select,textarea')) {
    if (!vis(el)) continue;
    const named = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || el.closest('label') || (el.id && document.querySelector('label[for="' + el.id + '"]'));
    if (!named) { unlabeled++; note('unlabeled_input', el); }
  }
  for (const el of document.querySelectorAll('img')) {
    if (!vis(el)) continue;
    if (!el.hasAttribute('alt') && el.getAttribute('aria-hidden') !== 'true' && el.getAttribute('role') !== 'presentation') { noAlt++; note('img_no_alt', el); }
  }
  for (const el of document.querySelectorAll('a[href],button,[role=button]')) {
    if (!vis(el)) continue;
    interactive++;
    const name = clean(el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || (el.querySelector('img') && el.querySelector('img').alt));
    if (!name) { unnamed++; note('unnamed_control', el); }
    const r = el.getBoundingClientRect();
    const inline = getComputedStyle(el).display === 'inline' && el.tagName === 'A';
    if (!inline && (r.width < 24 || r.height < 24)) { small++; note('small_target', el); }
  }
  const lum = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const rgb = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
  const bgOf = (el) => { for (let n = el; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c && c.a > 0.5) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  let sampled = 0;
  for (const el of document.querySelectorAll('p,li,a,button,label,span,h1,h2,h3,td')) {
    if (sampled > 200) break;
    if (!vis(el) || !clean(el.innerText)) continue;
    if ([...el.childNodes].every((n) => n.nodeType !== 3 || !n.textContent.trim())) continue;
    sampled++;
    const s = getComputedStyle(el); const fg = rgb(s.color); if (!fg) continue; const bg = bgOf(el);
    const L1 = 0.2126 * lum(fg.r) + 0.7152 * lum(fg.g) + 0.0722 * lum(fg.b);
    const L2 = 0.2126 * lum(bg.r) + 0.7152 * lum(bg.g) + 0.0722 * lum(bg.b);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const large = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) { lowContrast++; note('low_contrast', el); }
  }
  const nav = performance.getEntriesByType('navigation')[0];
  return { url: location.href, lang: document.documentElement.getAttribute('lang') || '', load_ms: nav ? Math.round(nav.duration) : null,
    unlabeled_inputs: unlabeled, images_without_alt: noAlt, unnamed_controls: unnamed, small_targets: small, low_contrast: lowContrast, interactive, samples };
})()`;

export async function checkPage(page: Page): Promise<PageCheck | undefined> {
  try {
    return (await page.evaluate(SCRIPT)) as PageCheck;
  } catch {
    return undefined;
  }
}
