import { basename, join, resolve } from 'node:path';
import { currentLedger, type NetworkLedgerV1 } from './policy/network.js';
import type { Analysis } from './analysis.js';
import { ensureDir, readJson, writeFileAtomic, writeJson } from './core/fs.js';
import type { Population, RunRecord, Task } from './core/types.js';
import { startDemoStore, type DemoStore } from './demo-store/server.js';
import { generatePopulation } from './personas/generate.js';
import { evaluateBrief, type BriefResult } from './panels/brief.js';
import { runDevelopers } from './panels/developers.js';
import { runInvestors } from './panels/investors.js';
import { allocate, estimateSeconds, parseMix, type Allocation, type Depth, type Mix } from './panels/mix.js';
import { runSecurity } from './panels/security.js';
import { runSegments } from './panels/segments.js';
import { PANELS, stars, type Emit, type PanelId, type PanelResult } from './panels/types.js';
import { runUsers } from './panels/users.js';
import { journeyViews } from './reports/html.js';
import { renderLaunchReport } from './reports/launch-html.js';
import { renderLaunchMarkdown } from './reports/launch-md.js';
import { DEFAULT_ROOT, loadRuns, newSessionId } from './simulator/session.js';
import { DEMO_TASK } from './workflow.js';

export interface LaunchOptions {
  root?: string;
  id?: string;
  /** Local repository to review (developers, investors, security). */
  repo?: string;
  /** Live product URL (users, segments, security privacy/Argus). */
  url?: string;
  baseline?: string;
  candidate?: string;
  /** Use the bundled demo store for the web panels. */
  demo?: boolean;
  task?: Task;
  template?: string;
  seed?: number;
  size?: number;
  mix?: Mix | string;
  depth?: Depth;
  execute?: boolean;
  argus?: string;
  brief?: string;
  name?: string;
  maxParallel?: number;
  emit?: Emit;
  signal?: AbortSignal;
}

export interface LaunchAction {
  rank: number;
  panel: PanelId;
  check: string;
  score: number;
  impact: number;
  /** For end-user actions coming from the ROI backlog. */
  topic?: string;
  ceiling_pp?: number;
}

export interface LaunchReport {
  version: 1;
  id: string;
  generated_at: string;
  name: string;
  target: { repo?: string; url?: string; baseline?: string; candidate?: string; demo: boolean };
  mix: Mix;
  depth: Depth;
  size: number;
  execute: boolean;
  allocations: Allocation[];
  estimate_s: number;
  overall: { score: number | null; stars: number };
  panels: PanelResult[];
  brief?: BriefResult;
  actions: LaunchAction[];
  users_session?: string;
  duration_ms: number;
  /** Network policy and what was contacted while the launch check ran. */
  network?: NetworkLedgerV1;
  /** Always true: this is Buyer Arena's own synthetic judgement, not external validation. */
  self_generated?: boolean;
}

export interface LaunchResult {
  report: LaunchReport;
  dir: string;
  html: string;
  markdown: string;
  analysis?: Analysis;
}

