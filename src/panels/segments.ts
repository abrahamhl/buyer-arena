import { launchChromium } from '../core/browser.js';
import type { Population, RunRecord, Task } from '../core/types.js';
import { runSession } from '../simulator/session.js';
import {
  check,
  clamp,
  panelScore,
  stars,
  type Check,
  type Emit,
  type PanelResult,
  type Reviewer,
} from './types.js';

export interface SegOptions {
  root: string;
  launchId: string;
  url: string;
  population: Population;
  task: Task;
  participants: number;
  /** Journeys already run by the users panel (reused for accessibility and mobile evidence). */
  runs: RunRecord[];
  emit: Emit;
  signal?: AbortSignal;
}

/**
 * Objective segments — defined by what changes behaviour or access, not by demographics:
 * accessibility, slow connections, refusing to create an account, 200% zoom, language, mobile.
 */
export async function runSegments(o: SegOptions): Promise<PanelResult> {
  const t0 = Date.now();
  const P = 'segments' as const;
  const checks: Check[] = [];
  const table: { id: string; score: number | null; n: number }[] = [];
  let n = 0;
  const total = 6;
  const tick = (label: string) => o.emit({ type: 'progress', panel: P, done: ++n, total, label });
  const k = Math.max(2, Math.min(o.population.personas.length, Math.round(o.participants / 2)));
  const sample: Population = { ...o.population, personas: o.population.personas.slice(0, k) };

  // 1 Accessibility: page-level signals from every page the buyers visited.
  const pages = new Map<string, NonNullable<RunRecord['page_checks']>[number]>();
  for (const r of o.runs) for (const pc of r.page_checks ?? []) pages.set(pc.url.split('?')[0] as string, pc);
  const list = [...pages.values()];
  if (list.length) {
    const pen = (p: (typeof list)[number]) =>
      p.unlabeled_inputs * 10 +
      p.images_without_alt * 5 +
      p.unnamed_controls * 8 +
      Math.min(20, p.small_targets) +
      Math.min(30, p.low_contrast * 2) +
      (p.lang ? 0 : 15);
    const score = clamp(100 - list.reduce((s, p) => s + pen(p), 0) / list.length);
    const worst = [...list].sort((a, b) => pen(b) - pen(a)).slice(0, 4);
    checks.push(
      check(
        P,
        'seg.accessibility',
        score,
        4,
        worst.flatMap((p) => [
          {
            kind: 'url' as const,
            ref: p.url,
            excerpt: `unlabeled ${p.unlabeled_inputs} · no-alt ${p.images_without_alt} · unnamed ${p.unnamed_controls} · small ${p.small_targets} · contrast ${p.low_contrast}`,
          },
          ...p.samples
            .slice(0, 1)
            .map((s) => ({ kind: 'url' as const, ref: `${p.url}#${s.kind}`, excerpt: s.text })),
        ]),
        {
          pages: list.length,
        },
      ),
    );
    table.push({ id: 'accessibility', score, n: list.length });
  } else checks.push(check(P, 'seg.accessibility', null, 4, [], { pages: 0 }));
  tick('Accessibility');

  const variant = [{ name: 'current', url: o.url }];
  const mini = async (id: string, extra: Partial<Parameters<typeof runSession>[0]>, pop: Population) => {
    o.emit({ type: 'log', panel: P, line: `segment ${id}: ${pop.personas.length} journeys` });
    const r = await runSession({
      root: o.root,
      sessionId: `${o.launchId}-seg-${id}`,
      population: pop,
      task: o.task,
      variants: variant,
      screenshots: false,
      trace: 'off',
      maxParallel: 2,
      allowTargetChange: true,
      signal: o.signal,
      ...extra,
    });
    return r.runs;
  };
  const rate = (runs: RunRecord[]) =>
    runs.length ? runs.filter((r) => r.goal_completed).length / runs.length : 0;
  const baseRuns = o.runs.filter((r) => sample.personas.some((p) => p.persona_id === r.persona_id));

  // 2 Slow connection (Slow-3G-like): same personas, throttled network.
  const slow = await mini('slow', { network: 'slow3g', timeoutMs: 120_000 }, sample);
  const loadMs = slow.flatMap((r) => (r.page_checks ?? []).map((p) => p.load_ms ?? 0)).filter(Boolean);
  const medLoad = loadMs.length ? ([...loadMs].sort((a, b) => a - b)[Math.floor(loadMs.length / 2)] ?? 0) : 0;
  const slowScore = clamp(
    rate(slow) * 100 - (rate(baseRuns) - rate(slow)) * 50 - Math.max(0, (medLoad - 3000) / 200),
  );
  checks.push(
    check(
      P,
      'seg.slow_network',
      slowScore,
      3,
      slow.slice(0, 3).map((r) => ({
        kind: 'run' as const,
        ref: `${r.run_id}:e0`,
        excerpt: `${r.status} · ${r.steps} steps`,
      })),
      { rate: `${Math.round(rate(slow) * 100)}%`, load: `${Math.round(medLoad)} ms` },
    ),
  );
  table.push({ id: 'slow_network', score: slowScore, n: slow.length });
  tick('Slow network');

  // 3 People who refuse to create an account.
  const noAcc: Population = {
    ...sample,
    personas: sample.personas.map((p) => ({
      ...p,
      objections: [...new Set([...p.objections, 'no-account'])],
    })),
  };
  const acc = await mini('noaccount', {}, noAcc);
  const accScore = Math.round(rate(acc) * 100);
  checks.push(
    check(
      P,
      'seg.no_account',
      accScore,
      3,
      acc
        .filter((r) => !r.goal_completed)
        .slice(0, 3)
        .map((r) => ({ kind: 'run' as const, ref: `${r.run_id}:e0`, excerpt: r.abandon_reason ?? r.status })),
      { rate: `${accScore}%` },
    ),
  );
  table.push({ id: 'no_account', score: accScore, n: acc.length });
  tick('No account');

  // 4 200% zoom (1280px screen at 200% = 640 CSS px) and a 320px phone: does content overflow?
  const browser = await launchChromium();
  let zoomScore: number | null = null;
  const zoomEv: { kind: 'url'; ref: string; excerpt: string }[] = [];
  let lang = '';
  let alternates = 0;
  try {
    for (const [w, h, label] of [
      [640, 400, 'zoom200'],
      [320, 640, 'phone320'],
    ] as const) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.route('**/*', (r) =>
        new URL(r.request().url()).origin === new URL(o.url).origin || r.request().url().startsWith('data:')
          ? r.continue()
          : r.abort(),
      );
      await page.goto(o.url, { waitUntil: 'domcontentloaded', timeout: 20_000 }).catch(() => undefined);
      const info = (await page
        .evaluate(
          '({ o: document.documentElement.scrollWidth - innerWidth, lang: document.documentElement.lang || "", alt: document.querySelectorAll("link[rel=alternate][hreflang]").length })',
        )
        .catch(() => ({ o: 0, lang: '', alt: 0 }))) as { o: number; lang: string; alt: number };
      zoomScore = Math.min(zoomScore ?? 100, clamp(100 - Math.max(0, info.o) / 4));
      zoomEv.push({ kind: 'url', ref: `${o.url} @${label}`, excerpt: `horizontal overflow ${info.o}px` });
      lang = info.lang;
      alternates = info.alt;
      await page.close();
    }
  } finally {
    await browser.close();
  }
  checks.push(
    check(P, 'seg.zoom', zoomScore, 2, zoomEv, {
      overflow: zoomEv.map((e) => e.excerpt.replace(/\D+/g, '')).join('/'),
    }),
  );
  table.push({ id: 'zoom', score: zoomScore, n: 2 });
  tick('Zoom');

  // 5 Language: declared language and alternatives for other languages.
  const langScore = (lang ? 50 : 0) + (alternates ? 50 : 0);
  checks.push(
    check(
      P,
      'seg.language',
      langScore,
      1,
      [{ kind: 'url', ref: o.url, excerpt: `lang="${lang}" · ${alternates} hreflang alternates` }],
      { lang: lang || '—', alternates },
    ),
  );
  table.push({ id: 'language', score: langScore, n: 1 });
  tick('Language');

  // 6 Mobile vs desktop completion from the users panel.
  const mob = o.runs.filter((r) => /mobile/i.test(r.archetype));
  const desk = o.runs.filter((r) => !/mobile/i.test(r.archetype));
  const mobScore = mob.length ? clamp(100 - Math.max(0, rate(desk) - rate(mob)) * 100) : null;
  checks.push(
    check(
      P,
      'seg.mobile',
      mobScore,
      2,
      mob.slice(0, 3).map((r) => ({ kind: 'run' as const, ref: `${r.run_id}:e0`, excerpt: `${r.status}` })),
      { mobile: `${Math.round(rate(mob) * 100)}%`, desktop: `${Math.round(rate(desk) * 100)}%` },
    ),
  );
  table.push({ id: 'mobile', score: mobScore, n: mob.length });
  tick('Mobile');

  const reviewers: Reviewer[] = table
    .filter((x) => x.score !== null)
    .map((x) => ({ id: x.id, archetype: x.id, score: Math.round(x.score as number) }));
  const score = panelScore(checks);
  return {
    id: P,
    score,
    stars: stars(score),
    share: 0,
    reviewers,
    checks,
    duration_ms: Date.now() - t0,
    extra: { table },
  };
}
