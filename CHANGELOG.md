# Changelog

## 0.2.0-rc.1 — 2026-09-25 (release candidate, not published)

### Added

- Prices approved by the project owner (2026-09-26); still nothing on sale. The site shows a price
  line next to the main button. The site self-audit rose from 96 to 98 (end users 88 → 100, the
  "price is findable" check); it is still a self-audit.
- Launch pack in `docs/launch/`: a checklist split into owner-only and prepared steps, a Launch Audit
  sales kit (ES/EN/NL outreach, delivery template) and an NLnet CodeSupply proposal draft. Nothing
  has been sent.
- **Proposed pricing, licences and ROI** (nothing on sale): `docs/PRICING.md` is the single source
  of truth, with Community €0 (Apache-2.0), Cloud Starter €29, Cloud Team €249, Enterprise from
  €2,500, and fixed-fee services from €1,900. It is mirrored in the README, in `LICENSE_STRATEGY.md`
  (licence per plan) and in a site section with an ROI calculator (ES/EN/NL). `site/qa.mjs` fails
  if a site price is missing from the doc, if the section is not labelled "not on sale", or if it
  carries a purchase or contact link.
- Research: `docs/research/PRICING_BENCHMARK.md` (market anchors, tagged verified/provisional) and
  `docs/research/FUNDING_CHANNELS.md`. `docs/project/FUNDING_PLAN.md` is a funding plan conditional
  on passing the pre-launch audit; nothing has been submitted.
- Global network policy `offline | local | hybrid | online` with a per-command ledger (hosts
  contacted, providers that received data, adapters, denials) stored in every artifact.
- Evidence Protocol v1 (`EvidenceEnvelopeV1`, `evidence.jsonl`) for built-in results and
  integrations; secret values never stored.
- Integration SDK and bridges: Promptfoo, garak, Gitleaks, Trivy, Nuclei (import-only by default),
  DeepEval, Inspect AI, lm-evaluation-harness, PyRIT (contract), OpenTelemetry GenAI traces;
  working Browser Use reference sidecar; Stagehand v4 reference sidecar (experimental).
- Model catalog (built-in + optional Models.dev snapshot + overrides), cost-aware router with
  explicit pinning, OpenRouter and OpenCode providers, exact response cache, token-economy report,
  `doctor --models`.
- `agent-eval` / `agent-compare` with AgentRunEnvelope, lifecycle graph and release gates; `gate`.
- Calibration metrics (RMSE, aggregate Brier, ECE, FPR/FNR, direction) and calibration states.
- Reusable PR workflow, fork-safe comment example, `pr-summary`.
- `audit-repo` static audit of GitHub URLs (no code executed); `ensemble` (experimental).
- `BUYER_ARENA_CHROMIUM_PATH` for air-gapped machines.

### Changed

- Launch-check panel **Investors → Commercial Readiness** (investor lens inside). Old mix keys,
  export scopes and launch reports are migrated.
- npm audit in the red-team panel runs only when the policy already allows the registry.

## 0.1.0 — 2026-09-24 (MVP)

### Added

- Seeded synthetic populations: 5 templates (saas, ecommerce, developer-tool, local-service, subscription-app) × 5 archetypes. Load and save as YAML or JSON. Calibration weights are optional.
- Customer stories in structured and narrative form. The buyer brief is built from an allow-list and leak-checked before each journey.
- Playwright journey engine: same-origin guard, per-step screenshots, Playwright traces for failed journeys, typed event log with stable evidence ids.
- Deterministic heuristic buyer. LLM buyers for Anthropic, OpenAI, OpenAI-compatible endpoints, LM Studio and Ollama, falling back to the deterministic buyer on malformed output.
- Adapter for external engines (Browser Use, Browser Harness) over a JSON stdin/stdout contract.
- Metrics, funnel, friction detectors (14), paired-bootstrap comparison and Wilson intervals.
- Five independent auditors (deterministic, or LLM with repair and fallback) and a consensus stage that separates observed fact, inference and hypothesis.
- Evidence-driven ROI backlog with a visible formula. Generates `ROI_BACKLOG.md`.
- Self-contained HTML report with a journey explorer and evidence links.
- CLI: `init`, `doctor`, `population`, `run`, `compare`, `resume`, `report`, `audit`, `replay`, `status`, `calibrate`, `demo`, `demo-store`, `mcp`.
- MCP server (stdio) with 8 tools.
- Budget, call, step, parallelism and timeout limits. Resumable sessions.
- Bundled demo SaaS "Tallybird" with baseline and candidate versions.

### Hardened after the independent review (same release)

**Safety**

- The same-origin guard now also covers redirects and pop-up windows.
- Every journey step has a hard deadline, so a hung page or slow model can no longer stall the session.

**Budget and resume**

- The worst-case cost of each call is reserved while it is in flight, so parallel buyers cannot race past the budget.
- Spend from earlier runs counts against the budget when a session is resumed.
- Sessions are fingerprinted, and a resume that would mix in a different task, population, target or buyer is refused.

**Robustness**

- Writes are durable (fsync) and retry when Windows briefly locks a file.
- Unreadable run records count as "not done" instead of crashing.
- An exception inside one journey becomes an error record for that journey instead of crashing the session.

**Methodology**

- A friction counts as blocking only when the journey ended at it.
- A pop-up counts as friction only when it actually got in the buyer's way.
- The rule-based auditors together count as one source. "Inference" now requires independent sources, for example the counterfactual on the other variant.
- The red team discloses every finding that depends on the buyer's own parameters.
- Observed facts come only from computed data, and evidence must belong to the same variant.
- The comparison reports discordant pairs and compares steps to goal only for buyers who completed on both versions.
- The ROI score is now confidence-weighted percentage points recoverable per unit of effort, with an "if fixed" ceiling.

**Developer experience**

- Requires Node 22.12 or newer.
- `prepare` now builds the CLI on install.
- `replay` suggests matching run ids, and the demo ends with a "Next" block.
- The exact Apache-2.0 license text is included, with a new TRADEMARKS.md and a PR-preview GitHub Action example.
