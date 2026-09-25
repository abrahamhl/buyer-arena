# Open loops (RC 0.2.0-rc.1, 2026-09-25)

- **No live cloud-LLM run verified.** Provider adapters (Anthropic, OpenAI, OpenRouter,
  OpenAI-compatible) are tested against local fake endpoints only; no valid key was available.
- **No external validation.** No independent case study, no real-user data, no real aggregate
  calibration dataset. Every result is UNCALIBRATED by construction.
- **Repository is private; nothing is on npm.** Launch = human audit first.
- **Stagehand sidecar not executed end to end** (needs a model key; `localBrowser.launch()` failed
  against the container's Chromium 141 with "Method not available").
- **Browser Use sidecar verified with the scripted model only**; a real LLM-driven Browser Use run
  was not performed.
- **Binary verification:** Gitleaks 8.30.1 and Trivy 0.74.0 were verified against their release
  checksum files, not against cosign signatures.
- **OpenRouter unverified details:** whether `usage.cost` is always present; the adapter records
  the served model and tokens, and prices come from the catalog/overrides.
- **Sidecars are not sandboxed**; `agent-eval` build/test execute repository code (documented).
- Heuristic buyer keywords are English only; no sensitivity sweep over its parameters yet.
- Windows: CI matrix covers it; `agent-eval` worktree paths and `opencode` spawning were not
  exercised on Windows in this session.
