# Buyer Arena Evidence Protocol v1

Source of truth: [`src/evidence/envelope.ts`](../src/evidence/envelope.ts) (zod schema
`EvidenceEnvelopeV1Schema`). Storage: JSON Lines (`evidence.jsonl`), one validated envelope per
line, appended idempotently by `id`.

## Envelope

| Field                                          | Type                                                                                        | Meaning                                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `id`                                           | string                                                                                      | `<source>:<16 hex>` — content-addressed from `raw_digest` when a raw record exists (re-importing never duplicates) |
| `schema_version`                               | `"1"`                                                                                       | protocol version                                                                                                   |
| `source`, `source_version`, `source_kind`      | string, string\|null, `builtin·native·sidecar·import·otel`                                  | who produced it and how it arrived                                                                                 |
| `categories`                                   | `product·browser·model·agent·security·quality·accessibility·performance·observability` (≥1) | what it is about                                                                                                   |
| `target`                                       | `{repo?, commit?, url?, run?, model?, agent?}`                                              | what was evaluated                                                                                                 |
| `finding_type`                                 | string                                                                                      | stable machine id, e.g. `secret.aws-access-token`, `llm.redteam.harmful:hate`, `friction.popup_interrupts`         |
| `title`                                        | string?                                                                                     | short human label (never raw tool output)                                                                          |
| `severity`                                     | `info·low·medium·high·critical`                                                             | normalised from the source's scale                                                                                 |
| `confidence`                                   | 0..1                                                                                        | how sure the SOURCE is — not a calibrated probability                                                              |
| `claim_type`                                   | `observed·inferred·hypothesis`                                                              | measured, derived, or to be tested                                                                                 |
| `passed`                                       | boolean\|null                                                                               | pass/fail when the evidence is a test; null otherwise                                                              |
| `deterministic`, `offline`, `network_accessed` | boolean                                                                                     | reproducibility and privacy facts                                                                                  |
| `evidence_refs`, `artifact_refs`               | string[]                                                                                    | links to journey events / other envelopes; local paths of raw artifacts (never inlined)                            |
| `location`                                     | string?                                                                                     | file:line, URL, probe… (never a secret)                                                                            |
| `duration_ms`, `usage`                         | number\|null, `{input_tokens, output_tokens, cached_tokens, estimated_cost_usd}`\|null      | cost accounting                                                                                                    |
| `provenance`                                   | `{tool, version, config_digest, timestamp}`                                                 | reproducibility                                                                                                    |
| `raw_digest`                                   | `sha256:<hex>`\|null                                                                        | digest of the raw record (secret-bearing fields removed before hashing)                                            |
| `attributes`                                   | map of scalars                                                                              | small, redacted, source-specific details                                                                           |

## Rules

- **No raw third-party output in core records.** Store the normalised envelope, the digest and,
  optionally, the path of the tool's own report.
- **Secrets never enter evidence.** Adapters drop `Secret`/`Match`/`Code` fields and keep a
  12-hex fingerprint (`fp:…`) so duplicates can be correlated.
- **Prompts, model outputs and customer data are not copied** (Promptfoo vars/outputs, garak
  attempts, trace message bodies).

## Stability expectations

- v1 fields are **append-only**. Consumers must ignore unknown fields (the schema accepts them).
- Removing a field, changing its type or meaning, or changing an enum value's meaning requires
  `schema_version: "2"` plus a documented migration.
- Adapters have their own `manifest.version`; a change to how a tool's output is normalised bumps
  it, so evidence can be traced to the adapter logic that produced it.

## Producing and consuming

```bash
buyer-arena integrations import trivy trivy.json --out .buyer-arena/evidence/evidence.jsonl
buyer-arena evidence summarize .buyer-arena/evidence
buyer-arena gate .buyer-arena/evidence            # buyer-arena.yaml release.require
```

Sessions (`sessions/<id>/evidence.jsonl`), launch checks and `agent-eval` write the same format.
