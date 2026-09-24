# Open loops

- **Live LLM call not verified.** `ANTHROPIC_API_KEY` in this environment returned `401 invalid x-api-key`
  (it is not a valid Messages API key). Adapter behaviour on that failure was correct (no retry, key not leaked,
  run marked `error`, $0 spent). No local LM Studio/Ollama server was running. HTTP adapters are verified
  against local fake endpoints (`tests/unit/adapters.test.ts`).
- **CI not executed on GitHub** — no remote configured. Workflow validated only by running the same commands locally (Windows, Node 22).
- **Repo URL placeholder** in `.github/ISSUE_TEMPLATE/config.yml` (`buyer-arena/buyer-arena`) — replace when the repo exists.
- **Browser Use / Browser Harness sidecars** not bundled (Python + own LLM key); contract implemented and tested.
- **Promptfoo / DeepEval** integrations documented as planned, not implemented.
- Heuristic buyer keywords are English-only.
