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
