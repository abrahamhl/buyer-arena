# Pricing, licences and ROI

> **Status: PRICES APPROVED BY THE PROJECT OWNER (2026-09-26) — NOTHING IS ON SALE YET.** There
> is no legal entity, no payment provider and no hosted service yet. The open-source core is the only
> product that will exist at public launch; services follow once the entity exists. Prices are in
> euros and exclude VAT. This page is the single source of truth: the website (`site/pricing.mjs`)
> and the README must match it, and `site/qa.mjs` fails the build if they drift.

Market anchors behind every number: [`docs/research/PRICING_BENCHMARK.md`](research/PRICING_BENCHMARK.md)
(verified vs provisional sources are tagged there).

## 1. Principles

1. **The core is complete and free, forever.** Everything that runs on your machine or your own CI
   stays Apache-2.0: all panels, all integrations, Studio, MCP, `agent-eval`, the PR workflow,
   calibration metrics. No feature is removed from the core to create a paid tier.
2. **Pay for what we operate, not for what you run.** Paid tiers charge for hosted compute, storage,
   collaboration, compliance and people's time — the things that cost us money.
3. **No per-seat tax.** Paid cloud tiers include unlimited users (the market is moving this way:
   Langfuse, Arize, Helicone, Momentic). The meter is the **journey run**.
4. **Model tokens are never hidden inside our price.** Bring your own key or a local model; if we
   ever resell tokens, they are passed through at provider cost and shown as a separate line.
5. **Honest labels.** Nothing is advertised as available before it is. Pre-launch, the website
   shows prices as a preview with no buy button.

**Journey run** = one synthetic buyer attempting one journey on one version of your product in a
hosted browser, with its events, screenshots and evidence stored. A 20-buyer baseline-vs-candidate
comparison uses 40 journey runs.

## 2. Plans

| Plan              | Price                           | Status                      | Licence / contract                                       |
| ----------------- | ------------------------------- | --------------------------- | -------------------------------------------------------- |
| **Community**     | **€0**, forever                 | At public launch            | Apache-2.0 (code) + [trademark policy](../TRADEMARKS.md) |
| **Cloud Starter** | **€29 / month**                 | Planned — after launch      | Cloud Terms of Service + DPA (proprietary service)       |
| **Cloud Team**    | **€249 / month**                | Planned — after launch      | Cloud Terms of Service + DPA (proprietary service)       |
| **Enterprise**    | **from €2,500 / month**, annual | Planned — after launch      | Commercial licence for enterprise add-ons + MSA + DPA    |
| **Services**      | fixed fee, see §3               | After a legal entity exists | Services agreement / statement of work                   |

Annual billing on Cloud plans: two months free (pay 10, get 12).

### Community — €0

- The whole Apache-2.0 repository: CLI, Studio, five panels, launch-check, `agent-eval` /
  `agent-compare`, lifecycle gates, PR workflow on your own runners, static `audit-repo`, MCP server,
  every integration adapter, Evidence Protocol v1, calibration metrics.
- Local and bring-your-own models (LM Studio, Ollama, OpenAI-compatible, Anthropic, OpenAI,
  OpenRouter, OpenCode). Unlimited runs — they are your machine's runs.
- Support: GitHub issues and discussions, best effort.

### Cloud Starter — €29 / month (planned)

For a solo builder or a small team that does not want to run browsers themselves.

- **1,000 journey runs / month** included (≈ 25 comparisons of 20 buyers), then **€4 per 100** runs.
- 3 projects, 30-day report retention, shareable report links, unlimited users.
- Hosted PR comment for **public** repositories.
- Bring your own model key, or deterministic heuristic buyers at no token cost.

### Cloud Team — €249 / month (planned)

- **10,000 journey runs / month** included, then **€3 per 100** runs.
- Unlimited projects, 1-year retention, team dashboards and run history.
- Hosted PR gate for **private** repositories; `agent-eval` benchmark history across agents.
- Calibration workspace: upload aggregate outcomes, track error and calibration state over time.
- Email support, next business day.

### Enterprise — from €2,500 / month, annual (planned)

- Everything in Team with volume pricing on journey runs.
- SSO/SAML, SCIM, audit logs, role-based access.
- Self-hosted or VPC control plane, EU data residency, custom retention.
- SLA, DPA, security review support, named contact.

## 3. Services (fixed fee)

Available once a legal entity exists. Delivered with the open-source tool, so every finding is
reproducible by the customer afterwards.

