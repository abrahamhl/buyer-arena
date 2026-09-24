<div align="center">

# ▲ BUYER ARENA

**Test your product with synthetic buyers before real customers find the problems.**

Seeded synthetic customers walk through your real website in a real browser. Every step is
recorded. Five independent auditors turn that evidence into a ranked experiment backlog, and
you can compare two versions of your product with the same buyers.

[![CI](https://img.shields.io/badge/CI-GitHub_Actions-2d5bff)](.github/workflows/ci.yml)
![License](https://img.shields.io/badge/license-Apache--2.0-4fe0c0)
![Node](https://img.shields.io/badge/node-%E2%89%A520-93a4b8)
![Paid APIs needed](https://img.shields.io/badge/paid%20APIs%20needed-none-4fe08f)

</div>

```bash
git clone https://github.com/abrahamhl/buyer-arena.git && cd buyer-arena
npm install           # also builds the CLI
npm run demo          # 20 buyers × 2 versions of a demo SaaS · 15–30 s · no API keys
```

The first run downloads Playwright's Chromium once (about 150 MB). You need Node 22.12 or newer.

![Buyer Arena report — light theme, Simple mode](assets/demo/report-hero.png)

<table><tr>
<td width="62%"><img src="assets/demo/report-dark.png" alt="Expert mode, dark theme"></td>
<td><img src="assets/demo/report-mobile-nl.png" alt="Mobile, Dutch"></td>
</tr></table>

**The report is a small app in its own right.** It is available in ES · EN · NL; every text switches, including buyer thoughts, findings and customer stories. It has a **Simple** mode with plain-language advice ("what happened · why · what to do now") and an **Expert** mode with intervals, auditors and the full evidence. A 6-step **in-app guide** walks you through it on first open. It also has light and dark themes and generated avatars for each synthetic customer (no real faces). It is one self-contained HTML file: Inter is embedded and nothing loads from third parties.

```text
  BUYER ARENA  ·  20 BUYERS  ·  5 SEGMENTS  ·  2 VARIANTS
  BASELINE → CANDIDATE   EXPLORATORY SIGNAL   CONVERSION PROXY

                                           BASELINE   CANDIDATE     DELTA   95% INTERVAL
  Goal completion                               40%         75%     +35pp   +15pp … +55pp
  Abandonment                                   60%         25%     −35pp   −55pp … −15pp
  Pricing found                                 75%        100%     +25pp   +10pp … +45pp
  Reached sign-up                               60%         75%     +15pp   −15pp … +45pp
  Runs with browser errors                      55%          0%     −55pp   −75pp … −35pp
  Friction events / buyer                      1.15        1.45     +0.30   −0.40 … +0.95
  Steps to goal (n=8 completed on both)         8.1           4      −4.1   −4.8 … −3.5
  Median steps (all journeys)                     7           4        −3

  TOP FRICTION (candidate)
    4/20  Pop-up interrupts the journey  NEW
    1/20  Cheapest plan above buyer budget
  RESOLVED vs baseline: JavaScript errors on the page · No refund / guarantee information before commitment · Buyers could not find pricing · Sign-up demands a phone number · Buyers loop back to pages already visited · Form rejected input (rules not shown up-front) · Buyers ran out of patience (step limit)

  NEXT EXPERIMENTS
  #1 Pop-up interrupts the journey                   7.8  HIGH-LEVERAGE EXPERIMENT
  #2 Cheapest plan above buyer budget                0.4  LOW
```

In the demo, the candidate fixes seven kinds of baseline friction. Among them are hidden pricing,
a required phone field, and missing refund terms. It also introduces a regression: a newsletter
pop-up whose close button falls off-screen on phones. The mobile segment still converts at 0%,
but the cause has changed. On the baseline those buyers left at the phone field; on the candidate
they leave at the pop-up. That becomes experiment #1, worth up to +20pp.

---

## Why

AI "persona feedback" tools ask a model whether it _likes_ your website. That measures what the
model thinks, not what happens on your site. Buyer Arena **measures first and interprets second**:

|                     | Opinion-poll personas             | **Buyer Arena**                                                                                |
| ------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------- |
| Input               | "What do you think of this page?" | Identity, budget, objections, device, time pressure, and a _task_                              |
| Output              | Adjectives                        | Clicks, forms, errors, abandonments, screenshots, Playwright traces                            |
| Findings            | Unfalsifiable                     | Each one cites event ids such as `candidate-p-004:e12`. A finding without evidence is rejected |
| Versions            | —                                 | The same seeded buyers run against baseline and candidate, with paired statistics              |
| Output for the team | A summary                         | A ranked `ROI_BACKLOG.md` with a visible scoring formula                                       |

Buyers are never told what changed, which version they are on, or what we hope will happen. Their
brief is built from an allow-list, and a leak check runs before every journey.

## Quickstart

```bash
npm install
npm run ba -- doctor                          # environment check (no network, no spend)
npm run demo                                  # bundled demo, fully offline
npm run ba -- replay candidate-p-004          # replay one buyer: run ids are <variant>-<persona>
npm run ba -- demo --open                     # rerun the demo and open the HTML report
```

`npm run ba -- <command>` runs the local CLI. `npm link` puts a `buyer-arena` command on your
PATH, which the examples below use. Do **not** run `npx buyer-arena` until the package is
published to npm: npx would fetch an unrelated package from the registry.

Against your own app (localhost or staging you own):

```bash
buyer-arena compare \
  --baseline  http://localhost:3000 \
  --candidate http://localhost:3001 \
  --success-text "welcome|trial is active" \
  --template saas --size 20 --seed 42 --open
```

Or scaffold a config with `buyer-arena init` and then run `buyer-arena compare --open`.

| Command                          | What it does                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| `demo`                           | Starts the demo SaaS (baseline + candidate), runs the comparison and writes the report     |
| `population generate`            | Deterministic population: `--template saas --size 100 --seed 42 -o buyers.yaml`            |
| `run` / `compare`                | Real browser journeys against one URL, or against baseline and candidate                   |
| `report` / `audit`               | Re-analyse a session; `audit --auditor anthropic:<model>` uses LLM auditors                |
| `replay <run>`                   | Terminal timeline of one journey; `--trace` opens the Playwright trace viewer              |
| `status` / `resume`              | Lists sessions and spend; resumes an interrupted session without redoing finished journeys |
| `calibrate <aggregates>`         | Simulated funnel vs. **aggregate** real funnel, per-stage error                            |
| `mcp`                            | MCP server for Claude Code, Cursor, Codex and other clients                                |
| `init` · `doctor` · `demo-store` | Scaffold config · check environment · serve the demo app by hand                           |

## How it works

```
TARGET URL ─┐
            ▼
POPULATION (seeded) → CUSTOMER STORIES → BUYER BRIEF (allow-list, leak-checked)
            ▼
REAL BROWSER JOURNEYS  (Playwright · same-origin only · bounded concurrency · resumable)
            ▼
EVENT TRACE  navigate · decision · click · fill · form_error · page_error · abandon · …
            ▼
DETERMINISTIC METRICS  completion · abandonment · funnel · loops · errors · steps
            ▼
FRICTION DETECTORS  → clusters with evidence ids
            ▼
5 INDEPENDENT AUDITORS  UX · Business · Engineering · Customer · Red team
            ▼
CONSENSUS  OBSERVED FACT  /  INFERENCE  /  HYPOTHESIS
            ▼
ROI BACKLOG + HTML REPORT + JOURNEY REPLAY
```

**Buyers.** The default buyer is a deterministic policy driven only by persona attributes:
literacy limits how far it scrolls, budget decides whether it leaves at the pricing page,
objections make it refuse phone fields or card-for-trial, and time pressure caps its steps. It
knows nothing about the site. The same seed gives the same journeys, so CI stays reliable. For
richer behaviour, switch the buyer to an LLM with `--buyer anthropic:claude-haiku-4-5`,
`openai:…`, `lmstudio:…` or `ollama:…`. Malformed model output falls back to the deterministic
buyer, and the fallback is recorded.

**Five auditors.** Each auditor gets the same evidence packet: metrics, friction clusters, and
failed and successful journeys with event ids. None of them sees another auditor's output. The
consensus stage then applies these rules:

- **Observed fact:** computed from events, never written by an auditor.
- **Inference:** backed by at least two _independent_ sources and not challenged by the red team.
  - The rule-based auditors share one detector, so together they count as one source.
  - The **counterfactual** is a second source: the same personas on the other version.
  - LLM auditors are a third.
  - With the deterministic buyer, the red team flags every finding that depends on the buyer's own parameters, so most interpretations stay **hypotheses** until an LLM buyer or real data backs them. This is deliberate.
- **Hypothesis:** everything else, including anything the red team challenges (sample size, one segment only, effects built into the persona configuration).

![Five auditors → consensus with evidence links](assets/demo/report-auditors.png)

![Friction with buyer quotes and evidence, in Spanish, with the in-app guide](assets/demo/report-guide.png)

## Evidence model

Each journey writes `run.json` (typed events), `story.json`, a screenshot for every step, and a
Playwright `trace.zip` for failed journeys. Every event has a stable id `<run>:e<n>`. Clicking
an evidence chip in the report opens that journey at that event:

![Journey explorer — replay any buyer, step by step](assets/demo/report-journey-explorer.png)

Passwords are masked in evidence. Card fields accept only a test number that the site itself
prints, so a synthetic buyer can never type real payment data.

## Comparison & statistics

- The same personas run on both versions, and deltas use a **paired bootstrap** (2,000 seeded resamples) over personas. Rates show 95% **Wilson** intervals.
- Below 30 pairs every result is labelled **EXPLORATORY SIGNAL**. Buyer Arena never uses the word "significant".
- Goal completion is a **CONVERSION PROXY**, not predicted revenue. The ROI backlog is a unitless leverage score: `frequency × severity × goal impact × breadth × confidence × reversibility/testability ÷ effort`. The formula is printed in every backlog.

Details and assumptions: [docs/METHODOLOGY.md](docs/METHODOLOGY.md).

## Providers & cost control

| Buyer / auditor                  | Spec                                  | Needs               |
| -------------------------------- | ------------------------------------- | ------------------- |
| Deterministic (default)          | `heuristic`                           | nothing             |
| Anthropic                        | `anthropic:claude-haiku-4-5`          | `ANTHROPIC_API_KEY` |
| OpenAI                           | `openai:gpt-4o-mini`                  | `OPENAI_API_KEY`    |
| Any OpenAI-compatible            | `openai-compatible:<model>`           | `OPENAI_BASE_URL`   |
| LM Studio / Ollama (local, free) | `lmstudio:<model>` · `ollama:<model>` | local server        |

- `--budget` sets a hard USD cap, $1 by default whenever an LLM is involved.
  - Each call's worst-case cost (2 characters per token plus the maximum output) is **reserved** before the call is sent.
  - Parallel buyers therefore cannot race past the cap.
  - Spend from earlier runs counts when a session is resumed.
- `--max-buyers`, `--max-parallel` (default 4, or 2 for LLM buyers), `--max-steps` and `--timeout` add further limits.
- Tokens (including cached), latency, number of calls and estimated cost are recorded per run and per session.
- Keys are read from the environment only. They are never taken as flags, never logged, and redacted from errors. The test suite runs with `BUYER_ARENA_OFFLINE=1`, which refuses paid providers.

## MCP

```jsonc
// .mcp.json (Claude Code), or the equivalent in Cursor / Codex. Build first with `npm run build`.
{
  "mcpServers": {
    "buyer-arena": { "command": "node", "args": ["/abs/path/to/buyer-arena/dist/cli/main.js", "mcp"] },
  },
}
```

Tools: `create_population`, `run_simulation`, `compare_variants`, `run_demo`, `inspect_run`,
`generate_report`, `get_findings`, `list_sessions`. Tools return compact summaries and evidence
ids, never raw traces. Because the MCP client supplies the URLs, targets are limited to
**localhost** unless you set `BUYER_ARENA_ALLOW_REMOTE=1`.

## Integrations

Browser Use and Browser Harness connect through `--engine-cmd`, an external engine that
exchanges JSON over stdin/stdout. [`examples/github-actions/pr-preview.yml`](examples/github-actions/pr-preview.yml)
runs Buyer Arena on every pull-request preview and comments the comparison on the PR. Promptfoo and DeepEval work through the documented JSON
outputs. None of these is required. See [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) for what is
implemented and what is planned.

## Privacy & safety

- Synthetic buyers only. Names are fictional first names with an initial, and there is no real customer data anywhere.
- Calibration accepts **aggregates only**: shares and rates, with a minimum group size of 10 or more. The schema has no field that could hold a person-level record.
- Journeys stay on the origin you supply. Off-site requests, redirects and pop-up windows are blocked and recorded. There is no crawling or discovery.
- Everything runs locally. The demo store binds to `127.0.0.1`.

## Architecture

A single TypeScript package (strict mode, ESM), organised as modules under `src/`: `personas`,
`stories`, `browser`, `simulator`, `engines`, `metrics`, `comparison`, `auditors`, `roi`,
`calibration`, `reports`, `providers`, `mcp`, `cli`, and `demo-store`. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). The public API is exported from `src/index.ts`.

## Roadmap

- [ ] LLM buyer benchmark: agreement between heuristic and LLM journeys on the same personas
- [ ] Calibration loop: store the correction metadata per segment and report drift
- [ ] Browser Use sidecar, packaged as a first-party example
- [ ] Multi-page task suites (onboarding, upgrade, cancellation)
- [ ] Hosted runs, shared dashboards and CI annotations on pull requests (commercial)

## Contributing & license

See [CONTRIBUTING.md](CONTRIBUTING.md). The project is licensed under Apache-2.0; the reasoning is in
[LICENSE_STRATEGY.md](LICENSE_STRATEGY.md). Report security issues as described in
[SECURITY.md](SECURITY.md).
