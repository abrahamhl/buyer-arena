# Launch checklist

Owner approval of prices: **2026-09-26**. This list separates what only the owner can do (legal,
money, irreversible publishing) from what is already prepared in the repository. Tick items in order;
each step unlocks the next.

## Track A — Sell services (fastest cash; the repository can stay private)

| #   | Step                                                                                      | Who                                | Status |
| --- | ----------------------------------------------------------------------------------------- | ---------------------------------- | ------ |
| A1  | Register an **eenmanszaak** at KvK (convert to BV at the first equity round)              | Owner                              | To do  |
| A2  | VAT number (arrives with KvK), business bank account, simple invoicing tool               | Owner                              | To do  |
| A3  | Services terms: scope, payment 50% upfront, liability cap, confidentiality, data deletion | Owner (counsel review recommended) | To do  |
| A4  | Pick 20–30 prospects using the profile in [`SALES_KIT.md`](SALES_KIT.md) §2               | Owner                              | To do  |
| A5  | Send personalised outreach (templates in `SALES_KIT.md` §4, ES/EN/NL)                     | Owner                              | To do  |
| A6  | Deliver the first 3 design-partner audits with the delivery template (`SALES_KIT.md` §6)  | Owner + tool                       | —      |
| A7  | Publish the first case study (with written permission)                                    | Owner                              | —      |

## Track B — Public launch of the open-source core (irreversible)

Order matters: the site's public build links to the repository, so the repository must be public first.

| #   | Step                                                                                                           | Who                                   | Status   |
| --- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------- |
| B1  | Human pre-launch audit of abrahamhl/buyer-arena#9 and abrahamhl/buyer-arena-site#1                             | Owner                                 | To do    |
| B2  | Merge abrahamhl/buyer-arena#9 into `main`                                                                      | Owner (or Claude on explicit request) | To do    |
| B3  | Change **abrahamhl/buyer-arena** visibility to public (GitHub → Settings → General → Danger Zone)              | **Owner only**                        | To do    |
| B4  | Tag `v0.2.0` and create the GitHub release (notes from `CHANGELOG.md`)                                         | Owner or Claude                       | To do    |
| B5  | `npm publish` (needs the owner's npm account and 2FA; run `npm pack --dry-run` first)                          | **Owner only**                        | To do    |
| B6  | Rebuild the site with `SITE_LAUNCH_STATE=public`, push to abrahamhl/buyer-arena-site#1, merge → GitHub Pages   | Claude builds, owner merges           | After B3 |
| B7  | Enable GitHub Sponsors on the owner account                                                                    | Owner                                 | Optional |
| B8  | Announce: Show HN, r/programming-adjacent communities, LinkedIn, Dutch dev meetups (text in `SALES_KIT.md` §5) | Owner                                 | After B6 |

## Track C — Non-dilutive funding (see `docs/project/FUNDING_PLAN.md`)

| #   | Step                                                                                      | Deadline                  | Needs            |
| --- | ----------------------------------------------------------------------------------------- | ------------------------- | ---------------- |
| C1  | NLnet CodeSupply proposal — draft in [`NLNET_PROPOSAL_DRAFT.md`](NLNET_PROPOSAL_DRAFT.md) | **3 Nov 2026, 12:00 CET** | B3 (public repo) |
| C2  | WBSO application for R&D from 1 Jan 2027                                                  | **20 Dec 2026**           | A1               |
| C3  | Y Combinator W2027 (optional; low odds, useful writing exercise)                          | 2 Nov 2026, 20:00 PT      | B3               |

Re-open every funder page before submitting: the research could not load most of them directly.

## What Claude will never do without an explicit instruction for that step

Change repository visibility, publish to npm, merge to `main`, send emails or applications, or put
the owner's contact details in public files.
