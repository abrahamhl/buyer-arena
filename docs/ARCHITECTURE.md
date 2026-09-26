# Architecture

Buyer Arena is one TypeScript package (strict mode, ESM, Node 22.12 or later). Its modules are
folders under `src/`, and each folder exists because it holds working code. The package can be
split into workspace packages once there is a second consumer that needs one.

```
src/
  core/         types (zod schemas), seeded RNG, atomic fs, bounded pool, errors
  personas/     templates (5) × archetypes (5), deterministic generator, YAML/JSON io
  stories/      persona → story (structured + narrative); allow-listed BuyerBrief + leak check
  browser/      in-page observation (elements, text blocks, modal, alerts), price extraction
  simulator/    BuyerPolicy interface, HeuristicBuyer, LlmBuyer, journey runner, session orchestrator
  engines/      external engine adapter (Browser Use / Browser Harness JSON contract)
  providers/    Anthropic, OpenAI-compatible (OpenAI, LM Studio, Ollama, vLLM), Mock; CostMeter
  metrics/      run metrics, variant summaries, friction detectors + clusters, statistics
  comparison/   paired comparison, segment deltas, friction diff (resolved / persisting / new)
  auditors/     packet builder, 5 rule-based auditors, LLM auditor, consensus, playbook
  roi/          prioritisation with an exposed formula
  calibration/  aggregate-only calibration input, weights, calibration error
  reports/      HTML report, ROI_BACKLOG.md, terminal summary
  mcp/          MCP stdio server
  cli/          commander CLI
  demo-store/   "Tallybird" baseline/candidate demo app (node:http, no deps)
  policy/       global network policy (offline/local/hybrid/online) + per-command ledger
  evidence/     Evidence Protocol v1 envelopes, JSONL store, converters for built-in results
  integrations/ SDK, safe executable detection, adapters (Promptfoo, garak, Gitleaks, Trivy, Nuclei, …)
  models/       catalog (built-in + Models.dev snapshot + overrides), router, response cache, economy, doctor
  agent/        AgentRunEnvelope + agent-eval (worktrees, diff checks, before/after commands)
  lifecycle/    SPEC→RELEASE stage graph and release gates
  ensemble/     multi-buyer disagreement (experimental)
  audit/        static repository URL audit (no code executed)
  analysis.ts   runs → metrics → friction → comparison → auditors → consensus → backlog
  workflow.ts   run/compare/demo/resume pipeline shared by CLI and MCP
```

## Data flow and storage

```
.buyer-arena/
  latest.json
  sessions/<id>/
    session.json         manifest: task, variants, limits, status, usage
    population.json
    runs/<variant>/<persona>/{run.json, story.json, shots/*.jpg, trace.zip}
    analysis.json        metrics, clusters, comparison, audits, backlog
    report.html          self-contained; loads screenshots by relative path
    ROI_BACKLOG.md
```

Each `run.json` is written atomically (to a temporary file, then renamed). A journey that has
finished (any status except `error` or `budget_exhausted`) is skipped on resume, so interrupted
sessions continue where they stopped.

## Control plane

```
INPUT  product URL · repository · PR/commit · agent run · model output · external eval result
  ↓
EVALUATION (built-in journeys + panels, agent-eval, external tools via the integration SDK)
  ↓
EVIDENCE BUS  EvidenceEnvelopeV1 → evidence.jsonl   (network ledger + provenance on every run)
  ↓
NORMALISED METRICS → COMPARISON / UNCERTAINTY / CALIBRATION → LIFECYCLE GRAPH + GATES
  ↓
ACTIONABLE REPORT  HTML · ROI backlog · PR summary · JSON
```

## Key boundaries

- **Network policy** (`policy/network.ts`): every egress point calls `currentLedger().check(url, purpose)` before sending anything.
- **Integration** (`integrations/sdk.ts`): `detect() · doctor() · run()? · normalize()`; tools never inherit Buyer Arena's credentials.

- **BuyerPolicy** (`simulator/policy.ts`) decides the next action from an observation and memory. The heuristic buyer and the LLM buyer both implement it.
- **ChatProvider** (`providers/types.ts`) is one method, `complete()`, plus pricing and a `paid` flag. It is always called through `meteredComplete`, which applies the offline guard, the budget guard, retries and metering.
- **Execution engine.** The built-in engine is Playwright (`simulator/journey.ts`). Any other engine plugs in through `engines/external.ts`.
- **Auditor.** `audit(packet) → findings`. An LLM auditor wraps a rule-based auditor, which is also its fallback.
