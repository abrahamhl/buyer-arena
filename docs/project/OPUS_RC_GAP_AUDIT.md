# RC gap audit — initial (2026-09-25)

Baseline: `main` = `e6e0524` (identical to the remote SHA the reviewer knew). Working tree was
**clean**: there was no uncommitted local work to preserve. Site source lives in
`buyer-arena/site/` (built by `scripts/build-site.mjs`); `abrahamhl/buyer-arena-site` holds only
the generated static output.

Baseline checks on this container: `typecheck` ✓ · `vitest` 66 ✓ / 11 ✗. All 11 failures are
environmental: Playwright 1.63 expects Chromium build 1243, the container ships build 1194 at
`/opt/pw-browsers`. There is no code path to point Buyer Arena at an existing Chromium, which also
blocks air-gapped machines → fixed by a single `launchChromium()` honouring
`BUYER_ARENA_CHROMIUM_PATH`.

## Already implemented (preserve)

| Area                                                                                   | Evidence                                              |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Deterministic heuristic buyer, seeded personas, allow-listed brief + leak guard        | `src/simulator/heuristic.ts`, `src/stories/story.ts`  |
| Real Playwright journeys, same-origin guard incl. redirects, traces, screenshots       | `src/simulator/journey.ts`                            |
| Paired comparison, friction diff, intervals                                            | `src/comparison/compare.ts`, `src/metrics/*`          |
| 5 auditors + consensus with evidence ids; ROI backlog with visible formula             | `src/auditors/*`, `src/roi/roi.ts`                    |
| Providers: Anthropic, OpenAI, OpenAI-compatible, LM Studio, Ollama; `createProvider()` | `src/providers/index.ts`                              |
| Budget reservation, resume-safe spend, retries, metering                               | `src/providers/metered.ts`                            |
| External engine stdin/stdout contract (Browser Use / Harness) + Node stand-in test     | `src/engines/external.ts`                             |
| Aggregate-only calibration: per-stage MAE + correction factor                          | `src/calibration/calibration.ts`                      |
| Launch check (5 panels), studio, exports, MCP (8 tools), CLI (14 cmds)                 | `src/launch.ts`, `src/panels/*`                       |
| i18n ES/EN/NL for report + site                                                        | `src/i18n/*`, `site/content.mjs`                      |
| CI (pinned actions, read-only token, offline env), secret scan script                  | `.github/workflows/ci.yml`, `scripts/secret-scan.mjs` |

## Partially implemented

| Area             | Gap                                                                                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline mode     | `BUYER_ARENA_OFFLINE=1` only blocks `provider.paid`. Public URLs, `openai-compatible` to a remote host flagged local, repo panel, exports are not governed. No record of hosts contacted / data sent. |
| Local models     | Work, but "local" is a regex on the base URL; no reachability probe, no `doctor --models`.                                                                                                            |
| Pricing          | Regex table; no catalog, no timestamp, no overrides file.                                                                                                                                             |
| Calibration      | MAE + correction only; no RMSE/Brier/ECE/FPR/FNR, no calibration _state_.                                                                                                                             |
| External engines | Contract exists; no working Browser Use sidecar; no Stagehand.                                                                                                                                        |
| PR experience    | `examples/github-actions/pr-preview.yml` only; no reusable workflow, no compact delta comment.                                                                                                        |
| Integrations doc | Promptfoo/DeepEval "planned"; no SDK.                                                                                                                                                                 |

## Missing (P0 of this RC)

Global network policy + ledger · EvidenceEnvelopeV1 · Integration SDK + `integrations list` ·
Promptfoo / garak / Gitleaks / Trivy bridges · Nuclei import-only · Models.dev optional catalog ·
OpenRouter provider · OpenCode adapter · model router (profiles, pinning, routing policies,
cascade) · exact response cache · cost/economy report · AgentRunEnvelope + `agent-eval` ·
lifecycle graph + release gates · Commercial Readiness rename · static URL audit
(no code execution) · site redesign + pre-launch state.

## Contradictions

1. Site and README say "open source · clone the repository" while the repository is **private**.
2. Site leads with the self-generated **95/100** self-audit as proof.
3. "Investors" panel name implies investment prediction.
4. README says `BUYER_ARENA_OFFLINE` makes runs offline; it only refuses paid providers.
5. `docs/ARCHITECTURE.md` says Node 20; `package.json` requires ≥22.12.
6. `openai-compatible` is treated as free/local by URL regex only (`localhost|127.0.0.1`), so `::1`, `0.0.0.0`, LAN hosts are "paid" and a host such as `localhost.evil.com` would be "local".

## Technical debt

- `cli/main.ts` (857 lines) and i18n files (1–1.1k lines) are large; acceptable, not refactored this RC.
- Three independent `chromium.launch()` call sites.
- `redact()` lives in `providers/http.ts`, but secret redaction is now a cross-cutting need (adapters).

## Release blockers (must be closed before public launch — owner: human audit)

- Repository visibility + npm publish (explicitly out of scope; do not do).
- No live LLM run verified (no valid key in any session so far).
- External validation: no independent case study, no real-world calibration dataset.
- CI has never run on GitHub-hosted runners for these changes (to verify on the PR).
