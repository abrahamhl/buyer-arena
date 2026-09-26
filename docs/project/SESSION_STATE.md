# Session state — RC sprint (compact, for resumption)

Branch `claude/gallant-dirac-vqac02` · draft PR abrahamhl/buyer-arena#9 · base `e6e0524`.
Local test runs need `BUYER_ARENA_CHROMIUM_PATH=/opt/pw-browsers/chromium` (container ships
Chromium 1194; Playwright 1.63 wants 1243).

## Done (committed)

| Phase                                                              | Files                                                          | Tests                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Network policy + ledger, Chromium launcher                         | `src/policy/network.ts`, `src/core/browser.ts`                 | `tests/unit/network.test.ts`, journeys OFFLINE tests                          |
| Commercial Readiness rename + migration                            | `src/panels/commercial.ts`, `migrateLaunchReport`              | `tests/unit/evidence.test.ts`                                                 |
| Evidence Protocol v1 + store + builtin converters                  | `src/evidence/*`                                               | evidence tests                                                                |
| Integration SDK + 14 integrations                                  | `src/integrations/**`                                          | `tests/unit/integrations.test.ts` (fixtures in `tests/fixtures/integrations`) |
| Catalog / router / cache / OpenRouter / OpenCode / doctor --models | `src/models/*`, `src/providers/{openrouter,opencode}.ts`       | `tests/unit/models.test.ts`                                                   |
| Calibration metrics + state                                        | `src/calibration/metrics.ts`                                   | evidence tests                                                                |
| Agent eval + lifecycle + gates + CLI                               | `src/agent/*`, `src/lifecycle/graph.ts`, `src/cli/commands.ts` | `tests/integration/agent-eval.test.ts`                                        |

Suite: 159 tests green; lint, format, secret scan clean.

## Done in phase 3–4

Routing/cache/economy wired into runs · Browser Use sidecar (verified end to end with the
scripted model) + Stagehand reference · reusable PR workflow + comment example + `pr-summary` ·
`audit-repo` (static) · `ensemble` (experimental) · README, OFFLINE, MODELS, AGENT_EVAL,
EVIDENCE_PROTOCOL, INTEGRATIONS (license matrix), ARCHITECTURE, METHODOLOGY, CHANGELOG ·
version 0.2.0-rc.1 (not published). Suite: 164 passed, 1 opt-in skipped.

## Status

RC complete. Site redesign committed; site build on abrahamhl/buyer-arena-site#1 (draft, not merged). Self-audits in `docs/project/self-audit/`. Final summary: `RC_FINAL_REPORT.md`. Suite 166 passed + 1 opt-in.

## Pricing and funding (2026-09-26)

Proposed pricing in `docs/PRICING.md`, mirrored in `site/pricing.mjs` (with a QA drift check),
README and `LICENSE_STRATEGY.md`. A conditional funding plan is in `docs/project/FUNDING_PLAN.md`.
Nothing is on sale and nothing has been sent. The owner has to approve the prices; blockers are the
entity, payments and hosted infrastructure.

## Decisions

- Default network policy is LOCAL, non-strict: escalates only for targets named on the
  command line, printed and recorded. Any explicit choice (flag/env/config) is strict.
- npm audit is not "explicit": it runs only when the policy already allows the registry.
- Dynamic model routes are never auto-selected; only pinned, and labelled.
