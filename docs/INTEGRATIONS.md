# Integrations

External tools produce observations; Buyer Arena normalises them into
[Evidence Protocol v1](EVIDENCE_PROTOCOL.md). **None is a dependency**: tools are detected on
PATH, talked to over a process boundary, or read from their own output files. Listed for
interoperability; no partnership or endorsement is implied. Upstream contracts, with sources:
[research/UPSTREAM_CONTRACTS.md](research/UPSTREAM_CONTRACTS.md) (researched 2026-09-25).

```bash
buyer-arena integrations list        # AVAILABLE · INSTALLED · OFFLINE SAFE · MODE · RISK · VERSION · CAPABILITIES (no network)
buyer-arena integrations info trivy  # manifest, license, detection, doctor checks
buyer-arena integrations import <id> <file>
buyer-arena integrations run gitleaks|trivy|nuclei …
```

## Matrix

Status: **built in** ships with Buyer Arena · **supported** tested adapter with fixtures ·
**adapter** import contract with fixtures · **experimental** guarded or partial · **planned**.

| Integration                                             | Status             | Method                                                               | Offline safe       | Risk   | License                     | Upstream                                             |
| ------------------------------------------------------- | ------------------ | -------------------------------------------------------------------- | ------------------ | ------ | --------------------------- | ---------------------------------------------------- |
| Playwright                                              | built in           | npm dependency, default engine                                       | yes                | low    | Apache-2.0                  | github.com/microsoft/playwright                      |
| Anthropic, OpenAI, OpenAI-compatible, LM Studio, Ollama | built in           | HTTP providers                                                       | local ones: yes    | —      | (APIs)                      | —                                                    |
| OpenRouter                                              | supported          | OpenAI-compatible HTTP provider                                      | no                 | —      | hosted API (SDK Apache-2.0) | openrouter.ai                                        |
| OpenCode                                                | adapter            | `opencode run --format json` (≥ 1.18.22)                             | local models only  | medium | MIT                         | github.com/anomalyco/opencode                        |
| Models.dev                                              | supported          | optional cached catalog snapshot                                     | cache: yes         | none   | MIT                         | github.com/sst/models.dev                            |
| Promptfoo                                               | supported          | import `promptfoo eval -o results.json`                              | yes                | none   | MIT                         | github.com/promptfoo/promptfoo                       |
| garak                                                   | supported          | import `<prefix>.report.jsonl`                                       | yes                | none   | Apache-2.0                  | github.com/NVIDIA/garak                              |
| Gitleaks                                                | supported          | run (`dir`, `--redact`) or import JSON                               | yes                | low    | MIT                         | github.com/gitleaks/gitleaks                         |
| Trivy                                                   | supported          | run (`fs`, offline flags, cached DB) or import JSON                  | yes (cached DB)    | low    | Apache-2.0                  | github.com/aquasecurity/trivy                        |
| Nuclei                                                  | experimental       | import `-jsonl`; guarded opt-in run                                  | yes (import)       | high   | MIT                         | github.com/projectdiscovery/nuclei                   |
| Browser Use                                             | adapter            | reference sidecar (stdin/stdout contract)                            | with a local model | medium | MIT                         | github.com/browser-use/browser-use                   |
| Stagehand                                               | experimental       | reference sidecar (v4 API)                                           | no                 | medium | MIT                         | github.com/browserbase/stagehand                     |
| DeepEval                                                | adapter            | import TestRun JSON                                                  | yes                | none   | Apache-2.0                  | github.com/confident-ai/deepeval                     |
| Inspect AI                                              | adapter            | import EvalLog JSON (`inspect log dump`)                             | yes                | none   | MIT                         | github.com/UKGovernmentBEIS/inspect_ai               |
| lm-evaluation-harness                                   | adapter            | import `results_*.json`                                              | yes                | none   | MIT                         | github.com/EleutherAI/lm-evaluation-harness          |
| PyRIT                                                   | experimental       | import AttackResult JSONL (Buyer Arena contract; no upstream export) | yes                | none   | MIT                         | github.com/microsoft/PyRIT                           |
| OpenTelemetry GenAI                                     | adapter            | import OTLP/JSON (`gen_ai.*`, OpenInference `llm.*`)                 | yes                | none   | Apache-2.0 (conventions)    | github.com/open-telemetry/semantic-conventions-genai |
| Langfuse                                                | adapter (via OTel) | portable traces; no coupling to internals                            | yes                | none   | MIT core; `ee/` commercial  | github.com/langfuse/langfuse                         |
| Arize Phoenix                                           | adapter (via OTel) | portable traces; no coupling to internals                            | yes                | none   | **Elastic-2.0 (not OSI)**   | github.com/Arize-ai/phoenix                          |
| MCP clients                                             | built in           | `buyer-arena mcp` (stdio)                                            | yes                | low    | MIT (SDK)                   | —                                                    |

