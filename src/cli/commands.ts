import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Command } from 'commander';
import { AgentRunEnvelopeSchema } from '../agent/envelope.js';
import { compareAgentEvals, runAgentEval, type AgentEvalReport } from '../agent/eval.js';
import { loadConfig } from '../config.js';
import { ensureDir, readJson } from '../core/fs.js';
import { c, log } from '../core/log.js';
import { summarizeEvidence } from '../evidence/envelope.js';
import { readEvidence, writeEvidence } from '../evidence/store.js';
import { getIntegration, listIntegrations } from '../integrations/registry.js';
import { readImportFile } from '../integrations/sdk.js';
import {
  buildGraph,
  evaluateGates,
  renderGraphText,
  stagesFromEvidence,
  withRelease,
} from '../lifecycle/graph.js';
import { describeSpec, loadCatalog, refreshModelsDev, snapshotPath, STALE_DAYS } from '../models/catalog.js';
import { modelDoctor } from '../models/doctor.js';
import { route, ROUTING_POLICIES, type ModelPurpose, type RoutingPolicy } from '../models/router.js';
import { currentLedger, describeLedger } from '../policy/network.js';

const catalogFromConfig = () => loadCatalog({ overrides: loadConfig()?.models?.overrides });

export async function printModelDoctor(): Promise<void> {
  const rows = await modelDoctor({ catalog: catalogFromConfig() });
  log(
    c.dim(
      `\n  ${'PROVIDER'.padEnd(18)}${'REACHABLE'.padEnd(11)}${'WHERE'.padEnd(8)}${'PRICE'.padEnd(34)}PRIVACY BOUNDARY`,
    ),
  );
  for (const r of rows) {
    const reachText = (r.reachable === null ? 'not probed' : r.reachable ? 'yes' : 'no').padEnd(11);
    const reach =
      r.reachable === null ? c.dim(reachText) : r.reachable ? c.green(reachText) : c.red(reachText);
    log(
      `  ${r.provider.padEnd(18)}${reach}${r.locality.padEnd(8)}${r.price.slice(0, 33).padEnd(34)}${r.privacy}`,
    );
    if (r.models.length)
      log(
        c.dim(
          `  ${''.padEnd(18)}models: ${r.models.slice(0, 6).join(', ')}${r.models.length > 6 ? ' …' : ''}`,
        ),
      );
    if (r.note && !r.reachable) log(c.dim(`  ${''.padEnd(18)}${r.note}`));
  }
  log(c.dim('\n  Cloud endpoints are never probed: `doctor --models` sends no data anywhere.\n'));
}

