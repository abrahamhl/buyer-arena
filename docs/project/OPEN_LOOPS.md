# Open loops

- **The live LLM path is not verified.** `ANTHROPIC_API_KEY` in the build environment returned `401 invalid x-api-key`: it is not a valid Messages API key. The adapter handled that correctly (no retry, key not leaked, run marked `error`, $0 spent). No local LM Studio or Ollama server was running. The HTTP adapters are verified against local fake endpoints (`tests/unit/adapters.test.ts`).
- **CI has not run on GitHub**, because no remote is configured. It was validated only by running the same commands locally (Windows, Node 22).
- **Repository URL placeholders** (`<org>`) remain in README, the PR-preview example and `.github/ISSUE_TEMPLATE/config.yml`. `package.json` has no `repository` field.
- **Browser Use and Browser Harness sidecars** are not bundled (they need Python and their own LLM key). The contract is implemented and tested.
- **Promptfoo and DeepEval** integrations are documented as planned, not implemented.
- **No sensitivity sweep yet** over the heuristic buyer's parameters (price threshold, scroll budget, pop-up tolerance). The red team discloses the dependency instead.
- The heuristic buyer's keywords are English only.