No third-party source is vendored. An API, file-format or protocol integration copies no code.

## Security notes per tool

- **Gitleaks / Trivy secrets:** secret values, matches, code snippets, commit author and email are
  dropped; only rule, location and a fingerprint remain.
- **Trivy:** v0.69.4–0.69.6 were malicious builds (CVE-2026-33634) and are refused; pin an exact
  version. Under `offline`/`local` it runs with `--skip-db-update --offline-scan …`; it downloads
  its DB only when the policy already allows public hosts.
- **Nuclei:** import-only by default. `integrations run nuclei` requires `--allow-active-scan`,
  `--i-own-this-target`, a local reviewed `--templates` directory, nuclei ≥ 3.10.0, and a
  loopback/private target or one listed in `BUYER_ARENA_NUCLEI_TARGETS`. Always `-dut -duc -ni
-omit-raw`; never `-code -dast -lfa -env-vars -headless -file`; `-lna` for non-local targets;
  credentials removed from its environment. Buyer Arena is not an internet scanner.
- **Promptfoo / garak output** can contain prompts, model outputs and config: treat the files as
  sensitive; Buyer Arena copies only ids, pass/fail, scores, tokens and cost.
- **OpenCode:** see [MODELS.md](MODELS.md).

## Writing an integration

Implement `Integration` from [`src/integrations/sdk.ts`](../src/integrations/sdk.ts): a
`manifest` (id, version, status, modes, capabilities, offline_safe, network_required,
execution_risk, upstream url/license/method), `detect()` (PATH lookup, no shell, no network),
optional `doctor()` and `run()` (argv only, `scrubbedEnv()`, network policy checks), and
`normalize(text, ctx)` → envelopes via `adapterEvidence()`. Add a fixture shaped exactly like
the upstream output under `tests/fixtures/integrations/` and cite its origin. Register it in
`src/integrations/registry.ts`.

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

**Reference sidecars:** [`examples/sidecars/browser_use_sidecar.py`](../examples/sidecars/browser_use_sidecar.py)
(working; verified with browser-use 0.13.10 + Chromium 141 through `runSession`, see
`tests/integration/browser-use-sidecar.test.ts`) and
[`examples/sidecars/stagehand-sidecar.mjs`](../examples/sidecars/stagehand-sidecar.mjs)
(experimental; Stagehand v4 API, not executed end to end). Under network policy `offline` a
sidecar only starts with `BUYER_ARENA_ENGINE_OFFLINE_SAFE=1`.

## Licensing of integrations

Runtime dependencies: Playwright (Apache-2.0), @modelcontextprotocol/sdk (MIT), zod (MIT),
yaml (ISC), commander (MIT). Every integration above is optional and external. Re-check the
license before vendoring any third-party code; treat source-available or non-OSI projects
(Phoenix ELv2, Langfuse `ee/`) as "integrate over portable protocols only".
