import { join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { Analysis } from '../analysis.js';
import { analyzeSession } from '../analysis.js';
import { TaskSchema } from '../core/types.js';
import { generatePopulation, loadPopulation, savePopulation } from '../personas/generate.js';
import { writeReports } from '../reports/index.js';
import { DEFAULT_ROOT, loadRuns } from '../simulator/session.js';
import {
  assertTarget,
  listSessions,
  resolveSession,
  runDemo,
  runPipeline,
  type PipelineResult,
} from '../workflow.js';

/**
 * MCP tools are compact by design: they return summaries and ids, never full traces.
 * Targets are restricted to localhost unless BUYER_ARENA_ALLOW_REMOTE=1, because an
 * MCP client (an LLM) supplies the URLs.
 */
const localOnly = () => process.env.BUYER_ARENA_ALLOW_REMOTE !== '1';

const text = (value: unknown) => ({
  content: [
    { type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) },
  ],
});

const runShape = {
  success_text: z.string().optional().describe('Regex: goal reached when page text matches'),
  success_url: z.string().optional().describe('Regex: goal reached when URL matches'),
  instruction: z.string().optional().describe('Task given to buyers (never mention variants)'),
  population_file: z.string().optional(),
  template: z.string().default('saas'),
  size: z.number().int().min(1).max(200).default(20),
  seed: z.number().int().default(42),
  buyer: z
    .string()
    .default('heuristic')
    .describe('heuristic | anthropic:<model> | openai:<model> | lmstudio:<model> | ollama:<model>'),
  budget_usd: z.number().min(0).max(20).optional().describe('Hard USD cap when an LLM buyer is used'),
  max_parallel: z.number().int().min(1).max(8).optional(),
};

type RunArgs = { [K in keyof typeof runShape]: z.infer<(typeof runShape)[K]> };

function taskFrom(a: RunArgs) {
  if (!a.success_text && !a.success_url)
    throw new Error('Provide success_text or success_url so the goal can be measured.');
  return TaskSchema.parse({
    id: 'mcp',
    instruction:
      a.instruction ??
      'Find out whether this product fits your needs and budget and, if it does, start using it.',
    success: { text_pattern: a.success_text, url_pattern: a.success_url },
  });
}

export function summarize(a: Analysis, reportPath?: string) {
  const audit = a.audits[a.backlog_variant];
  return {
    session_id: a.session.session_id,
    status: a.session.status,
    buyers: a.summaries[0]?.n ?? 0,
    variants: a.summaries.map((s) => ({
      variant: s.variant,
      goal_completion: round(s.completion.rate),
      abandonment: round(s.abandonment.rate),
      median_steps: s.median_steps,
    })),
    comparison: a.comparison && {
      label: a.comparison.label,
      goal_completion_delta: round(a.comparison.headline.delta),
      interval_95: [round(a.comparison.headline.lo), round(a.comparison.headline.hi)],
      n_pairs: a.comparison.n_pairs,
      note: 'CONVERSION PROXY — not predicted revenue',
    },
    top_friction: a.clusters
      .filter((c) => c.variant === a.backlog_variant)
      .slice(0, 5)
      .map((c) => ({ code: c.code, title: c.title, affected: `${c.affected}/${c.population}` })),
    backlog: a.backlog.slice(0, 5).map((o) => ({
      rank: o.rank,
      title: o.title,
      leverage: o.leverage,
      score: o.score,
      experiment: o.experiment,
      evidence: o.evidence_ids.slice(0, 3),
    })),
    findings: audit?.consensus.length ?? 0,
    report: reportPath,
  };
}

const round = (x: number) => Math.round(x * 1000) / 1000;
const done = (r: PipelineResult) => text(summarize(r.analysis, r.reports.html));

