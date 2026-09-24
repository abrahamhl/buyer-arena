# Project state — 2026-09-24

**MVP runnable.** `npm install && npm run demo` → 40 real Chromium journeys (20 buyers × 2 variants) in ~15 s,
report + ROI backlog, zero paid APIs.

| Area                                                                      | State                                                                                         |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Personas / stories / brief leak guard                                     | done, tested                                                                                  |
| Playwright engine, evidence, traces, same-origin guard                    | done, tested                                                                                  |
| Heuristic buyer (deterministic)                                           | done; demo baseline 40% → candidate 75%                                                       |
| LLM buyer + providers (Anthropic, OpenAI-compat, LM Studio, Ollama, mock) | done; HTTP adapters verified against local fakes; **no live call succeeded** (see OPEN_LOOPS) |
| External engine adapter (Browser Use / Harness)                           | contract implemented + tested with a Node stand-in                                            |
| Metrics, friction, comparison, stats                                      | done, tested                                                                                  |
| 5 auditors + consensus (+ LLM auditor w/ fallback)                        | done, tested                                                                                  |
| ROI backlog, HTML report, terminal summary                                | done                                                                                          |
| CLI (14 commands), MCP (8 tools)                                          | done, smoke-tested                                                                            |
| Budget / resume / concurrency / provider failure                          | done, tested                                                                                  |
| CI, secret scan, docs, license                                            | done (CI not yet run on GitHub — no remote)                                                   |
