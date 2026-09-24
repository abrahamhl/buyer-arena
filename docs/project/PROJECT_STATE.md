# Project state — 2026-09-24

**The MVP runs.** `npm install && npm run demo` performs 40 real Chromium journeys (20 buyers × 2
variants) in 15–30 s and writes the report and the ROI backlog. No paid API is called.

| Area                                                    | State                                                                                                                                         |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Personas, stories, brief leak guard                     | Done, tested                                                                                                                                  |
| Playwright engine, evidence and traces                  | Done, tested. The same-origin guard covers redirects and pop-ups. Every step has a hard deadline                                              |
| Heuristic buyer (deterministic)                         | Done. Demo: baseline 40% → candidate 75% (8 buyers gained, 1 lost)                                                                            |
| LLM buyer and providers                                 | Done. HTTP adapters verified against local fake endpoints. **No live model call has succeeded** (see OPEN_LOOPS)                              |
| External engine adapter (Browser Use / Browser Harness) | Contract implemented and tested with a Node stand-in                                                                                          |
| Metrics, friction, comparison, statistics               | Done. Friction is linked to the journey's exit; discordant pairs are reported; comparisons are free of survivorship bias                      |
| 5 auditors and consensus                                | Done. Independent sources (detector, LLM, counterfactual); the red team discloses findings driven by buyer parameters                         |
| ROI backlog                                             | Score in confidence-weighted pp recoverable per unit of effort, with an "if fixed" ceiling                                                    |
| HTML report and terminal summary                        | Done                                                                                                                                          |
| CLI (14 commands) and MCP (8 tools)                     | Done, smoke-tested                                                                                                                            |
| Budget, resume, concurrency, provider failure           | Done, tested. Budget is reserved for in-flight calls; prior spend counts on resume; a fingerprint check prevents mixing incompatible sessions |
| CI, secret scan, docs, license                          | Done. CI has not run on GitHub yet because there is no remote                                                                                 |
