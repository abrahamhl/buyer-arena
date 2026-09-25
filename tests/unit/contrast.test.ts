import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// WCAG 2.1 AA (1.4.3): body-size text needs 4.5:1. The report and the studio use the same light palette; an
// axe-core scan of a demo report found text tokens at 3.0–4.4:1 on their real backgrounds.

type RGB = [number, number, number];

const hex = (h: string): RGB => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as RGB;
};
const lum = ([r, g, b]: RGB) => {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: RGB, b: RGB) => {
  const hi = Math.max(lum(a), lum(b));
  const lo = Math.min(lum(a), lum(b));
  return (hi + 0.05) / (lo + 0.05);
};
/** Colour of `rgba(r, g, b, a)` painted over an opaque background. */
const over = (rgba: string, bg: RGB): RGB => {
  const m = /rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/.exec(rgba);
  if (!m) return hex(rgba);
  const a = Number(m[4]);
  return [1, 2, 3].map((i, k) => Math.round(a * Number(m[i]) + (1 - a) * bg[k]!)) as RGB;
};

function lightTokens(css: string): Record<string, string> {
  const block = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}

const PAIRS: [fg: string, bgs: string[]][] = [
  ['text', ['bg', 'surface', 'surface-2']],
  ['text-2', ['bg', 'surface', 'surface-2']],
  ['text-3', ['bg', 'surface', 'surface-2']],
  ['accent', ['bg', 'surface', 'accent-soft']],
  ['good', ['bg', 'surface', 'good-soft']],
  ['bad', ['surface', 'bad-soft']],
  ['warn', ['surface', 'warn-soft']],
];

describe('light theme contrast (WCAG AA 4.5:1)', () => {
  const css = readFileSync(new URL('../../src/reports/assets/report.css', import.meta.url), 'utf8');
  const t = lightTokens(css);
  const surface = hex(t.surface!);

  for (const [fg, bgs] of PAIRS) {
    for (const bg of bgs) {
      it(`--${fg} on --${bg}`, () => {
        const back = t[bg]!.startsWith('rgba') ? over(t[bg]!, surface) : hex(t[bg]!);
        expect(ratio(hex(t[fg]!), back)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('secondary text on the segmented-control and chip greys', () => {
    // Blended greys measured by axe-core on the rendered report (pressed toggles, chips).
    for (const grey of ['#e1e1e3', '#e5e5e7', '#ebebeb']) {
      expect(ratio(hex(t['text-2']!), hex(grey)), grey).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the studio page uses the same accessible secondary colours', () => {
    const studio = readFileSync(new URL('../../src/studio/page.ts', import.meta.url), 'utf8');
    const root = /:root\{([^}]*)\}/.exec(studio)?.[1] ?? '';
    for (const token of ['text-2', 'text-3']) {
      const value = new RegExp(`--${token}:(#[0-9a-fA-F]{6})`).exec(root)?.[1];
      expect(value, token).toBe(t[token]);
    }
  });

  it('links inside running text are not identified by colour alone', () => {
    expect(css).toMatch(/p a,\s*li a,\s*\.trace a\s*\{[^}]*text-decoration:\s*underline/);
  });
});
