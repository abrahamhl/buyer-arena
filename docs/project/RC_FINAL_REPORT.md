# Release candidate report — Buyer Arena 0.2.0-rc.1

Date 2026-09-25 · branch `claude/gallant-dirac-vqac02` · draft PRs abrahamhl/buyer-arena#9 and
abrahamhl/buyer-arena-site#1 · base `e6e0524`. **Not launched:** repository still private, nothing
on npm, site `main` untouched.

## Verdict

**GO for the final human audit. NO-GO for public launch until the blockers below are closed.**
This is not a 10/10: the engineering is test-backed, but the product has **no external
validation** yet (no independent users, no real calibration data, no live LLM run).

## Core — what changed

| Area                 | Result                                                                                                                                                                  | Evidence                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Network policy       | `offline · local · hybrid · online`, DNS-free host classes, strict when chosen, escalation only for named targets; ledger in `session.json`, launch reports, agent-eval | `src/policy/network.ts`, `tests/unit/network.test.ts`, OFFLINE tests in `tests/integration/journeys.test.ts` |
| Evidence Protocol v1 | versioned, append-only, content-addressed envelopes; secrets never stored                                                                                               | `src/evidence/*`, `docs/EVIDENCE_PROTOCOL.md`, `tests/unit/evidence.test.ts`                                 |
| Integration SDK      | 14 integrations, PATH detection without a shell, scrubbed env, size-capped imports                                                                                      | `src/integrations/**`, `tests/unit/integrations.test.ts`                                                     |
| Models               | catalog (built-in + optional Models.dev + overrides), router (pinning, policies, cascade), OpenRouter, OpenCode, exact cache, economy report, `doctor --models`         | `src/models/*`, `tests/unit/models.test.ts`                                                                  |
| Calibration          | MAE, RMSE, aggregate Brier, ECE, curve, FPR/FNR, direction; UNCALIBRATED / PARTIALLY / CALIBRATED                                                                       | `src/calibration/metrics.ts`, `docs/METHODOLOGY.md §5.1`                                                     |
| Agent eval           | worktrees, before/after build+test with credentials stripped, skipped/deleted tests, secrets, gates; self-reports never scored                                          | `src/agent/*`, `tests/integration/agent-eval.test.ts` (real git repo, 3 agents)                              |
| Lifecycle + gates    | SPEC→RELEASE, no averaging, gates fail closed, `gate` exits 1                                                                                                           | `src/lifecycle/graph.ts`                                                                                     |
| PR experience        | reusable read-only workflow, fork-safe `workflow_run` comment (action SHAs verified), compact `pr-summary`                                                              | `.github/workflows/buyer-arena-pr.yml`, `examples/github-actions/`                                           |
| Static URL audit     | bounded download, traversal/redirect guards, **NO CODE EXECUTED**                                                                                                       | `src/audit/static-repo.ts`, `tests/integration/static-audit.test.ts`                                         |
| Ensemble             | experimental; four uncertainty sources kept separate                                                                                                                    | `src/ensemble/disagreement.ts`                                                                               |
| Rename               | Investors → Commercial Readiness, old artifacts migrated                                                                                                                | `migrateLaunchReport`, `migratePanelId`                                                                      |

**Tests:** 166 passed, 1 opt-in skipped (Browser Use; passes with `BA_TEST_BROWSER_USE_PYTHON`).
Typecheck, eslint, prettier and the secret scan are clean. CI (Ubuntu and Windows × Node 22 and 24)
is green on every non-WIP commit. The only red runs were two site WIP snapshots with unformatted
files; `e6fa0dd` fixed them.

## Integrations

| Built in                                                                 | Working and tested adapters                                                                                                                                         | Contract + fixtures                                             | Experimental / guarded                                                                                                                             | Planned                         |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Playwright, Anthropic, OpenAI, OpenAI-compatible, LM Studio, Ollama, MCP | Promptfoo, garak, Gitleaks, Trivy (both executed for real against this repo), OpenRouter (fake endpoint), Browser Use sidecar (real browser-use 0.13.10 + Chromium) | DeepEval, Inspect AI, lm-eval, OTel GenAI (→ Langfuse, Phoenix) | Nuclei (import-only by default), PyRIT (no upstream export), Stagehand v4 (not executed), OpenCode (fixture-tested parser; CLI not installed here) | hosted sandboxed repo execution |