export async function runLaunch(o: LaunchOptions): Promise<LaunchResult> {
  const t0 = Date.now();
  const emit: Emit = o.emit ?? (() => undefined);
  const id = o.id ?? `launch-${newSessionId()}`;
  if (!/^[A-Za-z0-9][\w.-]{0,80}$/.test(id) || id.includes('..')) throw new Error(`invalid launch id: ${id}`);
  const root = resolve(o.root ?? DEFAULT_ROOT);
  const dir = join(root, 'launch', id);
  ensureDir(dir);
  const mix = typeof o.mix === 'string' || o.mix === undefined ? parseMix(o.mix) : o.mix;
  const depth = o.depth ?? 'standard';
  const size = o.size ?? 40;
  const seed = o.seed ?? 42;
  const allocations = allocate(mix, size, depth);
  const alloc = (p: PanelId) => allocations.find((a) => a.panel === p) as Allocation;
  const repo = o.repo ? resolve(o.repo) : undefined;
  const stores: DemoStore[] = [];
  const panels: PanelResult[] = [];
  let analysis: Analysis | undefined;
  let runs: RunRecord[] = [];
  let usersSession: string | undefined;

  const compare = Boolean(o.baseline && o.candidate) || Boolean(o.demo);
  const estimate = estimateSeconds(allocations, { execute: Boolean(o.execute), compare });
  emit({
    type: 'plan',
    panels: allocations.map((a) => ({ id: a.panel, share: a.share, units: a.participants })),
  });

  const skip = (p: PanelId, why: string) => {
    emit({ type: 'panel', panel: p, state: 'skipped', note: why });
    const a = alloc(p);
    panels.push({
      id: p,
      score: null,
      stars: 0,
      share: a.share,
      reviewers: [],
      checks: [],
      duration_ms: 0,
      skipped: why,
    });
  };
  const done = (r: PanelResult) => {
    r.share = alloc(r.id).share;
    panels.push(r);
    emit({ type: 'panel', panel: r.id, state: 'done', score: r.score });
  };

  try {
    // Web targets (demo stores bind to 127.0.0.1 only).
    let variants: { name: string; url: string }[] = [];
    if (o.demo) {
      const [b, c] = await Promise.all([startDemoStore('baseline'), startDemoStore('candidate')]);
      stores.push(b, c);
      variants = [
        { name: 'baseline', url: b.url },
        { name: 'candidate', url: c.url },
      ];
    } else if (o.baseline && o.candidate) {
      variants = [
        { name: 'baseline', url: o.baseline },
        { name: 'candidate', url: o.candidate },
      ];
    } else if (o.url) variants = [{ name: 'current', url: o.url }];
    const webUrl = variants[variants.length - 1]?.url;
    const task = o.task ?? DEMO_TASK;
    const template = o.template ?? 'saas';

    // 1 End users
    const au = alloc('users');
    if (!au.participants) skip('users', 'share 0%');
    else if (!variants.length) skip('users', 'no --url, --baseline/--candidate or --demo');
    else {
      emit({ type: 'panel', panel: 'users', state: 'start' });
      const population: Population = generatePopulation({ template, size: au.participants, seed });
      const out = await runUsers({
        root: dir,
        sessionId: 'users',
        population,
        task,
        variants,
        maxParallel: o.maxParallel,
        allowTargetChange: Boolean(o.demo),
        emit,
        signal: o.signal,
      });
      analysis = out.analysis;
      runs = out.runs.filter((r) => r.variant === variants[variants.length - 1]?.name);
      usersSession = out.sessionDir;
      done(out.panel);
    }

    // 2 Segments
    const as = alloc('segments');
    if (!as.participants) skip('segments', 'share 0%');
    else if (!webUrl) skip('segments', 'needs a web target');
    else {
      emit({ type: 'panel', panel: 'segments', state: 'start' });
      const population = generatePopulation({ template, size: Math.max(5, as.participants), seed: seed + 1 });
      done(
        await runSegments({
          root: dir,
          launchId: 'seg',
          url: webUrl,
          population,
          task,
          participants: as.participants,
          runs,
          emit,
          signal: o.signal,
        }),
      );
    }

    // 3 Developers
    const ad = alloc('developers');
    let firstSuccess: number | null = null;
    if (!ad.participants) skip('developers', 'share 0%');
    else if (!repo) skip('developers', 'needs --repo');
    else {
      emit({ type: 'panel', panel: 'developers', state: 'start' });
      const r = await runDevelopers({
        repo,
        participants: ad.participants,
        level: ad.level,
        execute: Boolean(o.execute),
        seed,
        emit,
        signal: o.signal,
      });
      firstSuccess = (r.checks.find((c) => c.id === 'dev.first_success')?.params?.seconds as number) || null;
      done(r);
    }

    // 4 Investors
    const ai = alloc('investors');
    if (!ai.participants) skip('investors', 'share 0%');
    else if (!repo) skip('investors', 'needs --repo');
    else {
      emit({ type: 'panel', panel: 'investors', state: 'start' });
      done(
        await runInvestors({
          repo,
          participants: ai.participants,
          seed,
          emit,
          firstSuccessSeconds: firstSuccess,
        }),
      );
    }

    // 5 Red team
    const ar = alloc('security');
    if (!ar.participants) skip('security', 'share 0%');
    else if (!repo && !webUrl) skip('security', 'needs --repo or a URL');
    else {
      emit({ type: 'panel', panel: 'security', state: 'start' });
      done(
        await runSecurity({
          repo,
          url: o.url ?? o.candidate,
          participants: ar.participants,
          level: ar.level,
          seed,
          emit,
          argus: o.argus,
          runs,
        }),
      );
    }
  } finally {
    await Promise.all(stores.map((s) => s.close()));
  }

  // Overall: mean of panel scores weighted by the attention each panel was given.
  const scored = panels.filter((p) => p.score !== null && p.share > 0);
  const tw = scored.reduce((s, p) => s + p.share, 0);
  const overall = tw ? Math.round(scored.reduce((s, p) => s + (p.score as number) * p.share, 0) / tw) : null;

  // One action plan across panels: biggest weighted gap first.
  const actions: LaunchAction[] = [];
  for (const p of panels)
    for (const c of p.checks)
      if (c.score !== null && c.score < 75)
        actions.push({
          rank: 0,
          panel: p.id,
          check: c.id,
          score: c.score,
          impact: Math.round((100 - c.score) * c.weight * (p.share / 100) * 10) / 10,
        });
  for (const b of analysis?.backlog ?? [])
    if (b.ceiling_pp > 0)
      actions.push({
        rank: 0,
        panel: 'users',
        check: `topic:${b.topic}`,
        topic: b.topic,
        score: Math.round(100 - b.ceiling_pp * 100),
        ceiling_pp: b.ceiling_pp,
        impact: Math.round(b.ceiling_pp * 100 * 5 * (alloc('users').share / 100) * 10) / 10,
      });
  actions.sort((a, b) => b.impact - a.impact);
  actions.forEach((a, i) => (a.rank = i + 1));

  const brief = repo ? evaluateBrief(repo, o.brief) : undefined;
  const report: LaunchReport = {
    version: 1,
    id,
    network: currentLedger().snapshot(),
    self_generated: true,
    generated_at: new Date().toISOString(),
    name: o.name ?? (repo ? basename(repo) : (o.url ?? 'demo')),
    target: {
      repo: repo ? basename(repo) : undefined,
      url: o.url,
      baseline: o.baseline,
      candidate: o.candidate,
      demo: Boolean(o.demo),
    },
    mix,
    depth,
    size,
    execute: Boolean(o.execute),
    allocations,
    estimate_s: estimate,
    overall: { score: overall, stars: stars(overall) },
    panels: PANELS.map((p) => panels.find((x) => x.id === p) as PanelResult),
    brief,
    actions: actions.slice(0, 25),
    users_session: usersSession ? 'sessions/users' : undefined,
    duration_ms: Date.now() - t0,
  };
  writeJson(join(dir, 'launch.json'), report);
  if (analysis) writeJson(join(dir, 'users-analysis.json'), analysis);
  const html = join(dir, 'report.html');
  const md = join(dir, 'LAUNCH_REPORT.md');
  writeLaunchOutputs(dir, report, analysis, usersSession);
  emit({ type: 'done', overall, dir });
  return { report, dir, html, markdown: md, analysis };
}

