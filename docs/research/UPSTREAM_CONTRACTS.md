# Upstream Contracts: machine-readable outputs and CLI contracts

Research date: 2026-09-25

This file records the official output formats, CLI flags and data shapes of the upstream tools that buyer-arena adapters consume. Every claim links to the primary source that was read (raw source file, repo docs, OpenAPI spec, LICENSE file, package registry, or GitHub Security Advisory). Anything not confirmed from a primary source is marked **UNVERIFIED**.

How the sources were read:

- Source files and docs: `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>`, taken from the default branch on the research date. Line numbers drift, so treat them as "at time of reading".
- Versions: `npm view`, the PyPI JSON API (`https://pypi.org/pypi/<pkg>/json`), and the Go module proxy (`https://proxy.golang.org/<module>/@latest`).
- Security advisories: GitHub Security Advisory pages (`github.com/<owner>/<repo>/security/advisories/<GHSA>`), read through WebFetch.
- Blocked from this container, so not read directly: `openrouter.ai`, `langfuse.com`, `models.dev` and `api.github.com`. Where those matter, the equivalent source in the GitHub repo was used instead.

"Example" labels say where each example comes from:

- **(upstream fixture)**: copied from an upstream test fixture or docs file.
- **(derived)**: assembled field by field from the upstream type or struct definitions, with realistic values filled in.

---

## 0. Summary table

| Tool                  | Upstream (current)                                                                  | SPDX license (from LICENSE)                                                          | Latest version (2026-09-25)                                                  | Machine output                                                    | Status                                |
| --------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------- |
| Promptfoo             | github.com/promptfoo/promptfoo                                                      | MIT                                                                                  | npm `promptfoo` 0.123.1                                                      | `promptfoo eval -o results.json` (JSON `OutputFile`)              | VERIFIED (types)                      |
| garak                 | github.com/NVIDIA/garak                                                             | Apache-2.0                                                                           | PyPI `garak` 0.17.0 (main branch reports `0.17.1.pre1`)                      | `garak.<run_id>.report.jsonl`                                     | VERIFIED (source)                     |
| Gitleaks              | github.com/gitleaks/gitleaks (Go module `github.com/zricethezav/gitleaks/v8`)       | MIT                                                                                  | v8.30.1 (Go proxy, 2026-02-21)                                               | `--report-format json\|csv\|junit\|sarif\|template`               | VERIFIED (fixture)                    |
| Trivy                 | github.com/aquasecurity/trivy                                                       | Apache-2.0                                                                           | v0.74.0 (Go proxy, 2026-08-14)                                               | `--format json` (SchemaVersion 2)                                 | VERIFIED (source)                     |
| Nuclei                | github.com/projectdiscovery/nuclei                                                  | MIT (`LICENSE.md`)                                                                   | v3.11.1 (Go proxy, 2026-08-08)                                               | `-jsonl`, `-je`, `-jle`, `-se`                                    | VERIFIED (source)                     |
| Browser Use           | github.com/browser-use/browser-use                                                  | MIT                                                                                  | PyPI `browser-use` 0.13.10, Python `>=3.11,<4.0`                             | Python API `AgentHistoryList`                                     | VERIFIED (source)                     |
| Stagehand             | github.com/browserbase/stagehand                                                    | MIT                                                                                  | npm `@browserbasehq/stagehand` 4.1.0 (`v3-latest` = 3.7.3), Node `>=22.18.0` | TS API; **v4 removed `new Stagehand`, `init()` and `agent()`**    | VERIFIED (docs in repo)               |
| OpenCode              | github.com/anomalyco/opencode (`sst/opencode` redirects here; default branch `dev`) | MIT                                                                                  | npm `opencode-ai` 1.18.32                                                    | `opencode run --format json` (JSON lines)                         | VERIFIED (source)                     |
| OpenRouter            | OpenAPI spec in github.com/OpenRouterTeam/typescript-sdk                            | SDK Apache-2.0 (the API is a hosted service)                                         | `@openrouter/sdk` 1.3.28                                                     | REST `/api/v1/chat/completions`, `/api/v1/models`                 | VERIFIED (OpenAPI), partly UNVERIFIED |
| Models.dev            | github.com/sst/models.dev (default branch `dev`)                                    | MIT                                                                                  | n/a (data repo)                                                              | `https://models.dev/api.json`                                     | VERIFIED (schema and build script)    |
| DeepEval              | github.com/confident-ai/deepeval                                                    | Apache-2.0                                                                           | PyPI 4.2.6                                                                   | `.deepeval/.latest_run_full.json`, `test_run_*.json`              | VERIFIED (source)                     |
| Inspect AI            | github.com/UKGovernmentBEIS/inspect_ai                                              | MIT                                                                                  | PyPI `inspect-ai` 0.3.268                                                    | `.eval` (default) or `.json` `EvalLog`                            | VERIFIED (source)                     |
| lm-evaluation-harness | github.com/EleutherAI/lm-evaluation-harness                                         | MIT (`LICENSE.md`)                                                                   | PyPI `lm-eval` 0.4.13                                                        | `results_<date>.json`                                             | VERIFIED (source)                     |
| PyRIT                 | github.com/microsoft/PyRIT (moved from Azure/PyRIT)                                 | MIT                                                                                  | PyPI `pyrit` 1.1.0                                                           | SQLite memory (`pyrit.db`); JSON export UNVERIFIED                | Partly VERIFIED                       |
| Langfuse              | github.com/langfuse/langfuse                                                        | MIT core **plus a commercial EE license for `ee/`, `web/src/ee/`, `worker/src/ee/`** | PyPI `langfuse` SDK 4.15.6                                                   | OTLP HTTP `/api/public/otel/v1/traces`                            | VERIFIED (source)                     |
| Arize Phoenix         | github.com/Arize-ai/phoenix                                                         | **Elastic-2.0 (ELv2), not OSI-approved**                                             | PyPI `arize-phoenix` 20.16.0                                                 | OTLP HTTP `/v1/traces` (protobuf only) on port 6006; gRPC on 4317 | VERIFIED (source)                     |
| OpenInference spec    | github.com/Arize-ai/openinference                                                   | Apache-2.0                                                                           | n/a                                                                          | `llm.*` span attributes                                           | VERIFIED                              |
| OTel GenAI semconv    | github.com/open-telemetry/semantic-conventions-genai                                | Apache-2.0                                                                           | n/a (status: Development)                                                    | `gen_ai.*` span attributes                                        | VERIFIED                              |

LICENSE files read (raw.githubusercontent.com):

- `promptfoo/promptfoo/main/LICENSE`
- `NVIDIA/garak/main/LICENSE`
- `gitleaks/gitleaks/master/LICENSE`
- `aquasecurity/trivy/main/LICENSE`
- `projectdiscovery/nuclei/main/LICENSE.md`
- `browser-use/browser-use/main/LICENSE`
- `browserbase/stagehand/main/LICENSE`
- `anomalyco/opencode/master/LICENSE`
- `sst/models.dev/master/LICENSE`
- `confident-ai/deepeval/main/LICENSE.md`
- `UKGovernmentBEIS/inspect_ai/main/LICENSE`
- `EleutherAI/lm-evaluation-harness/main/LICENSE.md`
- `microsoft/PyRIT/main/LICENSE`
- `langfuse/langfuse/main/LICENSE` and `ee/LICENSE`
- `Arize-ai/phoenix/main/LICENSE`
- `OpenRouterTeam/typescript-sdk/main/LICENSE.md`
- `Arize-ai/openinference/main/LICENSE`
- `open-telemetry/semantic-conventions-genai/main/LICENSE`

---

## A. Promptfoo

**Upstream:** https://github.com/promptfoo/promptfoo

- License: MIT (LICENSE begins "Copyright (c) Promptfoo 2025 / Permission is hereby granted…"). The npm `license` field is also `MIT`.
- Latest version: npm `promptfoo` 0.123.1 (`npm view promptfoo version`).

### A.1 Invocation

```
promptfoo eval -c promptfooconfig.yaml -o results.json --no-table --no-progress-bar --no-share [--no-cache] [--no-write] [-j <n>]
```

Source: https://raw.githubusercontent.com/promptfoo/promptfoo/main/site/docs/usage/command-line.md

| Flag                             | Meaning (quoted from the docs table)                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `-c, --config <paths...>`        | "Path to configuration file(s)"                                                                        |
| `-o, --output <paths...>`        | "Path(s) to output file (csv, txt, json, jsonl, yaml, yml, html, xml, junit.xml)"                      |
| `--no-table`                     | "Do not output table in CLI"                                                                           |
| `--no-progress-bar`              | "Do not show progress bar"                                                                             |
| `--no-write`                     | "Do not write results to promptfoo directory"                                                          |
| `--no-cache`                     | "Do not read or write results to disk cache"                                                           |
| `--no-share`                     | "Do not create a shareable URL, this overrides the config file"                                        |
| `-j, --max-concurrency <number>` | "Maximum number of concurrent API calls"                                                               |
| `--filter-*`                     | `--filter-first-n`, `--filter-range`, `--filter-pattern`, `--filter-providers`, `--filter-metadata`, … |

- **Exit codes** (same docs, line ~169):
  - `100` when at least one test case fails, or when the pass rate is below `PROMPTFOO_PASS_RATE_THRESHOLD`.
  - `1` for any other error.
  - `PROMPTFOO_FAILED_TEST_EXIT_CODE` overrides the exit code for failed tests.
- `jsonl` output writes one `EvaluateResult`-like row per line. Source: `site/docs/configuration/outputs.md`.

### A.2 Output schema: `-o results.json`

The authoritative type is `OutputFile` in https://raw.githubusercontent.com/promptfoo/promptfoo/main/src/types/index.ts (comment above it: "File exported as --output option").

```ts
interface OutputFile {
  evalId: string | null;
  results: EvaluateSummaryV3 | EvaluateSummaryV2;
  config: Partial<UnifiedConfig>;
  shareableUrl: string | null;
  metadata?: OutputMetadata;   // { promptfooVersion, nodeVersion, platform, arch, exportedAt, evaluationCreatedAt?, author? }
  vars?: string[]; runtimeOptions?: ...; traces?: TraceData[]; blobAssets?: ExportedBlobAsset[];
}
interface EvaluateSummaryV3 { version: 3; timestamp: string; results: EvaluateResult[]; prompts: CompletedPrompt[]; stats: EvaluateStats; }
interface EvaluateStats { successes: number; failures: number; errors: number; tokenUsage: NormalizedTokenUsage; durationMs?; generationDurationMs?; evaluationDurationMs?; }
```

About the version fields:

- `results.version` is the format version: `3` for V3; V2 uses `version: number` plus a `table`.
- The promptfoo release version lives at `metadata.promptfooVersion`.

**Docs discrepancy:** the JSON example in `site/docs/configuration/outputs.md` shows `results: { prompts, providers, outputs, stats }`. That does **not** match the TypeScript type, which has `results.results[]`, `results.prompts[]` and `results.stats`. Adapters should follow the type and treat the docs example as illustrative only.