export function registerRcCommands(program: Command): void {
  /* ───────────── models ───────────── */
  const models = program
    .command('models')
    .description('Model catalog (built-in + optional Models.dev snapshot + your overrides)');
  models
    .command('list')
    .description('List catalogued models (no network)')
    .option('--provider <id>', 'only this provider')
    .option('--json', 'machine-readable output')
    .action((f: { provider?: string; json?: boolean }) => {
      const cat = catalogFromConfig();
      const list = cat.models.filter((m) => !f.provider || m.provider === f.provider);
      if (f.json)
        return log(
          JSON.stringify({ version: cat.version, models_dev: cat.models_dev, models: list }, null, 2),
        );
      log(
        c.dim(
          `\n  catalog ${cat.version}${cat.models_dev ? ` · Models.dev snapshot ${cat.models_dev.fetched_at.slice(0, 10)}${cat.models_dev.stale ? c.yellow(` (older than ${STALE_DAYS} days: prices may be stale)`) : ''}` : ' · no Models.dev snapshot (run `models refresh` to add one)'}`,
        ),
      );
      log(
        c.dim(
          `  ${'SPEC'.padEnd(52)}${'WHERE'.padEnd(8)}${'$IN/$OUT per 1M'.padEnd(18)}${'CONTEXT'.padEnd(10)}CAPS`,
        ),
      );
      for (const m of list.slice(0, 400)) {
        const price = m.pricing ? `${m.pricing.input}/${m.pricing.output}` : '?';
        const caps = [
          m.vision && 'vision',
          m.tools && 'tools',
          m.structured_output && 'json',
          m.dynamic && 'DYNAMIC',
        ]
          .filter(Boolean)
          .join(',');
        log(
          `  ${m.spec.slice(0, 51).padEnd(52)}${m.locality.padEnd(8)}${price.padEnd(18)}${String(m.context ?? '?').padEnd(10)}${caps}`,
        );
      }
      if (list.length > 400) log(c.dim(`  … ${list.length - 400} more (use --provider or --json)`));
      log('');
    });
  models
    .command('inspect')
    .argument('<spec>', 'provider:model')
    .description('Everything Buyer Arena knows about one model')
    .action((spec: string) => {
      const m = describeSpec(spec, catalogFromConfig());
      log(JSON.stringify(m, null, 2));
      if (m.dynamic) log(c.yellow('\n  DYNAMIC MODEL ROUTE — NON-REPRODUCIBLE MODEL SELECTION'));
    });
  models
    .command('refresh')
    .description('Download a Models.dev snapshot into the local cache (needs --network hybrid|online)')
    .option('--url <url>', 'catalog URL', undefined)
    .action(async (f: { url?: string }) => {
      const snap = await refreshModelsDev({ url: f.url });
      const cat = loadCatalog();
      log(`\n  ${c.green('●')} Models.dev snapshot ${snap.fetched_at} → ${snapshotPath()}`);
      log(
        c.dim(
          `  ${cat.models_dev?.models ?? 0} models from ${cat.models_dev?.providers ?? 0} providers. Prices are indicative; override them in buyer-arena.yaml models.overrides.\n`,
        ),
      );
    });
  models
    .command('route')
    .description('Explain which model the router would pick, and why (no call is made)')
    .option('--purpose <p>', 'buyer | auditor | critic | judge | vision | extractor | summarizer', 'auditor')
    .option('--routing <policy>', `routing policy (${ROUTING_POLICIES.join(' | ')})`)
    .option('--pin <spec>', 'explicit provider:model (never substituted)')
    .option('--max-cost <usd>', 'maximum expected cost')
    .option('--calls <n>', 'expected number of calls', '1')
    .option('--reproducible', 'forbid dynamic routes and fallbacks')
    .option('--local-preferred', 'prefer local models when eligible')
    .option('--available <spec...>', 'restrict to these configured specs')
    .action(
      async (f: {
        purpose: ModelPurpose;
        routing?: RoutingPolicy;
        pin?: string;
        maxCost?: string;
        calls: string;
        reproducible?: boolean;
        localPreferred?: boolean;
        available?: string[];
      }) => {
        const policy = f.routing ?? loadConfig()?.models?.routing;
        if (policy && !ROUTING_POLICIES.includes(policy)) throw new Error(`unknown routing policy ${policy}`);
        // Local models are discovered by probing loopback/LAN endpoints (allowed even OFFLINE).
        const local = await modelDoctor({ catalog: loadCatalog() });
        const discovered = local
          .filter((r) => r.locality === 'local' && r.reachable)
          .flatMap((r) => r.models.map((m) => describeSpec(`${r.provider}:${m}`)));
        const cat = loadCatalog({ overrides: loadConfig()?.models?.overrides, discovered });
        const d = route(
          {
            purpose: f.purpose,
            policy: currentLedger().effectiveMode === 'offline' ? 'offline' : policy,
            pinned: f.pin,
            reproducible: f.reproducible,
            est_calls: Number(f.calls),
            constraints: {
              max_cost_usd: f.maxCost ? Number(f.maxCost) : undefined,
              local_preferred: f.localPreferred,
            },
          },
          cat,
          { available: f.available },
        );
        log(JSON.stringify(d, null, 2));
      },
    );

  /* ───────────── agent-eval ───────────── */
  program
    .command('agent-eval')
    .description(
      'Evaluate what a change produced (AI agent or human): build, tests, diff quality, security, gates',
    )
    .requiredOption('--before <ref>', 'baseline commit')
    .requiredOption('--after <ref>', 'candidate commit')
    .option('--repo <dir>', 'git repository', '.')
    .option('--meta <file>', 'optional AgentRunEnvelope JSON (agent, model, tokens, cost…)')
    .option(
      '--evidence <file...>',
      'extra evidence.jsonl files for the AFTER state (Promptfoo, Gitleaks imports…)',
    )
    .option('--build <cmd>', 'build command (overrides buyer-arena.yaml agent_eval.build)')
    .option('--test <cmd>', 'test command (overrides agent_eval.test)')
    .option('--install <cmd>', 'install command (reaches the package registry)')
    .option('--buyer-before <rate>', 'synthetic goal completion on the before deployment (0..1)')
    .option('--buyer-after <rate>', 'synthetic goal completion on the after deployment (0..1)')
    .option('--id <id>', 'evaluation id')
    .option('--json', 'print the report JSON')
    .option('--root <dir>', 'output root', '.buyer-arena')
    .action(
      async (f: {
        before: string;
        after: string;
        repo: string;
        meta?: string;
        evidence?: string[];
        build?: string;
        test?: string;
        install?: string;
        buyerBefore?: string;
        buyerAfter?: string;
        id?: string;
        json?: boolean;
        root: string;
      }) => {
        const cfg = loadConfig();
        const ae = cfg?.agent_eval ?? {};
        const meta = f.meta ? AgentRunEnvelopeSchema.parse(readJson(f.meta)) : undefined;
        const { report, dir } = await runAgentEval({
          repo: f.repo,
          before: f.before,
          after: f.after,
          meta,
          commands: {
            install: f.install ?? ae.install,
            build: f.build ?? ae.build,
            test: f.test ?? ae.test,
            lint: ae.lint,
          },
          envPass: ae.env_pass,
          timeoutMs: ae.timeout_ms,
          root: f.root,
          id: f.id,
          gates: cfg?.release,
          evidence: (f.evidence ?? []).flatMap((x) => readEvidence(x)),
          buyer:
            f.buyerBefore !== undefined && f.buyerAfter !== undefined
              ? { before: Number(f.buyerBefore), after: Number(f.buyerAfter) }
              : undefined,
          emit: (l) => log(c.dim(`  ${l}`)),
        });
        if (f.json) return log(JSON.stringify(report, null, 2));
        log(
          `\n  ${c.bold('AGENT EVAL')}  ${report.before.slice(0, 8)} → ${report.after.slice(0, 8)}  output quality ${c.bold(`${report.quality.score}/100`)}`,
        );
        log(renderGraphText(report.graph));
        if (report.quality.caps.length) log(c.yellow(`  ${report.quality.caps.join('; ')}`));
        log(c.dim(`\n  ${describeLedger(report.network)}`));
        log(c.dim(`  ${relative(process.cwd(), join(dir, 'AGENT_EVAL.md'))}\n`));
        if (report.graph.gates && !report.graph.gates.passed) process.exitCode = 1;
      },
    );
  program
    .command('agent-compare')
    .description('Rank several agent-eval reports of the same baseline (patch A vs B vs C)')
    .argument('<reports...>', 'agent-eval.json files or their directories')
    .action((files: string[]) => {
      const reports = files.map((p) =>
        readJson<AgentEvalReport>(existsSync(join(p, 'agent-eval.json')) ? join(p, 'agent-eval.json') : p),
      );
      const cmp = compareAgentEvals(reports);
      if (!cmp.same_baseline)
        log(
          c.yellow('\n  warning: the reports do not share one baseline commit; ranking is not like-for-like'),
        );
      log(
        c.dim(
          `\n  ${'#'.padEnd(3)}${'AGENT'.padEnd(34)}${'QUALITY'.padEnd(9)}${'GATES'.padEnd(7)}${'COST'.padEnd(10)}FAILING`,
        ),
      );
      cmp.rows.forEach((r, i) =>
        log(
          `  ${String(i + 1).padEnd(3)}${r.agent.slice(0, 33).padEnd(34)}${String(r.quality).padEnd(9)}${(r.gates === null ? '—' : r.gates ? 'PASS' : 'FAIL').padEnd(7)}${(r.cost_usd === null ? '—' : `$${r.cost_usd.toFixed(3)}`).padEnd(10)}${r.failing.join(', ') || '—'}`,
        ),
      );
      log(
        c.dim(
          "\n  Ranked by gates, then output quality, then cost. Agents' own success claims are not used.\n",
        ),
      );
    });

  /* ───────────── evidence + gates ───────────── */
  const evidence = program.command('evidence').description('Portable evidence (Evidence Protocol v1)');
  evidence
    .command('summarize')
    .argument('<file...>', 'evidence.jsonl files or directories containing one')
    .option('--json', 'machine-readable output')
    .action((files: string[], f: { json?: boolean }) => {
      const list = collect(files);
      const s = summarizeEvidence(list);
      if (f.json) return log(JSON.stringify(s, null, 2));
      log(
        `\n  ${s.total} envelopes · critical ${s.by_severity.critical} · high ${s.by_severity.high} · medium ${s.by_severity.medium} · low ${s.by_severity.low} · info ${s.by_severity.info}`,
      );
      for (const [src, n] of Object.entries(s.by_source)) log(c.dim(`    ${src.padEnd(32)} ${n}`));
      log('');
    });
  program
    .command('gate')
    .description('Evaluate buyer-arena.yaml release gates over evidence (exit 1 when a gate fails)')
    .argument('<file...>', 'evidence.jsonl files or directories')
    .option('--buyer-delta-pp <n>', 'candidate − baseline goal completion in pp')
    .action((files: string[], f: { buyerDeltaPp?: string }) => {
      const list = collect(files);
      const gates = loadConfig()?.release;
      const graph0 = buildGraph(stagesFromEvidence(list));
      const sec = list.filter((e) => e.categories.includes('security'));
      const g = evaluateGates(graph0, gates, {
        security_critical: sec.filter((e) => e.severity === 'critical').length,
        security_high: sec.filter((e) => e.severity === 'high').length,
        buyer_delta_pp: f.buyerDeltaPp === undefined ? undefined : Number(f.buyerDeltaPp),
        tests_removed: list.filter((e) => e.finding_type.startsWith('tests.')).length,
      });
      const graph = withRelease(graph0, g);
      log(`\n${renderGraphText(graph)}\n`);
      for (const r of g.results)
        log(
          `  ${r.passed ? c.green('✓') : c.red('✗')} ${r.gate.padEnd(22)} required ${r.required.padEnd(8)} actual ${r.actual}`,
        );
      if (!gates) log(c.dim('  no `release.require` in buyer-arena.yaml: nothing to enforce'));
      log('');
      if (!g.passed) process.exitCode = 1;
    });
}

