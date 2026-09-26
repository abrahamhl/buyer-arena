# Open loops (RC 0.2.0-rc.1, 2026-09-26)

- **Live cloud-LLM run now verified.** `openai-compatible:deepseek-chat` drove real buyer journeys
  against the bundled demo store (12 buyers, $1.46, 86 calls); `ensemble` heuristic × LLM published
  (kappa 0.68). OpenRouter is configured but its account has **no credits** (HTTP 402), so
  `openrouter:*` still needs a funded key before it can be used in a live run.
- **No external validation.** No independent case study, no real-user data, no real aggregate
  calibration dataset. Every result is UNCALIBRATED by construction.
- **Repository is public; nothing is on npm.** Visibility is PUBLIC (default branch `main`).
  Launch still requires a human audit and an npm publish.
- **Stagehand sidecar not executed end to end** (needs a model key; `localBrowser.launch()` failed
  against the container's Chromium 141 with "Method not available").
- **Browser Use sidecar verified with the scripted model only**; a real LLM-driven Browser Use run
  was not performed.
- **Binary verification:** Gitleaks 8.30.1 and Trivy 0.74.0 were verified against their release
  checksum files, not against cosign signatures.
- **OpenRouter unverified details:** whether `usage.cost` is always present; the adapter records
  the served model and tokens, and prices come from the catalog/overrides.
- **Sidecars are not sandboxed.** `agent-eval` build/test can run in a throw-away Docker container
  (`--sandbox docker`, non-root, cap-drop ALL, registry-only install), but the Browser Use and
  Stagehand sidecars still execute repository code unsandboxed (documented).
- Heuristic buyer keywords are now multilingual (ES·EN·NL) and login/sign-up are disambiguated;
  there is still **no sensitivity sweep** over the buyer's tunable thresholds (scroll budget, step
  budget, click thresholds).
- Windows: CI matrix covers it; `agent-eval` worktree paths and `opencode` spawning were not
  exercised on Windows in this session.
