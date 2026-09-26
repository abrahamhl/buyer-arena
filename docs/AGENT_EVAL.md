# Agent run evaluation

Evaluate what a change produced, independent of who produced it.

```bash
buyer-arena agent-eval --repo . --before <base> --after <candidate> [--meta run.json] \
  [--build "npm run build"] [--test "npm test"] [--evidence promptfoo.jsonl …] \
  [--buyer-before 0.40 --buyer-after 0.75]
buyer-arena agent-compare .buyer-arena/agent-eval/<id-a> .buyer-arena/agent-eval/<id-b>
```

## AgentRunEnvelope (optional)

`src/agent/envelope.ts`: `agent {name, version}`, `provider`, `model`, `task`, `repo_before_sha`,
`repo_after_sha`, `duration_ms`, `usage {input_tokens, output_tokens, cached_tokens, cost_usd}`,
`tool_calls`, `artifacts`, `self_report {success, summary}`. A human commit needs none.

## What is measured

| Stage                  | Evidence                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| CODE                   | diff size; tests skipped / focused / marked xfail; test files deleted; net assertions removed; TODOs; lint regression                 |
| BUILD, TEST            | configured commands on both sides (throw-away worktrees, credentials stripped): PASS, WARN (already broken before), FAIL (regression) |
| SECURITY               | secret patterns in added lines (value never stored) + imported evidence (Gitleaks, Trivy…)                                            |
| AI EVAL, ACCESSIBILITY | imported evidence                                                                                                                     |
| BUYER                  | synthetic goal completion before → after                                                                                              |
| RELEASE                | `buyer-arena.yaml › release.require` gates; unmeasured inputs fail                                                                    |

Output quality score: `100 − 35·build regressed − 35·tests regressed − 25·critical security − 15·tests removed/skipped − 5·assertions removed − 10·buyer regression >5pp`, capped at 40 by any FAIL in build, test or security. `self_report_used_in_score` is always `false`.

Configure commands in `buyer-arena.yaml`:

```yaml
agent_eval:
  install: npm ci # reaches the registry: policy-checked
  build: npm run build
  test: npm test
  env_pass: [DATABASE_URL] # names only; everything else is stripped
```

Not sandboxed: build and test execute the repository's code. Use a container for untrusted output.
