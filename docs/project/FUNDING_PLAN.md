# Funding plan — conditional on passing the pre-launch audit

> **Condition:** this plan only starts when the human pre-launch audit passes and the repository is
> public (gate G1 below). Until then, nothing is sent. **Nothing has been submitted and no one has
> been contacted.** Every application is written, reviewed and sent by the project owner.
>
> Evidence and every URL: [`docs/research/FUNDING_CHANNELS.md`](../research/FUNDING_CHANNELS.md)
> (researched 2026-09-25/26; most funder pages were read through search excerpts, so **re-open each
> link before applying**). Pricing and business model: [`docs/PRICING.md`](../PRICING.md).

Founder profile used for eligibility: solo founder, Spanish national living in Arnhem (Gelderland,
NL), no legal entity yet, Apache-2.0 core, pre-launch, no users, no revenue.

## 1. Shortlist, in order (non-dilutive first)

| #   | Candidate                                                                              | Money                                          | Next date (verify)                                | Fit | Needs gate            |
| --- | -------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------- | --- | --------------------- |
| 1   | **NLnet CodeSupply**                                                                   | €5k–€50k grant                                 | **3 Nov 2026, 12:00 CET**, then 3rd of odd months | 5   | G1, G3                |
| 2   | **WBSO** (Dutch R&D tax credit)                                                        | ~€16k deduction + ~€8k starter (self-employed) | apply by **20 Dec 2026** for 1 Jan 2027 start     | 5   | G2                    |
| 3   | **NLnet Restack** (separate work package)                                              | €5k–€50k grant                                 | 3 Nov 2026 / ~3 Jan 2027                          | 4   | G1, G3                |
| 4   | **Y Combinator W2027**                                                                 | $500k standard deal (dilutive)                 | **2 Nov 2026, 20:00 PT**                          | 4   | G1                    |
| 5   | **GitHub Secure Open Source Fund**                                                     | $10k + $10k Azure credits                      | rolling                                           | 4   | G1, G5                |
| 6   | **Startupfonds Gelderland** (via Orion scout)                                          | €30k–€100k loan                                | no deadline found                                 | 3   | G2                    |
| 7   | **MIT Gelderland** (feasibility)                                                       | €20k grant                                     | 2027 round (2026 budget gone on day 1)            | 3   | G2                    |
| 8   | **EIC Accelerator Step 1**                                                             | Step 1 is free; unlocks grant + equity later   | rolling, batched monthly                          | 3   | G1 (G6/G7 for Step 2) |
| 9   | Cloud credits: AWS Activate, Microsoft, NVIDIA Inception                               | in-kind credits                                | rolling                                           | 3   | G2                    |
| 10  | OSS/devtools investors: GitHub Fund, Seedcamp, Crane, Heavybit, OSS Capital, boldstart | pre-seed/seed equity                           | form or warm intro                                | 3   | G1, G5, G6            |

**Deprioritised for now (and why):**

- **ENISA, CDTI Neotec (Spain):** need a Spanish-domiciled company operating in Spain.
- **NGI Zero Commons/Core, Sovereign Tech Fellowship 2026, EIC Pathfinder 2026:** closed.
- **Sovereign Tech Fund, Alpha-Omega:** fund infrastructure others already depend on (gate G9).
- **Anthropic and Google AI credit tiers:** require institutional equity first (gate G8).

## 2. Readiness gates

| Gate | Done means                                                                  | Current state                      |
| ---- | --------------------------------------------------------------------------- | ---------------------------------- |
| G1   | Audit passed, repo public, npm package published                            | **Not yet** — awaiting human audit |
| G2   | Legal entity (KvK eenmanszaak first; BV at first equity), eHerkenning, bank | **Not yet**                        |
| G3   | FOSS work plan: 3–6 verifiable milestones with hours × rate budget          | Draft in §4                        |
| G4   | One documented live LLM run (local + cloud) with the network ledger         | **Not yet**                        |
| G5   | ≥ 5 external users, design partners or contributors                         | **Not yet**                        |
| G6   | One public case study on a real product, with permission                    | **Not yet**                        |
| G7   | 2–3 letters of intent for hosted/enterprise                                 | **Not yet**                        |
| G8   | First institutional cheque                                                  | **Not yet**                        |
| G9   | Third parties depend on Evidence Protocol                                   | **Not yet**                        |