function collect(paths: string[]) {
  const files: string[] = [];
  for (const p of paths) {
    const abs = resolve(p);
    if (existsSync(abs) && statSync(abs).isDirectory()) {
      if (existsSync(join(abs, 'evidence.jsonl'))) files.push(join(abs, 'evidence.jsonl'));
      else for (const f of readdirSync(abs)) if (f.endsWith('.jsonl')) files.push(join(abs, f));
    } else files.push(abs);
  }
  return files.flatMap((f) => readEvidence(f));
}

/* ───────────── integrations ───────────── */
export function registerIntegrationCommands(program: Command): void {
  const integ = program
    .command('integrations')
    .description('External tools that contribute evidence (all optional)');
  integ
    .command('list')
    .description('Known integrations, whether they are installed, and how they connect (no network)')
    .option('--json', 'machine-readable output')
    .option('--no-detect', 'do not look for executables')
    .action(async (f: { json?: boolean; detect: boolean }) => {
      const rows = await listIntegrations({ detect: f.detect });
      if (f.json) return log(JSON.stringify(rows, null, 2));
      log(
        c.dim(
          `\n  ${'ID'.padEnd(13)}${'STATUS'.padEnd(13)}${'AVAILABLE'.padEnd(11)}${'INSTALLED'.padEnd(11)}${'OFFLINE'.padEnd(9)}${'MODE'.padEnd(16)}${'RISK'.padEnd(8)}${'VERSION'.padEnd(10)}CAPABILITIES`,
        ),
      );
      for (const r of rows) {
        // Available = usable now: import adapters always are (they read files); others need the tool.
        const available = r.detected.installed || r.modes.includes('import') || r.modes.includes('otel');
        const hasExe =
          Boolean(r.executables?.length) || r.modes.includes('native') || r.modes.includes('sidecar');
        const inst = !hasExe ? '—' : r.detected.installed ? 'yes' : 'no';
        const col = (t: string, w: number, color?: (x: string) => string) =>
          color ? color(t.padEnd(w)) : t.padEnd(w);
        log(
          `  ${r.id.padEnd(13)}${r.status.padEnd(13)}${col(available ? 'yes' : 'no', 11, available ? c.green : c.dim)}${col(inst, 11, inst === 'yes' ? c.green : c.dim)}${(r.offline_safe ? 'yes' : 'no').padEnd(9)}${r.modes.join(',').padEnd(16)}${r.execution_risk.padEnd(8)}${(r.detected.version ?? '—').slice(0, 9).padEnd(10)}${r.capabilities.join(',')}`,
        );
      }
      log(
        c.dim(
          '\n  builtin = ships with Buyer Arena · supported = tested adapter · adapter = import contract with fixtures · experimental = guarded/partial',
        ),
      );
      log(
        c.dim(
          '  Licenses and upstream URLs: `integrations info <id>` or docs/INTEGRATIONS.md. No partnership or endorsement is implied.\n',
        ),
      );
    });
  integ
    .command('info')
    .argument('<id>')
    .description('Manifest, license, detection and doctor checks for one integration')
    .action(async (id: string) => {
      const i = getIntegration(id);
      log(
        JSON.stringify(
          { ...i.manifest, detected: await i.detect(), doctor: i.doctor ? await i.doctor() : undefined },
          null,
          2,
        ),
      );
    });
  integ
    .command('import')
    .argument(
      '<id>',
      'integration id (promptfoo, garak, gitleaks, trivy, nuclei, deepeval, inspect-ai, lm-eval, pyrit, otel)',
    )
    .argument('<file>', "the tool's own output file")
    .option('--out <file>', 'evidence file to append to', '.buyer-arena/evidence/evidence.jsonl')
    .option('--repo <name>', 'target repository label')
    .option('--commit <sha>', 'target commit')
    .option('--url <url>', 'target URL')
    .action((id: string, file: string, f: { out: string; repo?: string; commit?: string; url?: string }) => {
      const i = getIntegration(id);
      const evidence = i.normalize(readImportFile(file), {
        target: { repo: f.repo, commit: f.commit, url: f.url },
        artifact: resolve(file),
        // An imported file was produced elsewhere: we cannot vouch it was produced offline.
        offline: false,
        network_accessed: false,
      });
      const r = writeEvidence(resolve(f.out), evidence);
      currentLedger().recordAdapter(id, false);
      const s = summarizeEvidence(evidence);
      log(
        `\n  ${c.green('●')} ${id}: ${evidence.length} envelopes (${r.added} new) → ${relative(process.cwd(), resolve(f.out))}`,
      );
      log(
        c.dim(
          `    critical ${s.by_severity.critical} · high ${s.by_severity.high} · medium ${s.by_severity.medium} · failed ${s.failed} · passed ${s.passed}\n`,
        ),
      );
    });
  integ
    .command('run')
    .argument('<id>', 'gitleaks | trivy | nuclei')
    .option('--repo <dir>', 'local repository', '.')
    .option('--url <url>', 'target URL (nuclei only)')
    .option('--templates <dir>', 'nuclei: local reviewed template directory')
    .option('--allow-active-scan', 'nuclei: opt in to active scanning')
    .option('--i-own-this-target', 'nuclei: confirm authorisation for the target')
    .option('--out <dir>', 'output directory', '.buyer-arena/evidence')
    .action(
      async (
        id: string,
        f: {
          repo: string;
          url?: string;
          templates?: string;
          allowActiveScan?: boolean;
          iOwnThisTarget?: boolean;
          out: string;
        },
      ) => {
        const i = getIntegration(id);
        if (!i.run)
          throw new Error(
            `${id} is import-only: run the tool yourself, then \`integrations import ${id} <file>\``,
          );
        const outDir = resolve(f.out, id);
        ensureDir(outDir);
        const res = await i.run({
          repo: resolve(f.repo),
          url: f.url,
          outDir,
          target: { repo: f.repo, url: f.url },
          ...({
            templates: f.templates,
            allowActive: f.allowActiveScan,
            authorized: f.iOwnThisTarget,
          } as object),
        });
        const r = writeEvidence(join(resolve(f.out), 'evidence.jsonl'), res.evidence);
        const s = summarizeEvidence(res.evidence);
        log(
          `\n  ${c.green('●')} ${id} ${res.tool_version ?? ''}: ${res.evidence.length} envelopes (${r.added} new) in ${Math.round(res.duration_ms / 100) / 10}s`,
        );
        log(
          c.dim(
            `    critical ${s.by_severity.critical} · high ${s.by_severity.high} · medium ${s.by_severity.medium} · raw report ${relative(process.cwd(), res.raw_path ?? '')}`,
          ),
        );
        log(c.dim(`    ${describeLedger(currentLedger().snapshot())}\n`));
      },
    );
}