**`EvaluateResult`** (same file), one entry of `results.results[]`:

| Field                       | Type                       | Notes                                            |
| --------------------------- | -------------------------- | ------------------------------------------------ |
| `id?`                       | string                     | per-result id                                    |
| `promptIdx`, `testIdx`      | number                     |                                                  |
| `testCase`                  | `AtomicTestCase`           | includes `vars`, `assert`, `metadata`            |
| `promptId`                  | string                     |                                                  |
| `provider`                  | `{ id, label? }`           | `Pick<ProviderOptions,'id'\|'label'>`            |
| `prompt`                    | `Prompt`                   | (`raw`, `label`, …)                              |
| `vars`                      | `Record<string, VarValue>` |                                                  |
| `response?`                 | `ProviderResponse`         | see below                                        |
| `error?`                    | string \| null             |                                                  |
| `failureReason`             | 0 \| 1 \| 2                | `ResultFailureReason`: NONE=0, ASSERT=1, ERROR=2 |
| `success`                   | boolean                    | pass/fail                                        |
| `score`                     | number                     |                                                  |
| `latencyMs`                 | number                     |                                                  |
| `gradingResult?`            | `GradingResult \| null`    |                                                  |
| `namedScores`               | `Record<string, number>`   |                                                  |
| `cost?`, `incurredCost?`    | number                     |                                                  |
| `tokenUsage?`               | `NormalizedTokenUsage`     |                                                  |
| `metadata?`                 | `Record<string, any>`      |                                                  |
| `evaluationId?`, `traceId?` | string                     | only when tracing is enabled                     |

**`GradingResult`** fields:

- `pass: boolean`, `score: number`, `reason: string`
- `namedScores?`, `namedScoreWeights?`
- `tokensUsed?: TokenUsage`
- `componentResults?: GradingResult[]`, one per assertion
- `assertion?`, `comment?`, `suggestions?`
- `metadata?: { pluginId?, strategyId?, context?, graderOutputs?, renderedAssertionValue?, renderedGradingPrompt?, cachedResponse?, … }`