## 3. 90-day sequence after the audit passes

| When        | Move                                                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Launch week | Register at KvK; eHerkenning; open sponsorship; AWS Activate Founders, Microsoft for Startups                                      |
| Weeks 1–3   | **NLnet CodeSupply** proposal (Evidence Protocol v1 + open security/eval adapters). Optional Restack proposal (agent-eval harness) |
| Weeks 1–4   | **WBSO** application for work starting 1 Dec 2026 or 1 Jan 2027 — WBSO only covers **future** R&D hours                            |
| By 2 Nov    | **YC W2027** application (doubles as the master pitch text)                                                                        |
| Weeks 2–6   | Orion Gelderland scout → Startupfonds Gelderland; prepare MIT Gelderland 2027 to file on opening day                               |
| Weeks 3–8   | NVIDIA Inception; EIC Accelerator Step 1 short proposal                                                                            |
| Weeks 4–10  | With ≥ 5 external users: GitHub Secure Open Source Fund                                                                            |
| Weeks 6–12  | Investor warm-up (form-based first); decide by week 12 whether to raise at all                                                     |

If the launch slips past ~25 Oct 2026, move the NLnet target to the ~3 Jan 2027 round.

## 4. Draft FOSS work plan (for NLnet / WBSO — owner to confirm hours and rate)

All deliverables Apache-2.0, publicly verifiable in the repository.

1. **Evidence Protocol v1 → 1.0 spec**: JSON Schema, conformance test suite, versioning policy.
2. **Security evidence adapters hardened**: Gitleaks, Trivy, garak, Promptfoo, Nuclei import — each
   with upstream-shaped fixtures and SBOM/licence-compliance evidence.
3. **Reproducibility**: signed, content-addressed evidence bundles; cosign verification of scanner binaries.
4. **Privacy ledger** as a reusable library: "what left this machine" for any eval tool.
5. **Agent-eval harness**: sandboxed before/after runs of AI coding agents, published benchmark method.
6. **Documentation and a public case study** with raw evidence.

## 5. Pitch outline (one deck, three emphases)

1. **Problem** — software is increasingly written by AI agents; teams merge and launch without
   evidence of what real buyers, attackers and reviewers would hit. Existing evals are fragmented.
2. **Product** — the evidence-first evaluation layer: real browser journeys, synthetic buyers,
   security/eval tools normalised into one portable evidence format; offline-first.
3. **Proof** — the real demo report; test suite and CI; network ledger. Self-audit shown **only**
   with its label "SELF-AUDIT — NOT EXTERNAL VALIDATION". Add G4–G6 evidence as it exists.
4. **Why now** — agentic coding, EU AI Act and supply-chain evidence duties.
5. **Business model** — open core; pricing in `docs/PRICING.md` (proposed, not on sale).
6. **Market anchors** — eval/observability, E2E/AI QA, UX research, security (benchmark doc).
7. **Ask and use of funds** — milestones from §4.
8. **Team** — solo founder; what was shipped and how fast.

Emphasis per channel: **OSS funds** → public-interest value of the open deliverable, milestones,
licence stays OSI; leave out SaaS revenue as the main story. **Public grants** → technical novelty
and risk, measurable objectives, NL/EU establishment. **Accelerators/VCs** → pain, why now, early
pull, open-core monetisation, founder speed.

## 6. Never claim in any application

- Users, customers, revenue, LOIs or case studies that do not exist.
- The self-audit score as external validation, or the demo delta as a real customer result.
- That the product is live, public or purchasable before it is.
- Funding programme details not re-verified on the official page on the day of submission.
