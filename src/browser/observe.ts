import type { Page } from 'playwright';

export type ElementKind =
  'link' | 'button' | 'submit' | 'input' | 'select' | 'checkbox' | 'radio' | 'textarea';
export type Region = 'nav' | 'header' | 'menu' | 'main' | 'footer' | 'dialog';

export interface ElementInfo {
  idx: number;
  kind: ElementKind;
  text: string;
  label?: string;
  name?: string;
  inputType?: string;
  href?: string;
  required: boolean;
  hint?: string;
  options?: string[];
  region: Region;
  /** Top of the element in document coordinates (px). */
  y: number;
  prominent: boolean;
  /** Covered by an open modal dialog. */
  blocked: boolean;
  expanded?: boolean;
  formIdx?: number;
}

export interface TextBlock {
  text: string;
  y: number;
  region: Region;
}

export interface Observation {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  scrollY: number;
  scrollHeight: number;
  headings: string[];
  blocks: TextBlock[];
  elements: ElementInfo[];
  modalOpen: boolean;
  alerts: string[];
}

/**
 * Runs inside the page. Kept as a plain JS string so bundlers cannot inject helpers
 * (e.g. esbuild's __name) that would not exist in the browser context.
 * Tags each interactive element with data-ba-idx for deterministic targeting.
 */
const OBSERVE_SCRIPT = String.raw`(() => {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };
  const dialog = Array.from(document.querySelectorAll('[role="dialog"],[aria-modal="true"],dialog[open]')).find(isVisible) || null;
  const regionOf = (el) => {
    if (dialog && dialog.contains(el)) return 'dialog';
    if (el.closest('footer')) return 'footer';
    if (el.closest('#mobile-menu,[data-menu],[role="menu"]')) return 'menu';
    if (el.closest('nav')) return 'nav';
    if (el.closest('header')) return 'header';
    return 'main';
  };
  const labelOf = (el) => {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    if (el.id) { const l = document.querySelector('label[for="' + el.id + '"]'); if (l) return l.textContent; }
    const wrap = el.closest('label');
    if (wrap) { const c = wrap.cloneNode(true); c.querySelectorAll('input,select,textarea,.hint').forEach((n) => n.remove()); return c.textContent; }
    return el.getAttribute('placeholder') || el.getAttribute('name') || '';
  };
  const hintOf = (el) => {
    const ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    const parts = ids.map((id) => document.getElementById(id)).filter(Boolean).map((n) => n.textContent);
    const wrap = el.closest('label');
    if (wrap) wrap.querySelectorAll('.hint').forEach((n) => parts.push(n.textContent));
    return clean(Array.from(new Set(parts)).join(' '));
  };
  const forms = Array.from(document.forms);
  const nodes = Array.from(document.querySelectorAll('a[href],button,input,select,textarea,[role="button"]'));
  const elements = [];
  let idx = 0;
  for (const el of nodes) {
    if (el.type === 'hidden' || !isVisible(el)) continue;
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    let kind = 'button';
    if (tag === 'a') kind = 'link';
    else if (tag === 'select') kind = 'select';
    else if (tag === 'textarea') kind = 'textarea';
    else if (tag === 'input') kind = type === 'checkbox' ? 'checkbox' : type === 'radio' ? 'radio' : type === 'submit' ? 'submit' : 'input';
    else if (tag === 'button' && (type === 'submit' || (!type && el.form))) kind = 'submit';
    el.setAttribute('data-ba-idx', String(idx));
    const r = el.getBoundingClientRect();
    const cls = (el.className && el.className.baseVal === undefined ? el.className : '') || '';
    const label = kind === 'link' || kind === 'button' || kind === 'submit' ? undefined : clean(labelOf(el));
    elements.push({
      idx,
      kind,
      text: tag === 'select' ? clean(el.selectedOptions[0] ? el.selectedOptions[0].textContent : '') : tag === 'input' || tag === 'textarea' ? '' : clean(el.innerText || el.value || el.getAttribute('aria-label') || ''),
      label,
      name: el.getAttribute('name') || undefined,
      inputType: tag === 'input' ? type || 'text' : undefined,
      href: tag === 'a' ? el.href : undefined,
      required: el.required === true || /\*\s*$/.test(label || ''),
      hint: tag === 'input' || tag === 'select' || tag === 'textarea' ? hintOf(el) || undefined : undefined,
      options: tag === 'select' ? Array.from(el.options).map((o) => clean(o.textContent)) : undefined,
      region: regionOf(el),
      y: Math.round(r.top + window.scrollY),
      prominent: /primary|cta/.test(cls) || (r.height >= 40 && kind !== 'input'),
      blocked: !!dialog && !dialog.contains(el),
      expanded: el.hasAttribute('aria-expanded') ? el.getAttribute('aria-expanded') === 'true' : undefined,
      formIdx: el.form ? forms.indexOf(el.form) : undefined,
    });
    idx++;
  }
  const blocks = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  const seen = new Set();
  while ((n = walker.nextNode()) && blocks.length < 400) {
    const parent = n.parentElement;
    if (!parent || seen.has(parent) || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(parent.tagName)) continue;
    const text = clean(parent.innerText);
    if (!text || !isVisible(parent)) continue;
    seen.add(parent);
    blocks.push({ text, y: Math.round(parent.getBoundingClientRect().top + window.scrollY), region: regionOf(parent) });
  }
  return {
    url: location.href,
    title: document.title,
    viewport: { width: innerWidth, height: innerHeight },
    scrollY: Math.round(scrollY),
    scrollHeight: document.documentElement.scrollHeight,
    headings: Array.from(document.querySelectorAll('h1,h2,h3')).filter(isVisible).map((h) => clean(h.innerText)).slice(0, 20),
    blocks,
    elements,
    modalOpen: !!dialog,
    alerts: Array.from(document.querySelectorAll('[role="alert"],.error,.alert-danger')).filter(isVisible).map((a) => clean(a.innerText)),
  };
})()`;

export async function observe(page: Page): Promise<Observation> {
  return (await page.evaluate(OBSERVE_SCRIPT)) as Observation;
}

export const PRICE_RE =
  /(?:[€$£]\s?(\d{1,5}(?:[.,]\d{1,2})?))|(?:(\d{1,5}(?:[.,]\d{1,2})?)\s?(?:€|EUR|USD|GBP)\b)/g;

export function extractPrices(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(PRICE_RE)) {
    const raw = m[1] ?? m[2];
    if (raw) out.push(Number(raw.replace(',', '.')));
  }
  return out;
}