export function createMcpServer(root = DEFAULT_ROOT): McpServer {
  const server = new McpServer({ name: 'buyer-arena', version: '0.1.0' });

  server.registerTool(
    'create_population',
    {
      description:
        'Generate a deterministic synthetic buyer population (same seed → same buyers). Optionally save to a YAML/JSON file.',
      inputSchema: {
        template: z.string().default('saas'),
        size: z.number().int().min(1).max(500).default(20),
        seed: z.number().int().default(42),
        out: z.string().optional(),
      },
    },
    async ({ template, size, seed, out }) => {
      const pop = generatePopulation({ template, size, seed });
      if (out) savePopulation(out, pop);
      return text({
        saved_to: out,
        size: pop.personas.length,
        segments: [...new Set(pop.personas.map((p) => p.segment))],
        sample: pop.personas.slice(0, 5).map((p) => ({
          id: p.persona_id,
          name: p.name,
          segment: p.segment,
          budget: p.budget,
          device: p.device.kind,
        })),
      });
    },
  );

  server.registerTool(
    'run_simulation',
    {
      description:
        'Run synthetic buyers against ONE url (localhost only by default). Returns completion, friction and ranked experiments.',
      inputSchema: { url: z.string(), ...runShape },
    },
    async (a) => {
      const pop = a.population_file
        ? loadPopulation(a.population_file)
        : generatePopulation({ template: a.template, size: a.size, seed: a.seed });
      return done(
        await runPipeline({
          root,
          population: pop,
          task: taskFrom(a),
          variants: [{ name: 'current', url: assertTarget(a.url, { localOnly: localOnly() }) }],
          buyer: a.buyer,
          budgetUsd: a.budget_usd,
          maxParallel: a.max_parallel,
        }),
      );
    },
  );

  server.registerTool(
    'compare_variants',
    {
      description:
        'Run the SAME seeded buyers against a baseline and a candidate url and compare (conversion proxy with paired bootstrap interval).',
      inputSchema: { baseline_url: z.string(), candidate_url: z.string(), ...runShape },
    },
    async (a) => {
      const pop = a.population_file
        ? loadPopulation(a.population_file)
        : generatePopulation({ template: a.template, size: a.size, seed: a.seed });
      return done(
        await runPipeline({
          root,
          population: pop,
          task: taskFrom(a),
          variants: [
            { name: 'baseline', url: assertTarget(a.baseline_url, { localOnly: localOnly() }) },
            { name: 'candidate', url: assertTarget(a.candidate_url, { localOnly: localOnly() }) },
          ],
          buyer: a.buyer,
          budgetUsd: a.budget_usd,
          maxParallel: a.max_parallel,
        }),
      );
    },
  );

  server.registerTool(
    'run_demo',
    {
      description:
        'Run the bundled demo (fictional SaaS, baseline vs candidate) with deterministic buyers. Free; ~10–30s.',
      inputSchema: { size: z.number().int().min(5).max(100).default(20), seed: z.number().int().default(42) },
    },
    async ({ size, seed }) => done(await runDemo({ root, size, seed })),
  );

  server.registerTool(
    'inspect_run',
    {
      description: 'Compact timeline of one buyer journey (decisions, errors, milestones) with evidence ids.',
      inputSchema: { run_id: z.string().describe('e.g. candidate-p-004'), session: z.string().optional() },
    },
    async ({ run_id, session }) => {
      const dir = resolveSession(session, root);
      const run = loadRuns(dir).find((r) => r.run_id === run_id);
      if (!run) return text(`run ${run_id} not found`);
      return text({
        run_id,
        segment: run.segment,
        status: run.status,
        steps: run.steps,
        abandon_reason: run.abandon_reason,
        timeline: run.events
          .filter((e) => e.type !== 'observe' && e.type !== 'navigate')
          .map((e) =>
            `${e.id} #${e.step} ${e.type} ${[e.target, e.detail].filter(Boolean).join(' — ')}`.slice(0, 200),
          ),
        screenshots: join(dir, 'runs', run.variant, run.persona_id, 'shots'),
        trace: run.trace_path ? join(dir, 'runs', run.variant, run.persona_id, run.trace_path) : undefined,
      });
    },
  );

  server.registerTool(
    'generate_report',
    {
      description:
        'Re-analyse a session and regenerate report.html + ROI_BACKLOG.md. Returns paths and summary.',
      inputSchema: { session: z.string().optional() },
    },
    async ({ session }) => {
      const dir = resolveSession(session, root);
      const a = await analyzeSession(dir);
      const p = writeReports(dir, a);
      return text({ ...summarize(a, p.html), backlog_file: p.backlog });
    },
  );

  server.registerTool(
    'get_findings',
    {
      description:
        'Consensus findings (observed fact vs inference vs hypothesis) with evidence ids for a session.',
      inputSchema: { session: z.string().optional(), variant: z.string().optional() },
    },
    async ({ session, variant }) => {
      const dir = resolveSession(session, root);
      const a = await analyzeSession(dir);
      const v = variant ?? a.backlog_variant;
      return text(
        (a.audits[v]?.consensus ?? []).map((c) => ({
          id: c.id,
          title: c.title,
          observed_fact: c.observed_fact,
          [c.claim]: c.interpretation,
          severity: c.severity,
          confidence: c.confidence,
          supporters: c.supporters,
          red_team: c.challenges.map((x) => x.text),
          evidence: c.evidence_ids.slice(0, 6),
          experiment: c.proposed_experiments[0],
        })),
      );
    },
  );

  server.registerTool(
    'list_sessions',
    { description: 'List recent simulation sessions.', inputSchema: {} },
    async () =>
      text(
        listSessions(root)
          .slice(0, 20)
          .map((s) => s.id),
      ),
  );

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
}
