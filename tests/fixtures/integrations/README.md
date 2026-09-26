# Integration fixtures

Small files shaped exactly like each upstream tool's machine output, used by
`tests/unit/integrations.test.ts`. Origin of each shape (see `docs/research/UPSTREAM_CONTRACTS.md`):

| File                                                                        | Derived from                                                                          |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `promptfoo-results.json`                                                    | `OutputFile` type, promptfoo `src/types/index.ts` (+ red-team metadata)               |
| `garak.report.jsonl`                                                        | garak `command.py`, `attempt.py`, `evaluators/base.py`                                |
| `gitleaks.json`                                                             | upstream fixture `testdata/expected/report/json_simple.json` (+ one redacted finding) |
| `trivy.json`                                                                | trivy `pkg/types` structs (SchemaVersion 2)                                           |
| `nuclei.jsonl`                                                              | nuclei `pkg/output/output.go` `ResultEvent`                                           |
| `deepeval.json`, `inspect.json`, `lm-eval.json`, `pyrit.jsonl`, `otel.json` | §K of the research notes                                                              |
| `opencode.jsonl`                                                            | opencode `run.ts` `emit()` + SDK types                                                |

All values are synthetic. The "secrets" are fake strings that exist only to prove they never
reach Buyer Arena evidence.
