# Changelog

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
