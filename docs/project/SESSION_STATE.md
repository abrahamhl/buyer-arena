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

## Remaining (P0 first)

1. Wire `--routing` / `--buyer auto` / cache into run/compare/audit + economy block in report.
2. Browser Use reference sidecar (Python) + Stagehand v4 reference sidecar.
3. Reusable GitHub workflow + compact PR comment.
4. Static URL audit (`audit-repo github.com/o/r`), NO CODE EXECUTED.
5. Ensemble disagreement (experimental).
6. Docs: README, INTEGRATIONS (license table), ARCHITECTURE, METHODOLOGY, OFFLINE.
7. Site: pre-launch state, self-audit label, commercial rename, redesign, a11y.
8. Dogfood (self-audit both repos) + `RC_FINAL_REPORT.md`.

## Decisions

- Default network policy is LOCAL, non-strict: escalates only for targets named on the
  command line, printed and recorded. Any explicit choice (flag/env/config) is strict.
- npm audit is not "explicit": it runs only when the policy already allows the registry.
- Dynamic model routes are never auto-selected; only pinned, and labelled.