Every contract is cited in `docs/research/UPSTREAM_CONTRACTS.md`, with its unverified items listed.

## Model support

- **Local:** LM Studio, Ollama, OpenAI-compatible on loopback or LAN (vLLM, llama.cpp, LocalAI).
- **Cloud:** Anthropic, OpenAI, OpenRouter.
- **Gateways:** OpenRouter (dynamic routes labelled and never auto-selected) and OpenCode ≥ 1.18.22.
- **Models.dev:** optional snapshot, timestamped and stale after 30 days. Live `api.json` was not
  reachable from this container, so the normaliser is tested on a fixture shaped from the upstream
  schema.

## Cost

- Tokens used by Buyer Arena's tests: **0 real tokens** (MockProvider and local fake endpoints only).
- External API cost: **$0**. No paid API was called.
- Every demo and self-audit reported `MODEL COST $0` and `nothing left this machine`, except the
  runs explicitly started with `--network online`: npm registry for audit and execution, and the
  Trivy DB from `mirror.gcr.io`.

## Security

- **Secret scan:** clean (215 files). Gitleaks 8.30.1 on the repo: 0 findings.
- **Dependencies:** `npm audit` found 0 vulnerabilities (prod and dev). Trivy 0.74.0 scanned 96
  packages and found 0 vulnerabilities, 0 secrets and 0 misconfigurations. Both binaries were
  verified against their release checksums, but not against cosign signatures.
- **Package:** `npm pack --dry-run` gives 316 files, 492.5 kB. Not published.
- **Integration risks (documented):**
  - Sidecars and `agent-eval` build/test run outside any sandbox.
  - Nuclei is high-risk and gated behind import-only plus explicit opt-ins.
  - Trivy's compromised builds 0.69.4–0.69.6 are refused.
  - OpenCode's CSRF advisory sets the minimum version.
- **Review fixes made during the RC:**
  - A redirect from the start URL could escalate to a public host.
  - A local `openai-compatible` model was refused under OFFLINE.
  - The static audit followed redirects to other hosts.
  - Two red-team scanner false positives.
  - The offline demo setup failed without internet.

## Validation

| Target                                         | Score                                                                             | Label                                                                                                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| buyer-arena (launch-check, `--demo --execute`) | **84/100**: users 82 · developers 100 · commercial 83 · security 95 · segments 60 | SELF-AUDIT — NOT EXTERNAL VALIDATION. Web panels measure the fictional demo store; commercial reflects zero adoption                      |
| buyer-arena-site (prelaunch build, offline)    | **98/100**: users 100 · security 100 · segments 95                                | SELF-AUDIT, 2026-09-26. Was 96 with "price is findable" at 0; pricing in the navigation and a price line next to the main button fixed it |

The first core run scored 72 (security 35). The gap was investigated, and the causes, not the
scores, were fixed (see above). Reports: `docs/project/self-audit/`.

**External validation still missing:** independent case studies, real users, a live LLM run, an
agent benchmark with raw evidence, and real aggregate calibration data.

## Site

- Stays on the dependency-free static generator. A React/Vite migration was rejected because it
  brings no user benefit.
- Build-time `SITE_LAUNCH_STATE`: `prelaunch` by default, `public` at launch.
- Three interaction moments: an explanatory hero, the 7-step flow, and the network-policy boundary.
- Integration wall and limitations section; a real demo report as primary proof.
- Accessibility: axe 0 violations (en/es/nl, light/dark, 1440/320); contrast ≥ 5.2:1; reduced motion
  shows final frames.
- 104.5 KB HTML+CSS+JS uncompressed.
- Screenshots: `docs/project/site-screenshots/`.
- Not done: a manual screen-reader pass, and verifying the contrast of text inside the SVG.

## Blockers before public launch (human decisions)

1. Human and external review of both draft PRs; merge order is core first, then site.
2. One bounded live LLM run and a published heuristic-vs-LLM ensemble.
3. At least one external case study, or real aggregate calibration data.
4. Change repository visibility, publish to npm, rebuild the site with `SITE_LAUNCH_STATE=public`.
5. Approve or change the proposed prices (`docs/PRICING.md`). The funding plan (`docs/project/FUNDING_PLAN.md`) starts only after the audit passes.
6. Optional: cosign verification in the docs for Trivy/Gitleaks; a Windows run of `agent-eval`.
