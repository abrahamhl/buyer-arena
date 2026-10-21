# Buyer Arena — executed browser personas and operator evidence

Date: 21 October 2026. Audit branch: `feat/evidence-real-buyer-arena-audit-20261021`. Draft PR [#16](https://github.com/abrahamhl/buyer-arena/pull/16).

## Verified execution, not a persona opinion poll

- [Campaign #39532195525](https://github.com/abrahamhl/buyer-arena/actions/runs/39532195525): **20 scripted synthetic buyer personas × 2 versions = 40 actual Playwright/Chromium browser journeys**, browser screenshots/events and `run.json` recorded. **23 completed, 16 abandoned, 1 step limit**. These counts combine baseline and candidate; they are not unique paying customers.
- A JSON Lines file records **one evidence-backed entry for every executed buyer-version journey**. It includes archetype, scenario, goal, observed status, abandonment reason, event IDs and source run paths. There are also five launch-panel records. All 45 first-round records are in the run's `buyer-arena-real-synthetic-browser-evidence` artifact, with an HTML report, Markdown report and original raw files. The artifact expires according to the GitHub Actions retention policy.
- Additional source changes add six professional operator log entries (technical founder, local model engineer, agent developer, MCP integrator, release manager, product manager) for 51 records total **only on reruns that explicitly verify all six logs**. Help-page probes must be labelled `COMMAND_HELP_ONLY_NOT_FULL_FUNCTIONAL_TEST`; never present these as complete product trials.
- [Trilingual site QA #39532795975](https://github.com/abrahamhl/buyer-arena/actions/runs/39532795975): the **public-state site generator** was actually tested in Chromium with 36 page/viewport/theme loads and 113 internal links inspected; the site QA step passed. This was a local build of `site/`, **not** a human review of the deployed GitHub Pages URL.
- [Full security/unit suite on same run](https://github.com/abrahamhl/buyer-arena/actions/runs/39532795975) yielded **304 passing tests and one optional skipped** after clarifying the security test's two independently enforcing layers. Its overall run was still red because a CI script wrote the literal escaped newline into the stored exit code. That script has since been corrected; require an exact-head passing run before declaring the PR green.

## Five panels executed in launch-check

The built-in first-party `launch-check --demo --repo . --size 25 --seed 421 --depth quick` produced **75/100** overall on the fictitious store and local Buyer Arena repository:

| Panel                |      Score | Reality check                                                                                    |
| -------------------- | ---------: | ------------------------------------------------------------------------------------------------ |
| Synthetic end users  |     76/100 | Demo store navigation, not real product purchase intent                                          |
| Developers           |    100/100 | Automated repo review, not a senior engineer sign-off                                            |
| Commercial readiness |     79/100 | No external customer adoption or signed contract was observed                                    |
| Security             |     55/100 | Requires human review of each finding; `npm audit` was unavailable under explicit offline policy |
| Buyer segments       |     63/100 | Seeded synthetic users only; no population calibration                                           |
| **Overall**          | **75/100** | **SELF-AUDIT ONLY, NOT EXTERNAL VALIDATION**                                                     |

## Synthetic persona-specific observations reproduced from execution log

1. **Budget freelancer p-001**: both demo versions abandoned; the cheapest EUR 19 subscription exceeded this fictional persona's EUR 17 limit. Marketing would need an honest cheaper offer or tighter target segment; Buyer Arena itself should not invent a new product price.
2. **Agency operator p-002**: completed both flows; baseline took nine synthetic browser steps, candidate four. This is a scripted QA signal about journey friction.
3. **Non-technical owner p-003**: baseline abandoned because the price was not discoverable; candidate completed in four steps.
4. **On-the-go tradesperson p-004**: baseline abandoned due to a required phone number; candidate abandoned because a popup obstructed the page. A functional regression survived the version update.
5. **Cautious finance lead p-005**: baseline abandoned on an unacceptable non-refundable term; candidate completed in four steps.

These are **deterministic synthetic browser policies**, not human feelings or handwritten customer comments. Other actors have their own raw `run.json` and per-actor JSONL record inside the referenced GitHub artifact; aggregate anecdotes do not replace those files.

## Architecture/features covered vs unverified

**Executed:** CLI `doctor`, model catalogue listing, command interfaces, browser demo comparison, five launch panels, generator/visual QA of static multilingual site, 304 unit/integration checks (per cited run), and per-actor evidence export.

**Not externally executed:** a recruited human panel; a live production customer project; independent AI-assisted buyer critique using a paid model in this campaign; third-party connectors needing credentials (OpenCode, Anthropic, OpenRouter, garak, Trivy, etc.); security pentest; stress/load test. A command `--help` is not execution of its full feature, and the first-party scoring engine is not third-party assurance.

## Release decision and next evidence gate

- Keep PR #16 **draft** and main untouched. Use strict `npm ci`, exact GitHub SHA, all four Linux/Windows × Node CI cases, and browser audit artifacts as merge conditions.
- Recruit actual opt-in researchers, SaaS founders, UX specialists, DevOps/QA practitioners and security engineers for five unbiased task-based sessions each. They should enter their own feedback and consent to retention. No agent-authored text should be misrepresented as their comments.
- Validate at least one external target with authorization, pre-registered success criteria, failure traces, and a human-confirmed reproduction. Compare test outcomes with synthetic predictions; only then make calibration or conversion-accuracy claims.