**`ProviderResponse`** (https://raw.githubusercontent.com/promptfoo/promptfoo/main/src/contracts/providers.ts):

- `output?`, `raw?`, `error?`
- `cached?`, `cost?`, `incurredCost?`, `latencyMs?`
- `tokenUsage?: TokenUsage`
- `isRefusal?`, `finishReason?`, `sessionId?`
- `guardrails?`
- `metadata?: { redteamFinalPrompt?, http?: {status, statusText, headers?}, … }`
- `prompt?` (the actual prompt sent)

**`TokenUsage`** (https://raw.githubusercontent.com/promptfoo/promptfoo/main/src/contracts/shared.ts):

- Core fields: `{ prompt?, completion?, cached?, total?, numRequests?, completionDetails? }`
- Optional breakdowns `attacker?`, `assertions?`, `generation?`, each with the same core shape.
- `incurredTokenUsage?`: the usage actually incurred in this run, excluding cache replays.
- `NormalizedTokenUsage` makes the core fields and `assertions` required.

**Red-team metadata.** In https://raw.githubusercontent.com/promptfoo/promptfoo/main/src/redteam/index.ts, generated red-team test cases carry `testCase.metadata`:

- `pluginId`
- `pluginConfig?`
- `severity`
- `modifiers`
- `strategyId`, set when a strategy is applied
- `GradingResult.metadata.pluginId` and `.strategyId` also exist.

Severity enum (`src/redteam/constants/metadata.ts`): `'critical' | 'high' | 'medium' | 'low' | 'informational'`.

Example **(derived from the types above; a trimmed row matches the upstream JSONL example in outputs.md)**:

```json
{
  "evalId": "eval-abc-2026-09-25T10:00:00",
  "results": {
    "version": 3,
    "timestamp": "2026-09-25T10:00:00.000Z",
    "prompts": [{ "raw": "Answer: {{q}}", "label": "p1", "provider": "openai:gpt-4.1-mini" }],
    "results": [
      {
        "promptIdx": 0,
        "testIdx": 0,
        "promptId": "…",
        "provider": { "id": "openai:gpt-4.1-mini" },
        "vars": { "q": "hello" },
        "testCase": {
          "vars": { "q": "hello" },
          "metadata": { "pluginId": "harmful:hate", "severity": "high", "strategyId": "jailbreak" }
        },
        "response": { "output": "Response 1", "tokenUsage": { "prompt": 12, "completion": 5, "total": 17 } },
        "success": true,
        "score": 1.0,
        "failureReason": 0,
        "latencyMs": 420,
        "namedScores": {},
        "gradingResult": {
          "pass": true,
          "score": 1.0,
          "reason": "All assertions passed",
          "componentResults": [
            {
              "pass": true,
              "score": 1.0,
              "reason": "Expected output to contain \"hello\"",
              "assertion": { "type": "contains", "value": "hello" }
            }
          ]
        }
      }
    ],
    "stats": {
      "successes": 1,
      "failures": 0,
      "errors": 0,
      "tokenUsage": {
        "prompt": 12,
        "completion": 5,
        "cached": 0,
        "total": 17,
        "numRequests": 1,
        "assertions": {}
      }
    }
  },
  "config": {},
  "shareableUrl": null,
  "metadata": {
    "promptfooVersion": "0.123.1",
    "nodeVersion": "v22…",
    "platform": "linux",
    "arch": "x64",
    "exportedAt": "2026-09-25T10:01:00.000Z"
  }
}
```

### A.3 Security notes

- The JSON, YAML, TXT, HTML and XML outputs include the eval `config`. The docs say: "Sensitive fields are redacted using Promptfoo's sanitizer rules on a best-effort basis (not comprehensive). Non-sensitive `config.env` values may still appear in exports" (outputs.md). Treat `results.json` as sensitive.
- Telemetry: `PROMPTFOO_DISABLE_TELEMETRY=1` (docs `site/docs/configuration/telemetry.md`; checked in `src/telemetry.ts`).
- Update check: `PROMPTFOO_DISABLE_UPDATE`.
- `PROMPTFOO_SELF_HOSTED` disables OS env vars in templates and disables telemetry (command-line.md env table).
- Red-team generation can call Promptfoo-hosted services. `PROMPTFOO_DISABLE_REMOTE_GENERATION=true` turns off supported hosted fallbacks, but the docs say it "is not a network egress firewall".
- Always pass `--no-share`. Configs may execute JS or Python (`file://` providers and transforms), so only run trusted configs.
- GitHub Security Advisories page: "There aren't any published security advisories" (https://github.com/promptfoo/promptfoo/security/advisories, read 2026-09-25).

---

## B. garak (NVIDIA)

**Upstream:** https://github.com/NVIDIA/garak

- License: Apache-2.0.
- Latest version: PyPI `garak` 0.17.0 (requires Python `>=3.11`). `garak/__init__.py` on main says `__version__ = "0.17.1.pre1"`.

### B.1 Invocation

Source: https://raw.githubusercontent.com/NVIDIA/garak/main/garak/cli.py

```
python -m garak --target_type <generator> --target_name <model> --spec probes.dan,probes.promptinject --report_prefix <prefix> [-g <generations>] [--eval_threshold 0.5] [--config run.yaml]
```

| Flag               | Aliases                    | Notes                                                                                                                                                                  |
| ------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--target_type`    | `-t`, `--model_type`, `-m` | "module and optionally also class of the generator, e.g. 'huggingface', or 'openai'". `-m/--model_type/--model_name` print a deprecation notice (since `0.13.1.pre1`). |
| `--target_name`    | `--model_name`, `-n`       | "name of the target"                                                                                                                                                   |
| `--spec`           | `-S`                       | "unified selection spec (replaces --probes/--probe_tags/--buffs)", e.g. `probes.dan,-probes.dan.DanInTheWild,tag:owasp:llm01`                                          |
| `--probes`         | `-p`                       | **DEPRECATED, use --spec**                                                                                                                                             |
| `--detectors`      | `-d`                       |                                                                                                                                                                        |
| `--report_prefix`  |                            | Report filename becomes `<report_prefix>.report.jsonl`; without it, `garak.<run_id>.report.jsonl` (`garak/command.py`)                                                 |
| `--generations`    | `-g`                       | default 5 (`garak/resources/garak.core.yaml`)                                                                                                                          |
| `--eval_threshold` |                            | default 0.5                                                                                                                                                            |
| `--config`         |                            | YAML or JSON run config                                                                                                                                                |
| `--report`         | `-r`                       | existing report (used for digest and HTML)                                                                                                                             |
| `--version`        | `-V`                       |                                                                                                                                                                        |

**Report directory:** `reporting.report_dir` defaults to `garak_runs`. A relative path is resolved under the XDG data dir, i.e. `$XDG_DATA_HOME/garak/garak_runs` (`garak/_config.py`, `garak/command.py`).

### B.2 Output: report JSONL

Each line is a JSON object with an `entry_type` field. Docs: https://raw.githubusercontent.com/NVIDIA/garak/main/docs/source/reporting.rst

| `entry_type`                       | Written by                                     | Fields (exact keys)                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"start_run setup"`                | `garak/command.py::start_run`                  | flattened config: `_config.<k>`, `system.<k>`, `transient.<k>`, `run.<k>`, `plugins.<k>` (e.g. `plugins.target_type`, `plugins.target_name`), `reporting.<k>`                                                                                                                                                                           |
| `"init"`                           | `command.py`                                   | `garak_version`, `start_time` (ISO), `run` (run UUID)                                                                                                                                                                                                                                                                                   |
| `"attempt"`                        | `garak/attempt.py::Attempt.as_dict`            | `uuid`, `seq`, `status` (0=new/not sent, 1=has response but not evaluated, 2=response and evaluation), `probe_classname`, `probe_params`, `targets`, `prompt` (Conversation), `outputs` (list of Message or null), `detector_results` ({detector: [float…]}), `notes`, `goal`, `conversations`, `reverse_translation_outputs`, `intent` |
| `"eval"`                           | `garak/evaluators/base.py`                     | `probe`, `detector`, `passed`, `fails`, `nones`, `total_evaluated`, `total_processed`; optional `intents` {intent: {passed,total_evaluated,nones}}; optional `confidence_method` ("bootstrap"), `confidence`, `confidence_lower`, `confidence_upper` (0–1)                                                                              |
| `"probe_summary"`                  | evaluators/base.py                             | `probe`, `inference_counts`, `detection_counts`                                                                                                                                                                                                                                                                                         |
| `"completion"`                     | `command.py::end_run`                          | `end_time` (ISO), `run`                                                                                                                                                                                                                                                                                                                 |
| `"digest"`                         | `garak/analyze/report_digest.py::build_digest` | `meta` (report header), `eval` (grouped scores), plus `technique_intent_matrix` per the docs                                                                                                                                                                                                                                            |
| `"plugin_cache"`, `"payload_init"` | parsed by report_digest.py                     | internal                                                                                                                                                                                                                                                                                                                                |

The garak version sits in the `init` entry (`garak_version`). The model or generator is in the `start_run setup` keys `plugins.target_type` and `plugins.target_name`.

**Pass semantics** (evaluators/base.py):

- Detector scores are floats in 0.0–1.0.
- The threshold evaluator passes an output when `test_value < threshold` (default 0.5).
- `passed` counts outputs where the model was **not** hit (safe). `fails` counts hits.
- `total_evaluated = passes + fails`. `nones` are unscoreable outputs.
- Attack success rate = `fails / total_evaluated`.

**Message and Conversation shape** (`garak/attempt.py` dataclasses):

- `Message{text, lang, data_path, data_type, data_checksum, notes}`
- `Turn{role, content: Message}`
- `Conversation{turns: [Turn], notes}`

Example **(derived from `command.py`, `attempt.py` and `evaluators/base.py`)**:

```jsonl
{"entry_type": "start_run setup", "plugins.target_type": "openai", "plugins.target_name": "gpt-4.1-mini", "run.generations": 5, "run.eval_threshold": 0.5, "reporting.report_prefix": "ba-run1"}
{"entry_type": "init", "garak_version": "0.17.0", "start_time": "2026-09-25T10:00:00.123456", "run": "5b1f…"}
{"entry_type": "attempt", "uuid": "9c0e…", "seq": 0, "status": 2, "probe_classname": "promptinject.HijackHateHumans", "probe_params": {}, "targets": [], "prompt": {"turns": [{"role": "user", "content": {"text": "…", "lang": "en", "data_path": null, "data_type": null, "data_checksum": null, "notes": {}}}], "notes": {}}, "outputs": [{"text": "I can't help with that.", "lang": "en", "data_path": null, "data_type": null, "data_checksum": null, "notes": {}}], "detector_results": {"promptinject.AttackRogueString": [0.0]}, "notes": {}, "goal": "inject a prompt on hate humans", "conversations": [], "reverse_translation_outputs": [], "intent": null}
{"entry_type": "eval", "probe": "promptinject.HijackHateHumans", "detector": "promptinject.AttackRogueString", "passed": 97, "fails": 3, "nones": 0, "total_evaluated": 100, "total_processed": 100, "confidence_method": "bootstrap", "confidence": 0.95, "confidence_lower": 0.01, "confidence_upper": 0.07}
{"entry_type": "completion", "end_time": "2026-09-25T10:05:00.000000", "run": "5b1f…"}
```

### B.3 Security notes

- `start_run setup` dumps every str, int, bool, dict, list or None config value, including `plugins.generators` dicts. If API keys are put in the YAML config instead of env vars, they may be written to the report. **UNVERIFIED** whether garak redacts them; no redaction was seen in `command.py`. Use env vars for keys.
- The docs list a separate hit log JSONL ("describing all the attempts from the run that were scored successful") and an HTML report. These contain the offending model outputs.
- Some generators (e.g. REST or function generators) and custom plugins run arbitrary code or send requests to arbitrary endpoints. Pin the probe and generator list.
- The GitHub Security Advisories page lists no advisories (read 2026-09-25).

---

## C. Gitleaks

**Upstream:** https://github.com/gitleaks/gitleaks (default branch `master`; Go module path `github.com/zricethezav/gitleaks/v8`)

- License: MIT ("Copyright (c) 2019 Zachary Rice").
- Latest version: v8.30.1 (https://proxy.golang.org/github.com/zricethezav/gitleaks/v8/@latest, 2026-02-21).

### C.1 Invocation

Source: https://raw.githubusercontent.com/gitleaks/gitleaks/master/README.md and `cmd/root.go`

```
gitleaks git  <repo_path> --report-format json --report-path gitleaks.json --redact --no-banner --no-color [--log-opts="--all A..B"] [--exit-code 0]
gitleaks dir  <path>      --report-format json --report-path gitleaks.json --redact --no-banner
gitleaks stdin            --report-format json --report-path -
```

- `detect` and `protect` are deprecated since v8.19.0. They are hidden but still exist.
- `-f, --report-format`: "output format (json, csv, junit, sarif, template)". **SARIF is supported.**
- `-r, --report-path`: "report file (use \"-\" for stdout)" (`cmd/root.go`).
- `--redact uint[=100]`: "redact secrets from logs and stdout". A percent value gives partial redaction.
  - In source (`detect/detect.go` → `detect/utils.go::filter`), `Finding.Redact(percent)` runs on the findings slice the detector returns, before reporting. So **report files are redacted too** (derived from source).
  - 100% redaction sets `Secret` to `"REDACTED"` and replaces the secret inside `Match` (`report/finding.go`).
- `--no-banner`, `--no-color`, `--max-target-megabytes`, `--timeout`, `--baseline-path`, `--enable-rule`, `--max-decode-depth`, `--max-archive-depth`.
- Config precedence: `--config` → `GITLEAKS_CONFIG` → `GITLEAKS_CONFIG_TOML` → `(target)/.gitleaks.toml` → default.
- **Exit codes** (README "Exit Codes"): `0` no leaks, `1` leaks or error, `126` unknown flag. `--exit-code` overrides the leaks case.
  - Because `1` covers both leaks and errors, adapters should set `--exit-code` to a distinct value (e.g. 2) to tell them apart. That is a recommendation, not upstream guidance.

### C.2 Output schema: JSON array of `Finding`

Struct: https://raw.githubusercontent.com/gitleaks/gitleaks/master/report/finding.go

Fields: `RuleID, Description, StartLine, EndLine, StartColumn, EndColumn, Match, Secret, File, SymlinkFile, Commit, Link (omitempty), Entropy (float32), Author, Email, Date, Message, Tags ([]string), Fingerprint, Fragment (omitempty)`. `Line` is `json:"-"`, so it is not serialized.

Example **(upstream fixture)**: https://raw.githubusercontent.com/gitleaks/gitleaks/master/testdata/expected/report/json_simple.json

```json
[
  {
    "RuleID": "test-rule",
    "Description": "",
    "StartLine": 1,
    "EndLine": 2,
    "StartColumn": 1,
    "EndColumn": 2,
    "Match": "line containing secret",
    "Secret": "a secret",
    "File": "auth.py",
    "SymlinkFile": "",
    "Commit": "0000000000000000",
    "Entropy": 0,
    "Author": "John Doe",
    "Email": "johndoe@gmail.com",
    "Date": "10-19-2003",
    "Message": "opps",
    "Tags": [],
    "Fingerprint": ""
  }
]
```

- Other fixtures: `testdata/expected/report/sarif_simple.sarif`, `csv_simple.csv`, `junit_simple.xml` (linked from the README).
- Fingerprint format (`<commit>:<file>:<rule>:<line>`, or without the commit for `dir`): **UNVERIFIED**, not read from source.

### C.3 Security notes

- Without `--redact`, the report holds plaintext secrets in `Secret` and `Match`. Always pass `--redact`, and never persist or upload unredacted reports.
- `git` mode also leaks commit author name and email into findings (PII).
- `--diagnostics http` serves pprof over HTTP. Do not enable it.
- GitHub Security Advisories page lists no advisories (read 2026-09-25).

---

## D. Trivy

**Upstream:** https://github.com/aquasecurity/trivy

- License: Apache-2.0.
- Latest version: v0.74.0 (https://proxy.golang.org/github.com/aquasecurity/trivy/@latest, 2026-08-14).

### D.1 Invocation

Source: https://raw.githubusercontent.com/aquasecurity/trivy/main/docs/guide/references/configuration/cli/trivy_filesystem.md

```
trivy fs   --format json --output trivy.json --scanners vuln,secret,misconfig,license --skip-db-update --skip-java-db-update --skip-check-update --offline-scan --skip-version-check --disable-telemetry --no-progress --quiet <path>
trivy repo --format json --output trivy.json <path-or-url>
```

| Flag                     | Quoted description                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `-f, --format`           | allowed values include `table`, `json` (SARIF via `--format sarif`, per `docs/guide/configuration/reporting.md`)                 |
| `-o, --output`           | "output file name"                                                                                                               |
| `--scanners`             | "comma-separated list of what security issues to detect (allowed values: vuln,misconfig,secret,license) (default [vuln,secret])" |
| `--offline-scan`         | "do not issue API requests to identify dependencies"                                                                             |
| `--skip-db-update`       | "skip updating vulnerability database"                                                                                           |
| `--skip-java-db-update`  | "skip updating Java index database"                                                                                              |
| `--skip-check-update`    | "skip fetching rego check updates"                                                                                               |
| `--skip-version-check`   | "suppress notices about version updates and Trivy announcements"                                                                 |
| `--disable-telemetry`    | "disable sending anonymous usage data to Aqua"                                                                                   |
| `--db-repository`        | default `[mirror.gcr.io/aquasec/trivy-db:2,ghcr.io/aquasecurity/trivy-db:2]`                                                     |
| `--cache-dir`            | cache directory                                                                                                                  |
| `--exit-code`            | "specify exit code when any security issues are found"                                                                           |
| `--list-all-pkgs`        | "output all packages in the JSON report regardless of vulnerability (default true)"                                              |
| `--include-non-failures` | "include successes, available with '--scanners misconfig'"                                                                       |

**Network.** Per https://raw.githubusercontent.com/aquasecurity/trivy/main/docs/guide/advanced/air-gap.md, "Trivy requires internet connectivity in order to function normally".

- External resources:
  - Vulnerability DB and Java DB: OCI images at `mirror.gcr.io` / `ghcr.io`.
  - Checks Bundle: misconfig.
  - VEX Hub: `api.github.com`, `codeload.github.com`.
  - Maven Central.
  - Remote Terraform modules.
- The Checks Bundle is also embedded in the binary as a fallback, so misconfig scanning works air-gapped.
- The vulnerability scanner needs a DB. `--skip-db-update` works only if a DB already exists in `--cache-dir`: either pre-seeded or self-hosted (`docs/guide/advanced/self-hosting.md`, referenced from air-gap.md).
- **UNVERIFIED:** the exact error text Trivy gives when `--skip-db-update` is used with an empty cache.
- Secret and license scanners need no DB (inferred from the resource table, which lists no resource for them). Mark as **UNVERIFIED** until tested.

### D.2 Output schema

Sources:

- https://raw.githubusercontent.com/aquasecurity/trivy/main/pkg/types/report.go (`SchemaVersion = 2` constant in `pkg/report`)
- `pkg/types/vulnerability.go`, `misconfiguration.go`, `secret.go`, `license.go`
- `pkg/fanal/types/secret.go`
- https://raw.githubusercontent.com/aquasecurity/trivy-db/main/pkg/types/types.go

- `Report`: `SchemaVersion (int, =2)`, `Trivy {Version…}`, `ReportID`, `CreatedAt`, `ArtifactID`, `ArtifactName`, `ArtifactType`, `Metadata {OS, ImageID, …, RepoURL, Branch, Commit, …}`, `Results[]`.
- `Result`: `Target`, `Class`, `Type`, `Packages[]`, `Vulnerabilities[]`, `MisconfSummary`, `Misconfigurations[]`, `Secrets[]`, `Licenses[]`, `CustomResources[]`, `ExperimentalModifiedFindings[]`.
  - `Class` values: `os-pkgs`, `lang-pkgs`, `config`, `secret`, `license`, `license-file`, `custom`, `unknown`.
- `DetectedVulnerability`: `VulnerabilityID, VendorIDs, PkgID, PkgName, PkgPath, PkgIdentifier, InstalledVersion, FixedVersion, Status, Layer, SeveritySource, PrimaryURL, DataSource, Fingerprint, Custom`, plus the embedded trivy-db `Vulnerability`: `Title, Description, Severity (deprecated in favour of VendorSeverity, still emitted), CweIDs, VendorSeverity, CVSS, References, PublishedDate, LastModifiedDate`.
- `DetectedMisconfiguration`: `Type, ID, AVDID (Deprecated: use ID), Title, Description, Message, Namespace, Query, Resolution, Severity, PrimaryURL, References, Status ("PASS"|"FAIL"|"EXCEPTION"), Layer, CauseMetadata, Traces`.
- `DetectedSecret` (= `SecretFinding`): `RuleID, Category, Severity, Title, StartLine, EndLine, Code, Match, Layer, Offset`.
- `DetectedLicense`: `Severity, Category, PkgName, FilePath, Name, Text, Confidence, Link`.
- Severity strings are `UNKNOWN|LOW|MEDIUM|HIGH|CRITICAL`. **UNVERIFIED** from source in this pass; this is the trivy-db convention.

Example **(derived from the structs above)**:

```json
{
  "SchemaVersion": 2,
  "CreatedAt": "2026-09-25T10:00:00Z",
  "ArtifactName": ".",
  "ArtifactType": "filesystem",
  "Results": [
    {
      "Target": "package-lock.json",
      "Class": "lang-pkgs",
      "Type": "npm",
      "Vulnerabilities": [
        {
          "VulnerabilityID": "CVE-2024-0001",
          "PkgName": "lodash",
          "InstalledVersion": "4.17.20",
          "FixedVersion": "4.17.21",
          "Status": "fixed",
          "Severity": "HIGH",
          "Title": "Prototype pollution",
          "PrimaryURL": "https://avd.aquasec.com/nvd/cve-2024-0001"
        }
      ]
    },
    {
      "Target": "Dockerfile",
      "Class": "config",
      "Type": "dockerfile",
      "Misconfigurations": [
        {
          "Type": "Dockerfile Security Check",
          "ID": "DS-0002",
          "AVDID": "AVD-DS-0002",
          "Title": "Image user should not be 'root'",
          "Severity": "HIGH",
          "Status": "FAIL"
        }
      ]
    },
    {
      "Target": "config/.env",
      "Class": "secret",
      "Secrets": [
        {
          "RuleID": "aws-access-key-id",
          "Category": "AWS",
          "Severity": "CRITICAL",
          "Title": "AWS Access Key ID",
          "StartLine": 3,
          "EndLine": 3,
          "Match": "AWS_ACCESS_KEY_ID=********************"
        }
      ]
    }
  ]
}
```

The masked `Match` in the example is illustrative. Trivy masking of secrets in `Match`: **UNVERIFIED**.

### D.3 Security notes: supply-chain incident (CRITICAL)

**CVE-2026-33634 / GHSA-69fq-xp46-6x23**, "Trivy ecosystem supply chain was briefly compromised" (https://github.com/aquasecurity/trivy/security/advisories/GHSA-69fq-xp46-6x23):

- Malicious Trivy **v0.69.4**, released 2026-03-19 and live for about 3 hours.
- Malicious DockerHub images **v0.69.5 and v0.69.6**, live 2026-03-22 to 23.
- `trivy-action` tags before 0.35.0 and `setup-trivy` tags before 0.2.6 were force-pushed.
- The payload was credential-stealing malware.
- Advisory guidance:
  - Use unaffected versions.
  - Rotate any exposed secrets.
  - Pin GitHub Actions to full commit SHAs.

Guidance for buyer-arena:

- Pin an exact Trivy version (not `latest`), verify checksums and signatures, and never use v0.69.4–0.69.6.
- Run Trivy without CI secrets in its environment.

---

## E. Nuclei (ProjectDiscovery)

**Upstream:** https://github.com/projectdiscovery/nuclei

- License: MIT (`LICENSE.md`, "Copyright (c) 2025 ProjectDiscovery, Inc.").
- Latest version: **v3.11.1** (https://proxy.golang.org/github.com/projectdiscovery/nuclei/v3/@latest, 2026-08-08).

### E.1 Invocation

Source: https://raw.githubusercontent.com/projectdiscovery/nuclei/main/cmd/nuclei/main.go

```
nuclei -u https://target.example -t <templates> -jsonl -o findings.jsonl -silent -nc -duc -omit-raw -omit-template -lna
nuclei -l targets.txt -je findings.json          # JSON array export
nuclei -l targets.txt -jle findings.jsonl        # JSONL export file
```

| Flag                                   | Default | Description (quoted)                                                                               |
| -------------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `-jsonl, -j`                           | false   | "write output in JSONL(ines) format"                                                               |
| `-json-export, -je`                    | ""      | "file to export results in JSON format"                                                            |
| `-jsonl-export, -jle`                  | ""      | "file to export results in JSONL(ine) format"                                                      |
| `-sarif-export, -se`                   | ""      | "file to export results in SARIF format"                                                           |
| `-o, -output`                          | ""      | "output file to write found issues/vulnerabilities"                                                |
| `-omit-raw, -or`                       | false   | "omit request/response pairs in the JSON, JSONL, Markdown, and PDF outputs"                        |
| `-omit-template, -ot`                  | false   | "omit encoded template in the JSON, JSONL output"                                                  |
| `-silent`, `-nc`                       | false   | findings only, no ANSI colour                                                                      |
| `-duc, -disable-update-check`          |         | "disable automatic nuclei/templates update check"                                                  |
| `-code`                                | false   | "enable loading code protocol-based templates"                                                     |
| `-file`                                | false   | "enable loading file templates"                                                                    |
| `-dut, -disable-unsigned-templates`    | false   | "disable running unsigned templates or templates with mismatched signature"                        |
| `-lfa, -allow-local-file-access`       | false   | "allows file (payload) access anywhere on the system"                                              |
| `-lna, -restrict-local-network-access` | false   | "blocks connections to the local / private network"                                                |
| `-ev, -env-vars`                       | false   | "enable environment variables to be used in template"                                              |
| `-dast`                                | false   | "enable / run dast (fuzz) nuclei templates"                                                        |
| `-headless`                            | false   | "enable templates that require headless browser support (root user on Linux will disable sandbox)" |
| `-esc, -enable-self-contained`         | false   | self-contained templates                                                                           |
| `-ni, -no-interactsh`                  | false   | "disable interactsh server for OAST testing, exclude OAST based templates"                         |
| `-rl, -rate-limit`                     | 150     | requests per second                                                                                |
| `-rd, -redact`                         |         | "redact given list of keys from query parameter, request header and body"                          |

### E.2 Output schema: `ResultEvent`

Struct: https://raw.githubusercontent.com/projectdiscovery/nuclei/main/pkg/output/output.go. Info struct: `pkg/model/model.go`.

| JSON key                                                                                           | Notes                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `template`, `template-url`, `template-id` (always), `template-path`, `template-encoded`            |                                                                                                                                                          |
| `info`                                                                                             | `{name, author[], tags[], description, impact, reference, severity, metadata, classification{cve-id, cwe-id, cvss-metrics, cvss-score, …}, remediation}` |
| `matcher-name`, `extractor-name`                                                                   |                                                                                                                                                          |
| `type` (always)                                                                                    | protocol, e.g. `http`, `dns`, `network`, `javascript`, `code`                                                                                            |
| `host`, `port`, `scheme`, `url`, `path`, `matched-at`, `ip`                                        |                                                                                                                                                          |
| `extracted-results[]`, `request`, `response`, `curl-command`, `meta`                               |                                                                                                                                                          |
| `timestamp` (always, RFC3339)                                                                      |                                                                                                                                                          |
| `interaction`                                                                                      | OAST                                                                                                                                                     |
| `matcher-status` (always, bool)                                                                    |                                                                                                                                                          |
| `matched-line[]`, `global-matchers`                                                                |                                                                                                                                                          |
| `is_fuzzing_result`, `fuzzing_method`, `fuzzing_parameter`, `fuzzing_position`, `analyzer_details` | DAST                                                                                                                                                     |
| `issue_trackers`, `req_url_pattern`, `error`                                                       |                                                                                                                                                          |

- Severity values (`pkg/model/types/severity/severity.go`): `info`, `low`, `medium`, `high`, `critical`, `unknown`.
- Classification sub-keys (`cve-id`, `cwe-id`, …): **UNVERIFIED** field-by-field; `Classification` struct not read.

Example **(derived from `ResultEvent`)**:

```json
{
  "template-id": "tech-detect",
  "template-path": "/root/nuclei-templates/http/technologies/tech-detect.yaml",
  "info": {
    "name": "Wappalyzer Technology Detection",
    "author": ["hakluke"],
    "tags": ["tech"],
    "severity": "info"
  },
  "matcher-name": "nginx",
  "type": "http",
  "host": "https://target.example",
  "port": "443",
  "scheme": "https",
  "url": "https://target.example",
  "matched-at": "https://target.example/",
  "ip": "203.0.113.10",
  "timestamp": "2026-09-25T10:00:00.000000000Z",
  "matcher-status": true
}
```

### E.3 Security notes: known CVEs in Nuclei itself

Source: https://github.com/projectdiscovery/nuclei/security/advisories and the per-GHSA pages (read 2026-09-25).

| GHSA                | CVE            | Title                                                                                                                           | Affected        | Fixed  |
| ------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------ |
| GHSA-w5wx-6g2r-r78q | CVE-2024-27920 | Unsigned code template execution through workflows                                                                              | >3.0.0          | 3.2.0  |
| GHSA-c3q9-c27p-cw9h | CVE-2024-40641 | Unsigned code template execution through workflows                                                                              | >3.0.0          | 3.3.0  |
| GHSA-7h5p-mmpp-hgmm | CVE-2024-43405 | Template Signature Verification Bypass (newline handling)                                                                       | >3.0.0          | 3.3.2  |
| GHSA-jm34-66cf-qpvr | CVE-2026-41645 | Env var disclosure via response-derived DSL expressions (only with `-env-vars`)                                                 | >=3.0.0 <3.8.0  | 3.8.0  |
| GHSA-29rg-wmcw-hpf4 | CVE-2026-41646 | Local file read (.js/.json) via `require()` bypassing `-lfa` restriction                                                        | 3.0.0–3.7.x     | 3.8.0  |
| GHSA-vxg7-f2jj-jmqm | CVE-2026-76819 | Arbitrary code execution via Goja JS engine; "JavaScript templates do not require the `-code` flag and run unsigned by default" | >=3.0.0 <3.10.0 | 3.10.0 |
| GHSA-jpf4-98qj-qr67 | CVE-2026-76802 | Unsigned `code:` templates execute when `-dast` enabled (signature bypass)                                                      | 3.0.0–3.9.9     | 3.10.0 |
| GHSA-xhmx-w2j4-rw3q | CVE-2026-76803 | Local file read via MySQL client sandbox bypass (`allowAllFiles`)                                                               | 3.0.0 – <3.10.0 | 3.10.0 |
| GHSA-qgw5-7j4f-fg97 | CVE-2026-76804 | Local file read via workflow `file:` protocol gate bypass                                                                       | 3.0.0 – <3.10.0 | 3.10.0 |
| GHSA-jpvm-9frm-hjcq | CVE-2026-76805 | Env var disclosure via response-derived data in DAST/fuzz mode                                                                  | 3.0.0 – <3.10.0 | 3.10.0 |

Sources for the table:

- CVE IDs and versions for the first seven rows come from the GHSA pages.
- For GHSA-xhmx, GHSA-qgw5 and GHSA-jpvm, the CVE IDs and fixed version come from the GitLab Advisory DB search result (https://advisories.gitlab.com/golang/github.com/projectdiscovery/nuclei/v3/CVE-2026-76805/). The GHSA titles are from the GitHub list. The exact per-GHSA pages for those three were not opened: **partially VERIFIED**.

Guidance for buyer-arena:

- **Minimum safe version: v3.10.0. Recommended: pin v3.11.1 (latest).**
- Run only templates from a pinned, reviewed set. Never load untrusted `javascript:`, `code:`, workflow or `file:` templates.
- Leave these flags off: `-code`, `-dast`, `-lfa`, `-env-vars`, `-headless`, `-file`.
- Add `-dut` to refuse unsigned templates, and `-lna` to block private networks unless scanning is explicitly local.
- Scan only targets the user owns or is authorized to test.
- Template signing: `-dut` enforces it. The signing tool (`nuclei -sign`) was not verified in this pass: **UNVERIFIED**.

---

## F. Browser Use (Python)

**Upstream:** https://github.com/browser-use/browser-use

- License: MIT ("Copyright (c) 2024 Gregor Zunic").
- Latest version: PyPI `browser-use` 0.13.10, `requires_python >=3.11,<4.0`. The README suggests `uv init --python 3.12`.

### F.1 Current API

Minimal agent, from README (https://raw.githubusercontent.com/browser-use/browser-use/main/README.md):

```python
import asyncio
from browser_use import Agent, Browser, ChatBrowserUse, ChatOpenAI
async def main():
    llm = ChatOpenAI(model='gpt-5.6-luna', reasoning_effort='xhigh')
    agent = Agent(task="Find the number of stars of the browser-use repo", llm=llm)
    history = await agent.run()
    print(history.final_result())
asyncio.run(main())
```

**LLM classes exported from `browser_use`** (`browser_use/__init__.py`):
`ChatOpenAI, ChatAnthropic, ChatOllama, ChatGoogle, ChatOpenRouter, ChatAzureOpenAI, ChatAWSBedrock, ChatAnthropicBedrock, ChatBrowserUse, ChatCerebras, ChatDeepSeek, ChatGroq, ChatLiteLLM, ChatMistral, ChatOCIRaw, ChatOrcaRouter, ChatVercel`.

- `ChatBrowserUse` uses `BROWSER_USE_API_KEY`, a hosted gateway.
- Also exported: `Browser` (alias of `BrowserSession`), `BrowserSession`, `BrowserProfile`, `Tools`, `ActionResult`.

**`Agent.__init__`** (`browser_use/agent/service.py`) key params:

- `task: str`, `llm`
- `browser_profile`, `browser_session`, `browser` (alias)
- `sensitive_data`, `output_model_schema`
- `use_vision=True`, `save_conversation_path`
- `max_failures=5`, `max_actions_per_step=5`, `flash_mode`
- `page_extraction_llm`, `fallback_llm`, `judge_llm`
- `calculate_cost=False`, `llm_timeout`

**Running.** `async def run(self, max_steps: int = 500, on_step_start=None, on_step_end=None) -> AgentHistoryList`.

**`AgentHistoryList`** (`browser_use/agent/views.py`):

- Fields: `history: list[AgentHistory]`, `usage: UsageSummary | None`.
- Methods:
  - `urls()`, `final_result()`, `is_done()`, `is_successful()`
  - `has_errors()`, `errors()`
  - `judgement()`, `is_judged()`, `is_validated()`
  - `action_names()`, `model_thoughts()`, `model_outputs()`, `model_actions()`, `model_actions_filtered(include)`
  - `action_history()`, `action_results()`, `extracted_content()`
  - `number_of_steps()`, `total_duration_seconds()`, `agent_steps()`
  - `screenshot_paths()`, `screenshots()`, `last_action()`
  - `structured_output`, `get_structured_output(model)`
  - `save_to_file(path, sensitive_data=None)`, `load_from_file(path, output_model)`, `model_dump()`
- `AgentHistory` items: `model_output`, `result: list[ActionResult]`, `state: BrowserStateHistory`, `metadata: StepMetadata | None`, `state_message`.
- `UsageSummary` (`browser_use/tokens/views.py`): `total_prompt_tokens, total_prompt_cost, total_prompt_cached_tokens, total_prompt_cached_cost, total_prompt_cache_creation_tokens, total_prompt_cache_creation_cost, total_completion_tokens, total_completion_cost, total_tokens, total_cost, entry_count, by_model{}`.

**Domain restriction** (`browser_use/browser/profile.py`, `BrowserProfile` fields, also accepted by `BrowserSession`):

- `allowed_domains: list[str] | set[str] | None`, e.g. `["*.google.com", "https://example.com"]`. "Lists with 100+ items are auto-optimized to sets (no pattern matching)".
- `prohibited_domains`: "Allowed domains take precedence over prohibited domains".
- `block_ip_addresses: bool`: blocks IPv4 and IPv6 URLs including localhost and private networks.

Example use: `Agent(task=..., llm=..., browser_profile=BrowserProfile(allowed_domains=['https://shop.example'], block_ip_addresses=True))`. The kwarg names are verified; this exact combination was not run.

Serialized history example: **UNVERIFIED**. `save_to_file` writes `model_dump()` JSON, but no upstream fixture was read.

### F.2 Security notes

- **CVE-2025-47241 / GHSA-x39x-9qw5-ghrf** (Critical): `allowed_domains` bypass via a decoy domain in the URL userinfo (`https://example.com:pass@localhost:8080`). Affected <=0.1.44, fixed in 0.1.45 (https://github.com/browser-use/browser-use/security/advisories/GHSA-x39x-9qw5-ghrf). Use a current version.
- Telemetry is on by default: `ANONYMIZED_TELEMETRY` defaults to `true`. `BROWSER_USE_CLOUD_SYNC` defaults to the same value (`browser_use/config.py`). Set `ANONYMIZED_TELEMETRY=false`.
- The config dir is `$XDG_CONFIG_HOME/browseruse` (`BROWSER_USE_CONFIG_DIR`).
- Pass credentials through `sensitive_data`, never inside `task`. Page content can prompt-inject the agent, so combine `allowed_domains` with `block_ip_addresses=True`.

---

## G. Stagehand (TypeScript)

**Upstream:** https://github.com/browserbase/stagehand

- License: MIT ("Copyright (c) 2024 Browserbase Inc.").
- Latest version: npm `@browserbasehq/stagehand` **4.1.0**. dist-tags: `latest: 4.1.0`, `v3-latest: 3.7.3`, `alpha: 4.2.0-alpha-…`. `engines.node >=22.18.0`.

### G.1 Current (v4) API: breaking changes vs the v3 names in the brief

Source: https://raw.githubusercontent.com/browserbase/stagehand/main/packages/docs/v4/migrations/v3.mdx

- "The constructor is private and `init()` is gone." `new Stagehand({ env: "LOCAL" })` + `await stagehand.init()` is the **v3** API.
- "**`agent()` is gone.** Nothing in v4 replaces it one-for-one." The recommended replacements are "code mode" or your own tool-calling loop.
- `stagehand.page` and `stagehand.context` were removed. Use `browser.context.pages()` / `browser.context.activePage()` or `stagehand.browser.context`.
- `act`, `extract`, `observe` are methods on the Stagehand instance and return `{ data, metadata }`.
- `extract(instruction, zodSchema)` takes positional args. With no schema it returns `{ extraction: string }`.
- Model config: `model: { modelName: "<provider>/<model>", apiKey }`. This replaces `modelName` + `modelClientOptions`. "Model names always carry a provider prefix."
- Logging: `logging: { level: "debug"|"info"|"warn"|"error"|"off", format: "json", onLog }`.
- Metrics: `await stagehand.metrics()`.
- Caching (`cache`) is server-side on Browserbase only. "Caching needs a Browserbase browser". Local `enableCaching` and `cacheDir` were removed.

v4 local quickstart (https://raw.githubusercontent.com/browserbase/stagehand/main/packages/docs/v4/first-steps/quickstart.mdx):

```ts
import { localBrowser, Stagehand } from '@browserbasehq/stagehand';
import { z } from 'zod/v4';
const browser = await localBrowser.launch();
const stagehand = await Stagehand.create({
  browser,
  model: { modelName: 'openai/gpt-5.6-sol', apiKey: process.env.OPENAI_API_KEY },
});
const [page] = await browser.context.pages();
await page.goto('https://stagehand.dev');
const { data } = await stagehand.extract(
  'Extract the value proposition from the page.',
  z.object({ valueProposition: z.string() }),
);
await stagehand.act("Click the 'Evals' button.");
const obs = await stagehand.observe('What can I click on this page?');
await stagehand.close();
await browser.close();
```

- **Local without Browserbase:** yes, via `localBrowser.launch()` or `localBrowser.connect({ cdpUrl })`. It needs Chrome installed ("Local runs need Chrome installed", README) and an explicit `model` with `apiKey`.
- Per `packages/docs/v4/configuration/models.mdx`, "`model` with no `apiKey`" routes to the Browserbase Model Gateway. Omitting `model` uses the Gateway on a Browserbase browser.
- Stagehand "closes only the browsers it launched", so call `browser.close()` yourself.
- Zod must stay on `4.4.x` (quickstart note).

`act()` result shape **(upstream docs example, `packages/docs/v4/basics/act.mdx`)**:

```ts
{ data: { success: true, message: "Action [click] performed successfully on selector: xpath=/html[1]/body[1]/div[1]/span[1]",
          actionDescription: "Favorite Colour",
          actions: [{ selector: "xpath=/html[1]/body[1]/div[1]/span[1]", description: "Favorite Colour", method: "click", arguments: [] }] },
  metadata: { actionId: "act_01HZY...", cache: { status: "MISS", missReason: "not_found" } } }
```

- The migration doc says `metadata` "carries the action ID, cache status, and token usage". The exact token-usage field names inside `metadata` are **UNVERIFIED**.
- If adapters must keep the v3 API (`env: "LOCAL"`, `init()`, `agent().execute()`), pin `@browserbasehq/stagehand@3.7.3` (`v3-latest`). The v3 field shapes were **not** re-verified in this pass: **UNVERIFIED**.

### G.2 Security notes

- The GitHub Security Advisories page lists no advisories (read 2026-09-25).
- The README pattern "observe() returns real selectors, so credentials never reach the model" means: fill secrets yourself with `page.locator(...).fill(...)` rather than passing them in instructions.
- Browserbase caching sends instruction and page content to Browserbase servers. That applies only on Browserbase browsers.

---

## H. OpenCode

**Upstream:** https://github.com/anomalyco/opencode.

- WebFetch of `github.com/sst/opencode` shows the canonical repo `anomalyco/opencode`, default branch `dev`.
- License: MIT ("Copyright (c) 2025 opencode").
- Latest version: npm `opencode-ai` 1.18.32.

### H.1 Invocation

Source: https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/opencode/src/cli/cmd/run.ts. Docs: `packages/web/src/content/docs/cli.mdx`.

```
opencode run --format json --model <provider>/<model> [--agent <name>] [--dir <path>] [--variant high] "message"
opencode --version        # also -v
```

- `--format`: "format: default (formatted) or json (raw JSON events)".
- `--model` / `-m`: "model to use in the format of provider/model".
- Other flags: `--agent`, `--file`, `--session`, `--continue`, `--fork`, `--share`, `--title`, `--attach <url>`, `--password`, `--username`, `--dir`, `--port`, `--variant`, `--thinking`.
- Dangerous flags: `--auto` ("auto-approve permissions that are not explicitly denied (dangerous!)"), `--yolo`, `--dangerously-skip-permissions`.
- In non-interactive `run`, a `permission.asked` event is **auto-rejected** unless `--auto` is set (from the `loop()` code: `reply: "reject"`).
- Exit code: `process.exitCode = 1` if a `session.error` occurred or the command returned an error.

### H.2 JSON lines event schema

Each event is written as `JSON.stringify({ type, timestamp: Date.now(), sessionID, ...data }) + EOL` (run.ts `emit()`).

| `type`        | Payload                               | Emitted when                                   |
| ------------- | ------------------------------------- | ---------------------------------------------- |
| `step_start`  | `{ part }` (part.type `"step-start"`) | a model step starts                            |
| `text`        | `{ part: TextPart }`                  | text part finished (`part.time.end` set)       |
| `reasoning`   | `{ part }`                            | only with `--thinking`                         |
| `tool_use`    | `{ part: ToolPart }`                  | tool state `completed` or `error`              |
| `step_finish` | `{ part: StepFinishPart }`            | a model step ends; **carries tokens and cost** |
| `error`       | `{ error }`                           | `session.error` or a failed command            |

The stream ends when `session.status` becomes `idle`.

Types (https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/sdk/js/src/v2/gen/types.gen.ts):

- `StepFinishPart = { id, sessionID, messageID, type: "step-finish", reason: string, snapshot?, cost: number, tokens: { total?, input, output, reasoning, cache: { read, write } } }`
- `TextPart = { id, sessionID, messageID, type: "text", text, synthetic?, ignored?, time?: { start, end? }, metadata? }`
- `ToolStateCompleted = { status: "completed", input, output: string, title, metadata, time: { start, end, compacted? }, attachments? }`. The `ToolStateError` status is `"error"`.
- `AssistantMessage` carries `modelID`, `providerID`, `agent`, `cost`, `tokens{…}`, `finish?`, `error?`. It is **not** emitted in JSON mode; only parts are. Model identity in JSON mode therefore has to come from the `--model` you passed. The SDK or server API exposes `modelID` on messages.

Cost units: USD per step. That is an inference, **UNVERIFIED**; the field is a plain `number`.

Example **(derived from `emit()` and the types above)**:

```jsonl
{"type":"step_start","timestamp":1790000000000,"sessionID":"ses_123","part":{"id":"prt_1","sessionID":"ses_123","messageID":"msg_1","type":"step-start"}}
{"type":"text","timestamp":1790000001000,"sessionID":"ses_123","part":{"id":"prt_2","sessionID":"ses_123","messageID":"msg_1","type":"text","text":"Done.","time":{"start":1790000000500,"end":1790000001000}}}
{"type":"step_finish","timestamp":1790000001100,"sessionID":"ses_123","part":{"id":"prt_3","sessionID":"ses_123","messageID":"msg_1","type":"step-finish","reason":"stop","cost":0.00042,"tokens":{"input":1200,"output":35,"reasoning":0,"cache":{"read":0,"write":0}}}}
```

### H.3 Credentials and security notes

- Credentials from `opencode auth login` are stored in **`~/.local/share/opencode/auth.json`** (cli.mdx line ~142; `packages/opencode/src/auth/index.ts`: `path.join(Global.Path.data, "auth.json")`, written with mode `0o600`). **buyer-arena must never read this file.** Pass keys through provider env vars only.
- Env vars (cli.mdx):
  - `OPENCODE_CONFIG`, `OPENCODE_CONFIG_CONTENT`, `OPENCODE_PERMISSION`
  - `OPENCODE_DISABLE_AUTOUPDATE`
  - `OPENCODE_DISABLE_CLAUDE_CODE`: stops reading `.claude` prompts and skills
  - `OPENCODE_DISABLE_LSP_DOWNLOAD`, `OPENCODE_DISABLE_DEFAULT_PLUGINS`
- `opencode run` starts a local HTTP server (`--port`, random by default). Advisories:
  - **CVE-2026-22812 / GHSA-vxw4-wv6m-9hhh**: unauthenticated HTTP server allows arbitrary command execution. Fixed in 1.0.216.
  - **CVE-2026-22813 / GHSA-c83v-7274-4vgp**: XSS in the web UI leads to RCE via `/pty/`. Fixed in 1.1.10.
  - **GHSA-632h-h47v-g4x4** (no CVE, published 2026-09-24): CSRF on `/global/upgrade` can install arbitrary npm packages. Affects 1.14.30–1.18.16, fixed in **1.18.22**.
  - **Minimum safe version: 1.18.22.** Source: https://github.com/anomalyco/opencode/security/advisories.
- Never pass `--auto`, `--yolo` or `--dangerously-skip-permissions` from an adapter.

---

## I. OpenRouter

**Primary source:** the OpenAPI spec in the official SDK repo, https://raw.githubusercontent.com/OpenRouterTeam/typescript-sdk/main/.speakeasy/in.openapi.yaml (servers: `https://openrouter.ai/api/v1`).

- openrouter.ai docs were blocked from this container.
- SDK license: Apache-2.0 (`LICENSE.md`). npm `@openrouter/sdk` 1.3.28.

### I.1 Chat completions

- `POST https://openrouter.ai/api/v1/chat/completions` (operationId `sendChatCompletionRequest`). OpenAI-compatible; body schema `ChatRequest`.
- Request keys:
  - `model`, `models`, `messages`
  - `stream`, `stream_options`
  - `temperature`, `max_tokens`, `max_completion_tokens`, `seed`
  - `tools`, `tool_choice`, `response_format`
  - `provider`, `plugins`, `reasoning`, `route`, `session_id`, `user`, `metadata`, `trace`
  - … (full list from the spec)
- Optional app-attribution headers. The SDK (`src/funcs/chatSend.ts`) sends:
  - `HTTP-Referer` (option `httpReferer`)
  - `X-OpenRouter-Title` (option `appTitle`)
  - `X-OpenRouter-Categories` (option `appCategories`)
- The legacy `X-Title` header named in the brief does **not** appear in the current SDK or spec. Whether it is still accepted is **UNVERIFIED**.
- Optional header `X-OpenRouter-Metadata: enabled` surfaces routing metadata under `openrouter_metadata`. The legacy `X-OpenRouter-Experimental-Metadata` is also accepted (spec).
- **Response `ChatResult`**: required `id, choices, created, model, object, system_fingerprint`. Also `usage: ChatUsage`, `service_tier`, `openrouter_metadata`.
  - `model` is described as "Model used for completion". This is the actual routed model, which matters for `openrouter/auto`.
- **`ChatUsage`**:
  - required `prompt_tokens, completion_tokens, total_tokens`
  - `prompt_tokens_details` (e.g. `cached_tokens`), `completion_tokens_details` (e.g. `reasoning_tokens`)
  - `cost` ("Cost of the completion", number \| null)
  - `cost_details { upstream_inference_prompt_cost, upstream_inference_completions_cost, upstream_inference_cost, server_tool_cost }`
  - `is_byok`, `server_tool_use_details`
- **`usage: { include: true }`**: this request parameter does **not** exist in the current `ChatRequest` schema. `cost` is a standard `ChatUsage` field in the spec. Whether `cost` is always populated without opting in is **UNVERIFIED**; the docs site could not be reached.

Spec example (ChatUsage) **(upstream)**:

```json
{
  "completion_tokens": 15,
  "completion_tokens_details": { "reasoning_tokens": 5 },
  "cost": 0.0012,
  "cost_details": {
    "upstream_inference_completions_cost": 0.0004,
    "upstream_inference_cost": null,
    "upstream_inference_prompt_cost": 0.0008
  },
  "is_byok": false,
  "prompt_tokens": 10,
  "prompt_tokens_details": { "cached_tokens": 2 },
  "server_tool_use_details": { "tool_calls_executed": 2, "tool_calls_requested": 2 },
  "total_tokens": 25
}
```

**Variants** (spec text):

- `openrouter/auto` appears as a router value ("Router used for the request (e.g., openrouter/auto)").
- `:free` is a model variant suffix (e.g. `deepseek/deepseek-r1-0528:free`). The spec describes a "Free-model (`:free` variant) daily request quota … the counter resets at UTC midnight".

### I.2 Models list

`GET /api/v1/models` returns `ModelsListResponse { data: Model[], total_count, links }`.

- Query params: `offset`, `limit` (max 1000), `category`, `supported_parameters`, `output_modalities` (default `"text"`).
- Pagination fields such as `total_count` are new relative to older docs.

`Model` fields:

- required: `id, canonical_slug, name, created, pricing, context_length, architecture, top_provider, per_request_limits, supported_parameters, default_parameters, supported_voices, links`
- optional: `description, hugging_face_id, knowledge_cutoff, expiration_date, reasoning, benchmarks, alias_target`

Sub-objects:

- `architecture`: `{ modality, input_modalities[], output_modalities[], tokenizer, instruct_type }`
- `pricing` (`PublicPricing`): **strings, USD per token**. Required `prompt`, `completion`. Optional `request, image, image_token, image_output, audio, audio_output, input_audio_cache, input_cache_read, input_cache_write, input_cache_write_1h, internal_reasoning, web_search, discount (number), overrides[]`.
- `top_provider`: `{ context_length, max_completion_tokens, is_moderated }`

Spec example **(upstream, trimmed)**:

```json
{
  "id": "openai/gpt-4",
  "canonical_slug": "openai/gpt-4",
  "name": "GPT-4",
  "created": 1692901234,
  "context_length": 8192,
  "architecture": {
    "input_modalities": ["text"],
    "output_modalities": ["text"],
    "modality": "text->text",
    "tokenizer": "GPT",
    "instruct_type": "chatml"
  },
  "pricing": { "prompt": "0.00003", "completion": "0.00006", "image": "0", "request": "0" },
  "top_provider": { "context_length": 8192, "max_completion_tokens": 4096, "is_moderated": true },
  "per_request_limits": null,
  "supported_parameters": ["temperature", "tools"],
  "default_parameters": null
}
```

The `supported_parameters` values in this example are illustrative.

Security: send the key only as `Authorization: Bearer $OPENROUTER_API_KEY` over HTTPS and never log it. The auth scheme is **UNVERIFIED** in this pass (the spec's securitySchemes were not read); it is standard OpenAI-compatible.

---

## J. Models.dev

**Upstream:** https://github.com/sst/models.dev (default branch `dev`)

- License: MIT ("Copyright (c) 2025 models.dev").
- `https://models.dev/api.json` was blocked from this container, so the shape is verified from the build script and schema.

**Structure:**

- `packages/web/script/build.ts` writes `_api.json` = `JSON.stringify(filtered.providers)`.
- `packages/core/src/generate.ts` builds `result: Record<string, Provider>` keyed by **provider ID** (the directory name, assigned as `toml.id = providerID`). Models inside are keyed by model ID (`toml.id = modelID`).
- The README says `?type=decision` / `?type=all` query params exist, and specialised model types are omitted by default.

**Schema** (https://raw.githubusercontent.com/sst/models.dev/dev/packages/core/src/schema.ts, strict zod):

- `Provider`: `{ id, env: string[] (min 1), npm: string, api?: string, name, doc, models: Record<string, Model> }`
  - `api` is required for `@ai-sdk/openai-compatible`, `@openrouter/ai-sdk-provider` and Merge Gateway.
  - `api` is optional for openai, anthropic and kiro, and forbidden otherwise.
- `Model` (provider model):
  - `id`, `type?` (`decision`), `name`, `description`, `family?`
  - `attachment: bool`, `reasoning: bool`, `reasoning_options?`, `tool_call: bool`, `interleaved?`
  - `structured_output?: bool`, `temperature?: bool`
  - `knowledge?`, `release_date`, `last_updated`: DateString `YYYY-MM` or `YYYY-MM-DD`
  - `modalities: { input: string[], output: string[] }`
  - `open_weights: bool`
  - `limit: { context, input?, output }`
  - `status?: "alpha"|"beta"|"deprecated"`
  - `experimental?`, `provider?`
  - `cost?: { input, output, reasoning?, cache_read?, cache_write?, input_audio?, output_audio?, tier?/tiers? }`
- Per README: `cost.*` is **USD per 1M tokens**; `limit.*` is in tokens.
- Compared with the brief, the extra fields are `description` (required), `family`, `limit.input`, `status`, `cost.reasoning`, `cost.input_audio`, `cost.output_audio`, `reasoning_options`, `interleaved` and `type`.

Example **(derived from `providers/anthropic/provider.toml` and `providers/anthropic/models/claude-sonnet-4-5.toml`; merged fields from `base_model` not shown)**:

```json
{
  "anthropic": {
    "id": "anthropic",
    "name": "Anthropic",
    "env": ["ANTHROPIC_API_KEY"],
    "npm": "@ai-sdk/anthropic",
    "doc": "https://docs.anthropic.com/en/docs/about-claude/models",
    "models": {
      "claude-sonnet-4-5": {
        "id": "claude-sonnet-4-5",
        "name": "…",
        "structured_output": true,
        "cost": { "input": 3, "output": 15, "cache_read": 0.3, "cache_write": 3.75 },
        "limit": { "context": 1000000, "output": "…" }
      }
    }
  }
}
```

Model-level fields such as `attachment`, `reasoning` and `modalities` are inherited from `models/anthropic/claude-sonnet-4-5.toml` via `base_model`. Exact merged values: **UNVERIFIED**.

---

## K. Priority-B tools

### K.1 DeepEval

- Upstream: https://github.com/confident-ai/deepeval. License Apache-2.0 (`LICENSE.md`). PyPI 4.2.6, Python `>=3.9,<4.0`.
- CLI: `deepeval test run <file>` (a `test` typer app in `deepeval/cli/main.py`). Individual flags were **UNVERIFIED** (`deepeval/cli/test.py` not found at the expected path).
- Result files (https://raw.githubusercontent.com/confident-ai/deepeval/main/deepeval/test_run/test_run.py):
  - `HIDDEN_DIR = $DEEPEVAL_CACHE_FOLDER` or `.deepeval`.
  - `.deepeval/.latest_run_full.json` is "Always" written as a rolling snapshot.
  - `test_run_<YYYYMMDD_HHMMSS>.json` goes to `results_folder` / `DEEPEVAL_RESULTS_FOLDER` when set.
  - `.deepeval/.latest_test_run.json` holds `{testRunData, testRunLink}`.
  - Files are serialized `by_alias=True, exclude_none=True`, i.e. camelCase keys.
- `TestRun` keys: `testFile, testCases[], conversationalTestCases[], metricsScores[], traceMetricsScores, testPassed, testFailed, runDuration, evaluationCost, datasetAlias, datasetId`, and others.
- `LLMApiTestCase` keys (`deepeval/test_run/api.py`): `name, input, actualOutput, expectedOutput, context, retrievalContext, toolsCalled, expectedTools, tokenCost, inputTokenCount, outputTokenCount, completionTime, tags, success, metricsData[], runDuration, evaluationCost, order, metadata, trace`.
- `MetricData` (`deepeval/tracing/api.py`): `name, threshold, success, score, reason, strictMode, evaluationModel, error, evaluationCost, inputTokenCount, outputTokenCount, verboseLogs`.

Example **(derived)**:

```json
{
  "testFile": "test_chat.py",
  "testPassed": 1,
  "testFailed": 0,
  "runDuration": 3.2,
  "evaluationCost": 0.0021,
  "testCases": [
    {
      "name": "test_case_0",
      "input": "Where is my order?",
      "actualOutput": "…",
      "success": true,
      "metricsData": [
        {
          "name": "Answer Relevancy",
          "threshold": 0.5,
          "success": true,
          "score": 0.92,
          "reason": "…",
          "strictMode": false,
          "evaluationModel": "gpt-4.1",
          "evaluationCost": 0.0021
        }
      ]
    }
  ]
}
```

- Security: `deepeval login` / Confident AI upload sends results to a hosted service. Telemetry opt-out env var is **UNVERIFIED** (`deepeval/telemetry.py` not found).

### K.2 Inspect AI

- Upstream: https://github.com/UKGovernmentBEIS/inspect_ai. License MIT. PyPI `inspect-ai` 0.3.268, Python `>=3.10`.
- Formats (https://raw.githubusercontent.com/UKGovernmentBEIS/inspect_ai/main/docs/eval-logs.qmd):
  - `.eval` is the default since v0.3.46. It is a binary format; the docs note compression and incremental sample access.
  - `.json` is plain JSON.
  - Select with `--log-format=json` or `INSPECT_LOG_FORMAT`.
  - Convert or dump with `inspect log dump` ("Print log file contents as JSON") or `read_eval_log()`.
  - `inspect log list --json`.
- `EvalLog` (https://raw.githubusercontent.com/UKGovernmentBEIS/inspect_ai/main/src/inspect_ai/log/_log.py):
  - Top level: `version (2)`, `status ("started"|"success"|"cancelled"|"error")`, `eval: EvalSpec`, `plan`, `results`, `stats`, `error`, `invalidated`, `log_updates`, `config_updates`, `tags`, `metadata`, `samples`, `reductions`.
  - `EvalSpec`: `eval_id, run_id, created, task, task_id, task_version, task_file, …, dataset, sandbox, model, …`
  - `EvalResults`: `total_samples, completed_samples, scores[]: EvalScore{name, scorer, reducer, scored_samples, unscored_samples, params, metrics{<name>: EvalMetric{name, value, params, metadata}}}, headline, metadata`
  - `EvalStats`: `started_at, completed_at, model_usage{<model>: ModelUsage}, role_usage, connection_limit_history`
  - `ModelUsage`: `input_tokens, output_tokens, total_tokens, input_tokens_cache_write, input_tokens_cache_read, reasoning_tokens, total_cost`

Example **(derived)**:

```json
{
  "version": 2,
  "status": "success",
  "eval": {
    "eval_id": "…",
    "run_id": "…",
    "created": "2026-09-25T10:00:00+00:00",
    "task": "buyer_task",
    "model": "openai/gpt-4.1-mini",
    "dataset": { "name": "…", "samples": 10 }
  },
  "results": {
    "total_samples": 10,
    "completed_samples": 10,
    "scores": [
      {
        "name": "match",
        "scorer": "match",
        "metrics": {
          "accuracy": { "name": "accuracy", "value": 0.8, "params": {} },
          "stderr": { "name": "stderr", "value": 0.13, "params": {} }
        }
      }
    ]
  },
  "stats": {
    "started_at": "2026-09-25T10:00:00+00:00",
    "completed_at": "2026-09-25T10:01:10+00:00",
    "model_usage": {
      "openai/gpt-4.1-mini": { "input_tokens": 5000, "output_tokens": 700, "total_tokens": 5700 }
    }
  }
}
```

- Adapters should shell out to `inspect log dump <file>` rather than parse `.eval` binary directly. The `.eval` container being a zip is **UNVERIFIED**.

### K.3 lm-evaluation-harness

- Upstream: https://github.com/EleutherAI/lm-evaluation-harness. License MIT (`LICENSE.md`). PyPI `lm-eval` 0.4.13, Python `>=3.10`.
- CLI (`docs/interface.md`): `lm-eval run --model hf --model_args pretrained=gpt2 --tasks hellaswag --output_path ./results/ [--log_samples]`.
- Output: `results_<date_id>.json` under the output path (`lm_eval/loggers/evaluation_tracker.py`).
- Schema (https://raw.githubusercontent.com/EleutherAI/lm-evaluation-harness/main/lm_eval/result_schema.py, `EvalResults` TypedDict):
  - `results{<task>: {alias, name?, sample_len?, "<metric>,<filter>": value, "<metric>_stderr,<filter>": value}}`
  - `groups`, `group_subtasks`, `configs`, `versions`, `n-shot`, `higher_is_better`, `n-samples`, `samples` (only with `--log_samples`)
  - `config{model, model_args, batch_size, device, limit, gen_kwargs, random_seed, …}`
  - `git_hash`, `date` (UNIX float), `pretty_env_info`, `transformers_version`, `lm_eval_version`
  - tokenizer fields
  - `model_source`, `model_name`, `model_name_sanitized`, `chat_template`, `task_hashes`, `total_evaluation_time_seconds` (string)

Example **(derived)**:

```json
{
  "results": {
    "hellaswag": {
      "alias": "hellaswag",
      "acc,none": 0.2891,
      "acc_stderr,none": 0.0045,
      "acc_norm,none": 0.3114,
      "acc_norm_stderr,none": 0.0046
    }
  },
  "versions": { "hellaswag": 1.0 },
  "n-shot": { "hellaswag": 0 },
  "higher_is_better": { "hellaswag": { "acc": true, "acc_norm": true } },
  "n-samples": { "hellaswag": { "original": 10042, "effective": 10042 } },
  "config": { "model": "hf", "model_args": "pretrained=gpt2", "batch_size": "8" },
  "git_hash": "abc1234",
  "date": 1790000000.0,
  "lm_eval_version": "0.4.13",
  "model_name": "gpt2",
  "total_evaluation_time_seconds": "812.4"
}
```

The `n-samples` sub-keys `original`/`effective` are **UNVERIFIED**; the schema only says "Original and effective (after limit) sample counts per task".

### K.4 PyRIT

- Upstream: **https://github.com/microsoft/PyRIT**. The Azure/PyRIT README says "PyRIT has moved!"
- License MIT ("Copyright (c) Microsoft Corporation"). PyPI `pyrit` 1.1.0, Python `>=3.10,<3.15`.
- Storage: SQLite memory, default file `pyrit.db` under `DB_DATA_PATH` (`pyrit/memory/sqlite_memory.py`). Backends are `IN_MEMORY`, `SQLITE`, `AZURE_SQL` (`doc/code/memory/0_memory.md`).
- Tables (`pyrit/memory/memory_models.py`): `PromptMemoryEntries`, `ScoreEntries`, `AttackResultEntries`, `ScenarioResultEntries`, `SeedPromptEntries`, `Conversations`, identifier tables, and others.
- `Score` (https://raw.githubusercontent.com/microsoft/PyRIT/main/pyrit/models/score/score.py):
  - `id, score_value (str), status, score_value_description, score_type ("true_false"|"float_scale"|"unknown"), score_category[], score_rationale, score_metadata, scorer_class_identifier, message_piece_id, scorable, timestamp, scored_expectation, objective, observation_ids`
- `AttackResult` (`pyrit/models/results/attack_result.py`):
  - `conversation_id, objective, attack_result_id, atomic_attack_identifier, last_response, automated_score, human_score, executed_turns, execution_time_ms, outcome ("success"|"failure"|"error"|"undetermined"), outcome_reason, timestamp, related_conversations, metadata, operator, operation, labels, targeted_harm_categories, error_message, error_type, error_traceback`
- **UNVERIFIED:** a file export API (`export_conversations` or similar). No `export` symbol exists in `pyrit/memory/memory_interface.py` on main. Adapters should read the SQLite DB read-only, or have a PyRIT script dump `AttackResult` / `Score` objects via pydantic `model_dump_json()`. That second approach is inferred from the pydantic models, not documented.

Example **(derived, `Score`)**:

```json
{
  "id": "2f1c…",
  "score_value": "true",
  "score_type": "true_false",
  "score_category": ["jailbreak"],
  "score_rationale": "Model provided disallowed instructions",
  "score_metadata": {},
  "message_piece_id": "8a9b…",
  "timestamp": "2026-09-25T10:00:00+00:00",
  "objective": "…"
}
```

### K.5 Langfuse (OTel ingestion)

- Upstream: https://github.com/langfuse/langfuse.
- **License:** MIT for the core. **"All content that resides under the `ee/`, `web/src/ee/`, and/or `worker/src/ee/` directories … is licensed under … `ee/LICENSE`"**, which is a commercial Enterprise License ("Certain parts of the periphery of Langfuse are commercially licensed"). That part is not OSI. Source: `LICENSE`, `ee/LICENSE`.
- SDK: PyPI `langfuse` 4.15.6 (MIT).
- OTLP endpoint: `POST <host>/api/public/otel/v1/traces` (route file `web/src/pages/api/public/otel/v1/traces/index.ts`).
  - Auth: HTTP Basic with public key and secret key (`Basic …` handling in `web/src/features/public-api/server/apiAuth.ts`). Bearer with the public key only is "limited scope".
  - Accepted content types (protobuf vs JSON): **UNVERIFIED**. gRPC support: **UNVERIFIED** (no gRPC route seen).
- Attributes Langfuse maps (string literals in `packages/shared/src/server/otel/OtelIngestionProcessor.ts`):
  - GenAI: `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.system`, `gen_ai.operation.name`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.usage.prompt_tokens`, `gen_ai.usage.completion_tokens`, `gen_ai.usage.cost`, `gen_ai.input.messages`, `gen_ai.output.messages`, `gen_ai.conversation.id`, `gen_ai.tool.name`, …
  - OpenInference: `llm.model_name`, `llm.token_count.*`, `llm.cost.total`, `llm.input_messages`, `llm.output_messages`, `llm.invocation_parameters`
  - Vercel AI SDK: `ai.model.id`, `ai.model.provider`, `ai.usage.tokens`
  - Langfuse-native (`attributes.ts`): `langfuse.observation.model.name`, `langfuse.observation.usage_details`, `langfuse.observation.cost_details`, `langfuse.observation.type`, `langfuse.trace.name`, `langfuse.session.id`, `langfuse.user.id`, `langfuse.environment`, `langfuse.release`, …
- `gen_ai.provider.name` was **not** found in the processor source on the research date.

### K.6 Arize Phoenix and OpenInference

- Upstream: https://github.com/Arize-ai/phoenix.
- **License: Elastic License 2.0 (ELv2), non-OSI.** The LICENSE starts "Elastic License 2.0 (ELv2)"; the README says "licensed under the terms of the Elastic License 2.0". The PyPI `license_expression` is `Elastic-2.0`. Version 20.16.0.
- OTLP ingestion (`src/phoenix/config.py`, `src/phoenix/server/api/routers/v1/traces.py`):
  - HTTP `POST /v1/traces` on port **6006** (`PORT = 6006`). **Only `application/x-protobuf`**, per the error text "only `application/x-protobuf` is supported". `Content-Encoding` may be gzip or deflate.
  - gRPC on port **4317** (`GRPC_PORT = 4317`).
  - Env vars: `PHOENIX_PORT`, `PHOENIX_GRPC_PORT`, `PHOENIX_COLLECTOR_ENDPOINT`.
- Security: the default `HOST = "0.0.0.0"` binds all interfaces. Bind to `127.0.0.1` for local use.
- **OpenInference** attributes (https://raw.githubusercontent.com/Arize-ai/openinference/main/spec/semantic_conventions.md, Apache-2.0):
  - `openinference.span.kind` is required, with values `LLM, EMBEDDING, CHAIN, RETRIEVER, RERANKER, TOOL, AGENT, GUARDRAIL, EVALUATOR, PROMPT`.
  - Model: `llm.model_name`, `llm.request.model_name`, `llm.response.model_name`
  - Provider: `llm.provider`, `llm.system`
  - Tokens: `llm.token_count.prompt`, `llm.token_count.completion`, `llm.token_count.total`, `llm.token_count.prompt_details.cache_read`, `llm.token_count.prompt_details.cache_write`, `llm.token_count.completion_details.reasoning`
  - Cost: `llm.cost.prompt`, `llm.cost.completion`, `llm.cost.total`
  - Content and config: `llm.input_messages`, `llm.output_messages`, `llm.invocation_parameters`, `llm.finish_reason`
  - Context: `session.id`, `user.id`

### K.7 OpenTelemetry GenAI semantic conventions

- These moved to **https://github.com/open-telemetry/semantic-conventions-genai** (Apache-2.0). The old `docs/gen-ai/gen-ai-spans.md` in `semantic-conventions` now says "Moved".
- Registry: https://raw.githubusercontent.com/open-telemetry/semantic-conventions-genai/main/docs/registry/attributes/gen-ai.md. All of the following are status **Development**:
  - `gen_ai.provider.name` (e.g. `openai`)
  - `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.response.id`
  - `gen_ai.operation.name` (`chat`, `generate_content`, `text_completion`, …)
  - `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.usage.cache_read.input_tokens`, `gen_ai.usage.reasoning.output_tokens`
  - `gen_ai.system_instructions`
- **`gen_ai.system` is deprecated.** In `semantic-conventions/model/gen-ai/deprecated/registry-deprecated.yaml` its note reads "Replaced by `gen_ai.provider.name`". Emit `gen_ai.provider.name`. Also emitting `gen_ai.system` for older backends (Langfuse maps it) is optional.

Minimal span attribute set for buyer-arena exports **(derived; satisfies both conventions)**:

```json
{
  "gen_ai.operation.name": "chat",
  "gen_ai.provider.name": "openai",
  "gen_ai.request.model": "gpt-4.1-mini",
  "gen_ai.response.model": "gpt-4.1-mini-2025-04-14",
  "gen_ai.usage.input_tokens": 1200,
  "gen_ai.usage.output_tokens": 35,
  "openinference.span.kind": "LLM",
  "llm.model_name": "gpt-4.1-mini-2025-04-14",
  "llm.provider": "openai",
  "llm.token_count.prompt": 1200,
  "llm.token_count.completion": 35,
  "llm.token_count.total": 1235
}
```

---

## L. Consolidated UNVERIFIED items

1. Promptfoo: the docs example of JSON output contradicts `OutputFile`. The type was used.
2. garak: whether API keys in YAML generator configs are redacted from the `start_run setup` entry.
3. Gitleaks: Fingerprint string format.
4. Trivy: exact severity string set from source; `--skip-db-update` behaviour with an empty cache; whether secret and license scanners need no network; masking of secrets in `Match`.
5. Nuclei: per-GHSA pages for CVE-2026-76803/4/5 (versions come from the GitLab Advisory DB); `Classification` sub-keys; the template signing CLI.
6. Browser Use: serialized `AgentHistoryList` JSON fixture.
7. Stagehand: token-usage field names inside v4 `metadata`; v3 (3.7.3) API shapes.
8. OpenCode: cost unit (assumed USD).
9. OpenRouter: `X-Title` legacy header; `usage: {include: true}` (absent from the current spec); whether `cost` is always populated; the auth security scheme.
10. Models.dev: live `api.json` (blocked); merged `base_model` values.
11. DeepEval: `deepeval test run` flags; telemetry opt-out variable.
12. Inspect: whether the `.eval` container is a zip.
13. lm-eval: `n-samples` sub-key names.
14. PyRIT: file export API.
15. Langfuse: OTLP content types and gRPC support; `gen_ai.provider.name` mapping.
