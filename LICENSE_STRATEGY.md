# License strategy

**Decision: Apache-2.0 for this repository.** Commercial value will come from a separately
licensed hosted and enterprise layer, not from restricting the core. The name and logo are
protected by trademark, not by the code license.

## Goals being traded off

1. **Adoption and stars.** Developers, companies and AI coding agents should be able to use the core without talking to legal.
2. **Commercial opportunity.** Hosted runs, team dashboards, CI integrations, calibration against private analytics, and enterprise controls such as SSO and audit logs.
3. **Protection against direct hosted cloning.** Stop a third party from offering "Buyer Arena as a service" built on our work without giving anything back.

## Options considered

| License                                                     | Adoption                                                                          | Commercial protection                           | Notes                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| **Apache-2.0**                                              | Highest; accepted by default at most companies; includes an explicit patent grant | None against hosting                            | Standard for dev tools (Playwright, promptfoo's core, many agent frameworks) |
| MIT                                                         | Highest                                                                           | None                                            | No patent grant; otherwise the same as Apache                                |
| AGPL-3.0                                                    | Medium to low; many companies ban it outright                                     | Strong: hosted forks must publish their changes | Deters exactly the teams most likely to pay                                  |
| BSL / FSL (source-available, converts to OSS after 2 years) | Medium; not OSI "open source", so some of the community objects                   | Strong against competing hosted services        | Good fit for the _hosted_ layer later                                        |
| Custom license                                              | Low                                                                               | Unclear                                         | Rejected: it costs trust, and lawyers must review it every time              |

## Why Apache-2.0 wins for the core

- The main risk for a new developer tool is being **ignored**, not being cloned. Friction at the license step reduces trials, integrations, MCP adoption and contributions.
- A hosted clone would need the parts that do not live in this repo: managed browser fleets, secure credential handling for customer staging environments, calibration connectors to analytics and CRM, historical benchmarks, and team workflow. That is where the moat is.
- The patent grant and the NOTICE mechanism make enterprise legal review easy.

## How commercial value is protected instead

- **Open core.** Hosted orchestration, dashboards, connectors and enterprise features live in a separate repository under a commercial license (or FSL if we want source availability).
- **Trademark.** "Buyer Arena" and the ▲ mark may not be used to brand forks or hosted services. A `TRADEMARKS.md` should be added before the first public release.
- **Contribution terms.** Contributions are accepted under Apache-2.0 inbound = outbound, with a DCO sign-off (see CONTRIBUTING.md). There is no CLA, to keep friction low. Revisit this only if dual licensing becomes necessary.

## Revisit when

- A well-funded competitor ships a hosted clone that outpaces us. Then consider moving **new** hosted-only modules to FSL. The core stays Apache-2.0, because relicensing the core would break trust.
- Enterprise customers ask for indemnification. Handle that in commercial contracts, not in the OSS license.

_This is an engineering and product recommendation, not legal advice. Confirm with counsel before the first public release._

## Calibration data and datasets stay separate

The long-term moat is calibration data, evaluation datasets, the integration ecosystem and
workflow adoption. Any future proprietary calibration dataset or hosted calibration service will
live **outside** this Apache-2.0 repository and connect through the same aggregate-only
calibration input and Evidence Protocol that anyone can use. This repository contains no
proprietary or fabricated data.

## Licence per plan

Prices and plans are in [`docs/PRICING.md`](docs/PRICING.md) (approved 2026-09-26; nothing is on sale yet).

| Plan                 | What the customer receives                         | Licence / contract                                                                                                    |
| -------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Community (€0)       | This repository                                    | **Apache-2.0**; name and ▲ mark under [`TRADEMARKS.md`](TRADEMARKS.md)                                                |
| Cloud Starter / Team | Access to a hosted service, not a copy of its code | **Cloud Terms of Service + Data Processing Agreement**; hosted code is proprietary and lives in a separate repository |
| Enterprise           | Hosted or self-hosted enterprise add-ons           | **Commercial licence** for the add-ons (or FSL if source-available) + MSA + DPA; the core stays Apache-2.0            |
| Services             | Work performed, report delivered                   | **Services agreement / statement of work**                                                                            |
| Reports and evidence | Everything a run produces about your product       | **Owned by the customer**, whatever the plan                                                                          |

No plan changes the licence of code already released under Apache-2.0.