| Service                 | Price                 | What you get                                                                                                            |
| ----------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Launch Audit**        | **€1,900**            | One product, baseline vs candidate, all five panels, security/eval adapters, written report and a 60-minute review call |
| **Agent Benchmark**     | **from €4,900**       | Two to four AI coding agents on your repository, isolated worktrees, raw evidence, gates, recommendation                |
| **Calibration Setup**   | **from €2,900**       | Map your aggregate analytics to Buyer Arena's calibration input, first calibration report, error targets                |
| **Self-hosted support** | **from €500 / month** | Support contract for teams running the Apache core in production                                                        |

Anchor: one human usability round costs about $1.1k–3.3k (unmoderated) or $2.8k–5.3k (moderated)
all-in, including researcher hours (NN/g figures, see the benchmark §6.1). A Launch Audit is priced
inside that envelope; it **complements** human research, it does not replace it.

## 4. Discounts

- **Open-source projects and non-profits:** Cloud Team free (fair-use cap on runs).
- **Students and educators:** Cloud Starter free.
- **Early-stage startups:** 50% off Cloud plans for the first year.
- **Design partners** (first external users who share a case study): services at cost.

## 5. Other ways the project is funded

- **Sponsorship** (planned at public launch): individual and company sponsorship of the Apache core.
  Sponsorship never buys roadmap control or ranking in reports.
- **Grants for open-source and public-interest software** — see `docs/project/FUNDING_PLAN.md`.
- **Future, separate and opt-in:** an aggregate calibration benchmark built only from data customers
  choose to contribute. It does not exist, contains no data today, and will live outside this
  repository (see `LICENSE_STRATEGY.md`).

## 6. ROI for customers — how to calculate it yourself

Buyer Arena measures **evidence and a conversion proxy**, not revenue. Use the formulas below with
your own numbers; treat uncalibrated results as directional.

| Path                          | Formula (per year)                                                                       | Where the input comes from                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **A. Research spend avoided** | rounds you would otherwise run × all-in cost per round                                   | Your research budget; NN/g ranges as a sanity check                                   |
| **B. Conversion recovered**   | monthly visitors × Δ conversion × value per conversion × 12 × confidence factor          | Δ = the **lower bound** of the reported interval; confidence ≤ 0.5 while UNCALIBRATED |
| **C. Engineering time saved** | hours of regression hunting / manual QA avoided × loaded hourly cost                     | Your incident and QA logs                                                             |
| **D. Model spend avoided**    | tokens avoided by the exact cache, routing and local models × your provider price        | `economy` report in every run                                                         |
| **E. Agent choice**           | hours saved by picking the agent whose changes pass gates, from `agent-compare` evidence | Your agent logs                                                                       |

**ROI = (A + B + C + D + E − Buyer Arena cost) ÷ Buyer Arena cost.** With the Community plan the cost
is your compute and your time.

### Worked example — ILLUSTRATIVE, NOT A CUSTOMER RESULT

A team on Cloud Team pays €249 × 12 = **€2,988 / year**.

- **A.** It skips 2 of its 6 unmoderated usability rounds per year at a conservative €1,000 each:
  **€2,000**.
- **B.** A sign-up fix found before launch; the run's lower bound is +0.5 pp on the proxy. With
  20,000 visitors/month, a real uplift of only **0.1 pp**, €40 per conversion and a 0.5 confidence
  factor: 20,000 × 0.001 × €40 × 12 × 0.5 = **€4,800**.
- **C.** 20 hours of regression hunting avoided at €60/hour: **€1,200**.

Total ≈ €8,000 → ROI ≈ (8,000 − 2,988) ÷ 2,988 ≈ **168%** (every euro spent returns about €2.68). If path B is zero, A + C alone
is €3,200: roughly break-even. The example shows the method, not a promise.

## 7. How Buyer Arena makes money (business model)

| Stream                 | Type              | Gross margin driver                 | When                         |
| ---------------------- | ----------------- | ----------------------------------- | ---------------------------- |
| Cloud subscriptions    | recurring         | browser minutes and storage per run | after launch + entity        |
| Journey-run overage    | usage             | same                                | after launch + entity        |
| Enterprise licences    | recurring, annual | support and compliance effort       | after first Team customers   |
| Services               | one-off           | founder / partner time              | first — needs only an entity |
| Self-hosted support    | recurring         | time                                | after public launch          |
| Grants and sponsorship | non-dilutive      | —                                   | see the funding plan         |

Order of operations: services first (cash and case studies with no infrastructure), then Cloud
Starter/Team once hosted runs are sandboxed, then Enterprise.

## 8. Before anything is sold (blockers)

1. Legal entity (e.g. Dutch BV or eenmanszaak) and VAT registration.
2. Payment provider, Terms of Service, privacy policy and DPA reviewed by counsel.
3. Hosted, sandboxed run infrastructure (does not exist today).
4. Re-verify the provisional competitor prices in `PRICING_BENCHMARK.md` in a browser.
