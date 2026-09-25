# Models: catalog, router, cache, economy

`createProvider("provider:model")` is unchanged. The router only decides which spec to hand to it.

## Providers

`heuristic` (default) · `lmstudio:<m>` · `ollama:<m>` · `openai-compatible:<m>` (`OPENAI_BASE_URL`: vLLM,
llama.cpp server, LocalAI, other gateways — local when the URL is loopback/LAN) · `anthropic:<m>` ·
`openai:<m>` · `openrouter:<vendor>/<model>` · `opencode:<provider>/<model>` · `auto`.

- **OpenRouter**: explicit model ids are the default. `openrouter/auto`, `:free`, `:floor`,
  `:nitro` are **dynamic routes**: allowed only when pinned, labelled `DYNAMIC MODEL ROUTE —
NON-REPRODUCIBLE MODEL SELECTION`, never used by reproducible runs, never cached. The model
  that actually answered is taken from the response and recorded.
- **OpenCode** (optional): `opencode run --format json --model <p>/<m> --dir <empty tmp>`;
  requires ≥ 1.18.22 (GHSA-632h-h47v-g4x4); never `--auto`/`--yolo`; Buyer Arena never reads
  OpenCode's credential store; version, steps, tool calls, reported cost and exit code are recorded.

## Catalog

`buyer-arena models list | inspect <spec> | refresh`. Layers, later wins: built-in → optional
cached **Models.dev** snapshot (`~/.cache/buyer-arena/models-dev.json` or `BUYER_ARENA_CACHE_DIR`,
timestamped, flagged stale after 30 days; `refresh` needs `hybrid`/`online`) → your overrides:

```yaml
models:
  routing: economy
  overrides:
    'anthropic:claude-haiku-4-5': { input: 0.8, output: 4 } # USD per 1M tokens
```

## Router

`ModelRequestProfile {purpose, constraints, policy, pinned, reproducible, est_*}` →
`RoutingDecision {eligible, rejected (with reasons), selected, selection_reason, fallbacks,
expected_cost_usd, catalog_version, pinned, dynamic, warnings}`. Try it without any call:
`buyer-arena models route --purpose judge --routing quality --max-cost 0.05`.

- Policies: `offline` (local models only, else the deterministic path) · `economy` (cheapest
  eligible) · `balanced` (cheapest for buyer/extractor/summarizer, higher tier for
  auditor/critic/judge) · `quality` (highest tier within budget). List price is used as a
  documented capability proxy until Buyer Arena has its own benchmark history.
- Hard constraints: offline_only, allowed/denied providers, minimum context, vision, tools,
  structured output, max cost (unknown prices cannot prove they fit), observed latency.
- **Pinning:** a pinned model is honoured exactly or the request is refused.
- **Cascade:** `runCascade()` — deterministic → cheap → strong, escalating only when a tier's
  answer is not acceptable; escalations are counted.

## Cache and economy

Exact response cache: key = provider + endpoint + model + digest(system) + digest(messages) +
temperature + max tokens. Not used for temperature > 0, floating aliases, dynamic routes, or when
the returned model differs from the requested one. `--no-cache` disables it.

Every run prints and stores: MODEL COST · TOKENS · CACHE HIT RATE · ESCALATIONS · COST PER
FINDING · COST PER COMPLETED BUYER · ROUTING. The LLM buyer already sends a compact
observation (interactive elements + visible text blocks), never full HTML.
