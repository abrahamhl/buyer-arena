# Integrations

None of these integrations is required. The demo and the test suite use only Playwright and the
deterministic buyers.

| Integration                              | Status                                       | How                                                                                            |
| ---------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Playwright                               | **Built in**                                 | Default execution engine: screenshots, traces, same-origin guard                               |
| Browser Use                              | **Adapter implemented; sidecar not bundled** | `--engine-cmd "python my_browser_use_sidecar.py"` using the contract below                     |
| Browser Harness                          | **Adapter implemented; sidecar not bundled** | Same contract                                                                                  |
| MCP clients (Claude Code, Cursor, Codex) | **Implemented**                              | `buyer-arena mcp` (stdio)                                                                      |
| Promptfoo                                | **Planned**                                  | Use `analysis.json` or `run.json` as test fixtures; a native provider plugin is on the roadmap |
| DeepEval                                 | **Planned**                                  | Consensus findings map to test cases (`observed_fact` = expected, `evidence_ids` = context)    |

## External engine contract (`src/engines/external.ts`)

Buyer Arena starts the command once per journey. It writes the request to **stdin** and reads a
single JSON result from **stdout**. The process must exit with code 0.

```jsonc
// stdin
{ "brief": { "persona": { /* allow-listed attributes */ }, "story": "…", "task": "…", "start_url": "http://…" },
  "task": { "success": { "text_pattern": "…", "url_pattern": "…" } },
  "max_steps": 14, "timeout_ms": 60000 }

// stdout
{ "status": "completed | abandoned | step_limit | timeout | error",
  "final_url": "http://…",
  "abandon_reason": "optional",
  "objection": "optional-slug",
  "events": [ { "type": "navigate|decision|click|fill|form_error|milestone|abandon|…", "url": "…", "step": 1, "t": 1200, "target": "…", "detail": "…" } ] }
```

Buyer Arena assigns event ids, milestones and metrics, so the evidence looks the same whichever
engine produced it. Invalid output becomes an `error` run with the validation message; it does not
crash the session. The adapter is covered by `tests/integration/journeys.test.ts`, which uses a
Node stand-in engine.

**Browser Use sidecar outline** (not bundled or tested here, because Browser Use needs Python and
its own LLM key): read stdin, create an `Agent(task=brief["story"] + "\n" + brief["task"], …)`
restricted to the `start_url` origin, and map its history to events. Keep secrets in that
process's own environment.

## Licensing of integrations

No third-party integration code is vendored. Runtime dependencies and their licenses are:
Playwright (Apache-2.0), @modelcontextprotocol/sdk (MIT), zod (MIT), yaml (ISC) and commander
(MIT). Re-check the license before vendoring any Browser Use, Browser Harness, Promptfoo or
DeepEval code.
