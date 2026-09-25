import { execFileSync } from 'node:child_process';
import { hashSeed, Rng } from '../core/rng.js';
import { Repo } from './repo.js';
import {
  check,
  clamp,
  panelScore,
  stars,
  type Check,
  type Emit,
  type Evidence,
  type PanelResult,
  type Reviewer,
} from './types.js';

export interface InvOptions {
  repo: string;
  participants: number;
  seed: number;
  emit: Emit;
  /** Seconds to first success from the developer panel, when it executed. */
  firstSuccessSeconds?: number | null;
}

type Signal = { hit: boolean; evidence: Evidence[] };

/**
 * Investor readiness: what an investor or acquirer can VERIFY from the repository.
 * It never predicts funding; every point is backed by a quoted line.
 */
export async function runInvestors(o: InvOptions): Promise<PanelResult> {
  const t0 = Date.now();
  const P = 'investors' as const;
  const repo = new Repo(o.repo);
  const docs = repo.textFiles(/\.(md|mdx)$/i).filter((f) => !/node_modules|CHANGELOG/i.test(f));
  const readme = repo.readme;
  const md = readme ? repo.text(readme) : '';
  const top = md.split('\n').slice(0, 40).join('\n');
  const sig = (re: RegExp, files = docs, max = 4): Signal => {
    const evidence = repo.grep(re, files, max);
    return { hit: evidence.length > 0, evidence };
  };
  let n = 0;
  const tick = (label: string) => o.emit({ type: 'progress', panel: P, done: ++n, total: 12, label });

  const pkg = repo.json<{ bin?: unknown; scripts?: Record<string, string>; keywords?: string[] }>(
    'package.json',
  );
  const S = {
    cli: {
      hit: Boolean(pkg?.bin),
      evidence: pkg?.bin
        ? [{ kind: 'file' as const, ref: 'package.json', excerpt: 'bin: CLI entry point' }]
        : [],
    },
    permissive: sig(
      /Apache License|MIT License|BSD License|\bApache-2\.0\b|\bMIT\b/,
      repo.files.filter((f) => /^(LICENSE|README)/i.test(f)),
      2,
    ),
    copyleft: sig(
      /GNU AFFERO|AGPL|GNU GENERAL PUBLIC/i,
      repo.files.filter((f) => /^LICENSE/i.test(f)),
      1,
    ),
    hosted: sig(/\b(hosted|managed service|cloud version|saas)\b/i),
    enterprise: sig(/\b(enterprise|sso|audit log|team plan|on-prem)\b/i),
    pricing: sig(/\b(pricing|price|subscription|per seat|per month|\/mo\b|plan(s)?\b.*\$|€\s?\d)/i),
    strategy: {
      hit: repo.files.some((f) => /LICENSE_STRATEGY|BUSINESS|PRICING|MONETI/i.test(f)),
      evidence: repo.files
        .filter((f) => /LICENSE_STRATEGY|BUSINESS|PRICING|MONETI/i.test(f))
        .map((f) => ({ kind: 'file' as const, ref: f })),
    },
    compute: sig(
      /\b(playwright|chromium|browser|gpu|llm|inference|model)\b/i,
      [...(readme ? [readme] : []), 'package.json'],
      3,
    ),
    dataMoat: sig(/\b(calibrat\w*|benchmark|dataset|historical|proprietary data)\b/i),
    devtool: sig(/\b(cli|mcp|github action|sdk|api|npm i|npx)\b/i, readme ? [readme] : [], 4),
    agents: sig(/\b(mcp|agent(s|ic)?|llm|claude|cursor|codex)\b/i, readme ? [readme] : [], 4),
    b2b: sig(/\b(teams?|company|companies|b2b|ci\b|pull request|enterprise)\b/i, readme ? [readme] : [], 3),
    consumer: sig(/\b(consumer|mobile app|app store|subscribers?)\b/i, readme ? [readme] : [], 2),
    services: sig(/\b(consulting|audit service|done-for-you|agency)\b/i),
    api: sig(/\b(rest api|http api|api key|endpoint|sdk)\b/i, readme ? [readme] : [], 2),
    demo: sig(/npm run demo|docker run|one command|npx [\w-]+ demo|make demo/i, readme ? [readme] : [], 2),
    visuals: {
      hit: /!\[[^\]]*\]\([^)]+\.(png|gif|jpe?g|webp|svg)\)|<img /i.test(md),
      evidence: repo.grep(/!\[[^\]]*\]\([^)]+\.(png|gif|jpe?g|webp|svg)\)|<img /i, readme ? [readme] : [], 3),
    },
    comparison: sig(
      /\|\s*(vs\.?|versus|opinion|alternative|traditional|others?)\b|\bunlike\b|\binstead of\b|\bwhy\b/i,
      readme ? [readme] : [],
      3,
    ),
    limits: sig(/\b(limitation|not predicted|exploratory|caveat|does not claim|known issue|proxy)\b/i),
    security: {
      hit: repo.files.includes('SECURITY.md'),
      evidence: repo.files.includes('SECURITY.md') ? [{ kind: 'file' as const, ref: 'SECURITY.md' }] : [],
    },
  };
  tick('Signals');

  const ev = (...s: Signal[]) => s.flatMap((x) => x.evidence);
  const checks: Check[] = [];
  const c = (id: string, score: number, w: number, e: Evidence[], params?: Record<string, string | number>) =>
    checks.push(check(P, id, score, w, e, params));

  // Problem & value: a one-line promise + a "why" in the first screen of the README.
  const tagline = /^\s*(\*\*|>|#{1,2} ).{20,}/m.test(top);
  const why = /^#{2,3}\s*(why|the problem|por qué|waarom)/im.test(md);
  c(
    'inv.problem',
    (readme ? 30 : 0) + (tagline ? 35 : 0) + (why ? 35 : 0),
    3,
    readme
      ? [
          {
            kind: 'file',
            ref: `${readme}:1`,
            excerpt: top
              .split('\n')
              .find((l) => l.trim().length > 20)
              ?.trim()
              .slice(0, 140),
          },
        ]
      : [],
  );
  tick('Problem');
  c('inv.differentiation', S.comparison.hit ? 85 : 25, 3, S.comparison.evidence);
  tick('Differentiation');
  c(
    'inv.demo',
    (S.demo.hit ? 50 : 0) + (S.visuals.hit ? 35 : 0) + (o.firstSuccessSeconds ? 15 : 0),
    3,
    ev(S.demo, S.visuals),
    { seconds: o.firstSuccessSeconds ?? '—' },
  );
  tick('Demo');
  const bm = [S.pricing, S.hosted, S.enterprise, S.strategy].filter((x) => x.hit).length;
  c('inv.business_model', bm * 25, 4, ev(S.strategy, S.hosted, S.enterprise, S.pricing), { signals: bm });
  tick('Business model');
  const licenseFit = S.permissive.hit
    ? S.hosted.hit || S.enterprise.hit
      ? 95
      : 75
    : S.copyleft.hit
      ? 70
      : 20;
  c('inv.license_fit', licenseFit, 2, ev(S.permissive, S.copyleft));
  tick('License');

  // Traction proxies available without network: tests, CI, changelog, commit history.
  let commits = 0;
  try {
    commits =
      Number(
        execFileSync('git', ['-C', o.repo, 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim(),
      ) || 0;
  } catch {
    /* not a git repo */
  }
  const tests = repo.has(/(\.test\.|\.spec\.|(^|\/)tests?\/)/).length;
  const ci = repo.has(/^\.github\/workflows\//).length;
  const changelog = repo.files.includes('CHANGELOG.md');
  c(
    'inv.traction',
    clamp(Math.min(tests, 10) * 4 + (ci ? 25 : 0) + (changelog ? 15 : 0) + Math.min(commits, 20)),
    2,
    [
      { kind: 'metric', ref: 'tests', excerpt: `${tests} test files` },
      { kind: 'metric', ref: 'ci', excerpt: `${ci} workflows` },
      { kind: 'metric', ref: 'git', excerpt: `${commits} commits` },
    ],
    { tests, commits },
  );
  tick('Traction');

  // Adoption: evidence that people outside the team use it. Execution quality is not demand,
  // so a project with no releases, adopters or contributors cannot score like a proven one.
  const git = (args: string[]) => {
    try {
      return execFileSync('git', ['-C', o.repo, ...args], { encoding: 'utf8' }).trim();
    } catch {
      return '';
    }
  };
  const tags = git(['tag']).split('\n').filter(Boolean).length;
  const authors = new Set(git(['log', '--format=%ae']).split('\n').filter(Boolean)).size;
  const adopters =
    repo.has(/(^|\/)(ADOPTERS|USERS|CASE[_-]?STUDIES|TESTIMONIALS)(\.md)?$/i).length > 0 ||
    /^#{1,3} .*(used by|adopters|who uses|testimonials|customers|case stud)/im.test(md);
  const usageBadges =
    /shields\.io\/(npm\/d|github\/stars|pypi\/d|docker\/pulls)|img\.shields\.io\/github\/(stars|downloads)/i.test(
      md,
    );
  const adoption = clamp(
    Math.min(tags, 5) * 6 +
      (adopters ? 30 : 0) +
      (usageBadges ? 15 : 0) +
      Math.min(Math.max(authors - 1, 0), 5) * 5,
  );
  c(
    'inv.adoption',
    adoption,
    4,
    [
      { kind: 'metric', ref: 'git tags', excerpt: `${tags} releases/tags` },
      { kind: 'metric', ref: 'git authors', excerpt: `${authors} commit authors` },
      {
        kind: 'metric',
        ref: 'adopters',
        excerpt: adopters ? 'adopters/testimonials section found' : 'no adopters, users or testimonials',
      },
    ],
    { tags, authors, adopters: adopters ? 1 : 0 },
  );
  tick('Adoption');
  c(
    'inv.moat',
    (S.dataMoat.hit ? 45 : 0) +
      (S.hosted.hit ? 25 : 0) +
      (S.agents.hit ? 15 : 0) +
      (S.enterprise.hit ? 15 : 0),
    2,
    ev(S.dataMoat, S.hosted),
  );
  tick('Moat');
  c(
    'inv.market',
    (S.b2b.hit ? 40 : 0) + (S.devtool.hit ? 30 : 0) + (S.consumer.hit ? 30 : 0) + (S.agents.hit ? 20 : 0),
    2,
    ev(S.b2b, S.devtool, S.agents),
  );
  tick('Market');
  c('inv.risk_disclosure', (S.limits.hit ? 60 : 0) + (S.security.hit ? 40 : 0), 1, ev(S.limits, S.security));
  const gov = ['CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md', 'TRADEMARKS.md'].filter((f) =>
    repo.files.includes(f),
  );
  c(
    'inv.governance',
    gov.length * 25,
    1,
    gov.map((f) => ({ kind: 'file', ref: f })),
  );
  tick('Governance');

  // Business-model fit (0–100): which model the evidence supports, and why.
  const b = (s: Signal) => (s.hit ? 1 : 0);
  const models = [
    {
      id: 'open_source',
      fit: 30 + 25 * b(S.permissive) + 20 * b(S.devtool) + 15 * b(S.cli) - 25 * b(S.consumer),
      why: ['permissive', 'devtool', 'cli'],
    },
    {
      id: 'open_core',
      fit:
        25 +
        20 * b(S.permissive) +
        20 * b(S.enterprise) +
        15 * b(S.hosted) +
        15 * b(S.devtool) +
        10 * b(S.strategy),
      why: ['permissive', 'enterprise', 'hosted', 'strategy'],
    },
    {
      id: 'saas',
      fit: 20 + 25 * b(S.compute) + 20 * b(S.hosted) + 15 * b(S.b2b) + 15 * b(S.dataMoat),
      why: ['compute', 'hosted', 'b2b', 'dataMoat'],
    },
    {
      id: 'subscription',
      fit: 15 + 30 * b(S.consumer) + 20 * b(S.pricing) + 10 * b(S.hosted),
      why: ['consumer', 'pricing'],
    },
    {
      id: 'services',
      fit: 15 + 30 * b(S.services) + 15 * b(S.b2b) + 10 * b(S.compute),
      why: ['services', 'b2b'],
    },
    {
      id: 'api_usage',
      fit: 15 + 30 * b(S.api) + 20 * b(S.compute) + 10 * b(S.agents),
      why: ['api', 'compute', 'agents'],
    },
  ]
    .map((m) => ({
      id: m.id,
      fit: clamp(m.fit),
      reasons: m.why.filter((k) => (S as Record<string, Signal>)[k]?.hit),
    }))
    .sort((a, b2) => b2.fit - a.fit);
  tick('Models');

  // Virality / trend potential: things that make people try and share a repo.
  const viral = [
    { id: 'one_command_demo', pts: S.demo.hit ? 20 : 0 },
    { id: 'visual_output', pts: S.visuals.hit ? 20 : 0 },
    { id: 'ai_agents_trend', pts: S.agents.hit ? 20 : 0 },
    { id: 'permissive_license', pts: S.permissive.hit ? 15 : 0 },
    { id: 'clear_promise', pts: tagline ? 10 : 0 },
    {
      id: 'fast_first_success',
      pts: o.firstSuccessSeconds && o.firstSuccessSeconds < 120 ? 15 : o.firstSuccessSeconds ? 5 : 0,
    },
  ];
  const virality = viral.reduce((s, x) => s + x.pts, 0);

  // Who else might care (strategic interest), from capability keywords in the README.
  const kw = (re: RegExp) => (md.match(new RegExp(re.source, 'gi')) ?? []).length;
  const strategic = [
    { id: 'ai_labs', hits: kw(/\b(agent|llm|eval\w*|mcp|synthetic)\b/) },
    { id: 'browser_automation', hits: kw(/\b(playwright|browser|chromium|automation)\b/) },
    { id: 'analytics_ab', hits: kw(/\b(conversion|funnel|a\/b|experiment|segment)\b/) },
    { id: 'devtools_platforms', hits: kw(/\b(github|ci|pull request|cli|npm)\b/) },
    { id: 'security_compliance', hits: kw(/\b(security|privacy|audit|red team|gdpr)\b/) },
  ]
    .map((x) => ({ id: x.id, fit: clamp(Math.round(Math.sqrt(x.hits) * 22)) }))
    .sort((a, b2) => b2.fit - a.fit);
  tick('Market fit');

  const W: Record<string, Record<string, number>> = {
    angel: {
      'inv.problem': 5,
      'inv.demo': 5,
      'inv.differentiation': 3,
      'inv.market': 2,
      'inv.business_model': 2,
    },
    seed_vc: {
      'inv.business_model': 5,
      'inv.moat': 4,
      'inv.market': 4,
      'inv.traction': 4,
      'inv.adoption': 5,
      'inv.differentiation': 3,
      'inv.problem': 2,
    },
    strategic: {
      'inv.differentiation': 4,
      'inv.license_fit': 4,
      'inv.traction': 3,
      'inv.adoption': 4,
      'inv.moat': 3,
      'inv.risk_disclosure': 2,
    },
    oss_foundation: {
      'inv.license_fit': 5,
      'inv.governance': 5,
      'inv.risk_disclosure': 3,
      'inv.traction': 3,
      'inv.demo': 2,
    },
  };
  const reviewers: Reviewer[] = [];
  const kinds = Object.keys(W);
  for (let i = 0; i < Math.max(4, o.participants); i++) {
    const kind = kinds[i % kinds.length] as string;
    const rng = new Rng(hashSeed(o.seed, 'inv', i));
    const w = Object.fromEntries(
      Object.entries(W[kind] as Record<string, number>).map(([k, v]) => [k, v * (0.7 + rng.next() * 0.6)]),
    );
    const ran = checks.filter((x) => x.score !== null && w[x.id] !== undefined);
    const tw = ran.reduce((s, x) => s + (w[x.id] as number), 0);
    reviewers.push({
      id: `inv-${i + 1}`,
      archetype: kind,
      score: tw ? Math.round(ran.reduce((s, x) => s + (x.score as number) * (w[x.id] as number), 0) / tw) : 0,
    });
  }
  tick('Reviewers');
  const score = panelScore(checks);
  return {
    id: P,
    score,
    stars: stars(score),
    share: 0,
    reviewers,
    checks,
    duration_ms: Date.now() - t0,
    extra: { models, recommended: models[0]?.id, runner_up: models[1]?.id, virality, viral, strategic },
  };
}