/** (Re)write report.html and LAUNCH_REPORT.md for a launch directory. */
export function writeLaunchOutputs(
  dir: string,
  report: LaunchReport,
  analysis?: Analysis,
  usersSessionDir?: string,
  lang: 'es' | 'en' | 'nl' = 'en',
): void {
  const journeys =
    analysis && usersSessionDir
      ? journeyViews(
          usersSessionDir,
          loadUsersRuns(usersSessionDir),
          readJson<Population>(join(usersSessionDir, 'population.json')).personas,
          dir,
        )
      : [];
  writeFileAtomic(join(dir, 'report.html'), renderLaunchReport(report, analysis, journeys));
  writeFileAtomic(join(dir, 'LAUNCH_REPORT.md'), renderLaunchMarkdown(report, analysis, lang));
}

const loadUsersRuns = (d: string) => loadRuns(d);

export function loadLaunch(dir: string): { report: LaunchReport; analysis?: Analysis; usersDir?: string } {
  const report = readJson<LaunchReport>(join(dir, 'launch.json'));
  let analysis: Analysis | undefined;
  try {
    analysis = readJson<Analysis>(join(dir, 'users-analysis.json'));
  } catch {
    /* no users panel */
  }
  return { report, analysis, usersDir: report.users_session ? join(dir, report.users_session) : undefined };
}
