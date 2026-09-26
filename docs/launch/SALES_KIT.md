# Sales kit — Launch Audit

Offer, target profile, outreach templates (ES/EN/NL), qualification questions and a delivery
template. Prices come from [`docs/PRICING.md`](../PRICING.md). **Nothing here is sent automatically.**
Replace every `[BRACKET]` before use; do not add claims the evidence does not support.

## 1. The offer (one paragraph)

**Launch Audit — €1,900, fixed fee, 5 working days.** Before you launch or merge a big change,
Buyer Arena sends synthetic buyers through your real product in a real browser. It checks your
repository and site with security and eval tools, and compares the current and the new version. You
get a written report where every finding points to a screenshot, a journey event or a file and line,
and a 60-minute review call. Everything runs with the open-source tool, so your team can re-run it
afterwards.

**Design-partner offer (first 3 customers):** `[PRICE — docs/PRICING.md says "at cost"; suggestion €490]`
in exchange for permission to publish an anonymised or named case study.

What it is **not**: a revenue forecast, a replacement for talking to real customers, or a
penetration test. Results are UNCALIBRATED until your own aggregate analytics are connected.

## 2. Who to contact first (ideal profile)

| Signal                                                                                    | Why it matters                                  |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Small SaaS or e-commerce team (2–30 people) with a launch or redesign in the next 8 weeks | Clear deadline, pain is concrete                |
| Builds with AI coding agents (Cursor, Claude Code, Copilot, Devin…)                       | Needs evidence before merging agent changes     |
| Agencies that ship sites for clients                                                      | Repeat audits, one relationship → many projects |
| Netherlands (Arnhem, Nijmegen, Utrecht, Amsterdam) or Spain                               | Local trust, same language                      |
| Has a public sign-up or checkout flow                                                     | The panels have something to measure            |

Where to find them: Product Hunt upcoming launches, Indie Hackers, local startup hubs (Gelderland:
Orion scouts, startup programmes at Radboud and HAN), agency directories, founders already in your network.

## 3. Qualification (5 questions)

1. What are you launching or changing, and when?
2. Is there a staging or preview URL we can visit? Any login needed (test account only)?
3. Can we read the repository (read-only) or only the public site?
4. Which step matters most (sign-up, checkout, onboarding)?
5. Who decides and who pays?

Stop if the only target is a production system with real payments and no test mode.

## 4. Outreach templates

Keep them short, personal and with **one** link: the real demo report. Send from a business address.

### English

> Subject: Before you launch [PRODUCT] — a quick evidence check
>
> Hi [NAME], I saw [SPECIFIC THING: launch date / new pricing page / redesign]. I build Buyer Arena,
> a tool that sends synthetic buyers through a real browser and checks the repo with security and
> eval tools, then reports what blocks people — each finding tied to a screenshot or file:line.
> Example report (fictional demo store): [DEMO REPORT LINK]
> I'm taking three design partners for a fixed-price launch audit before [DATE]. Worth a 15-minute call?
> [YOUR NAME]

### Español

> Asunto: Antes de lanzar [PRODUCTO] — una revisión con evidencias
>
> Hola [NOMBRE], he visto [COSA CONCRETA]. Desarrollo Buyer Arena: envía compradores sintéticos por
> un navegador real y revisa el repositorio con herramientas de seguridad y evaluación; el informe
> dice qué frena a la gente, con cada hallazgo ligado a una captura o a archivo:línea.
> Informe de ejemplo (tienda demo ficticia): [ENLACE AL INFORME DEMO]
> Busco tres socios de diseño para una auditoría de lanzamiento a precio cerrado antes de [FECHA].
> ¿Te encaja una llamada de 15 minutos?
> [TU NOMBRE]

### Nederlands

> Onderwerp: Vóór de lancering van [PRODUCT] — een check met bewijs
>
> Hoi [NAAM], ik zag [IETS CONCREETS]. Ik bouw Buyer Arena: het stuurt synthetische kopers door een
> echte browser en controleert de repository met security- en evaltools; het rapport laat zien wat
> mensen tegenhoudt, elke bevinding gekoppeld aan een screenshot of bestand:regel.
> Voorbeeldrapport (fictieve demowinkel): [LINK DEMORAPPORT]
> Ik zoek drie designpartners voor een lanceringsaudit tegen vaste prijs vóór [DATUM].
> Zin in een gesprek van 15 minuten?
> [JE NAAM]

Follow up once after 4–5 days. Stop after two messages.

## 5. Launch announcement (after the repository is public)

> **Buyer Arena — the evidence-first evaluation layer for software built by humans and AI agents.**
> Open source (Apache-2.0), offline-first. Real browser journeys with synthetic buyers, security and
> eval tools (Promptfoo, garak, Gitleaks, Trivy…) normalised into one portable evidence format, and a
> ledger of everything that left your machine. No API key needed for the demo. Honest limits: results
> are uncalibrated until you bring real aggregate data. [REPO LINK] · [DEMO REPORT LINK]

## 6. Delivery template (5 working days)

| Day | Work                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------- |
| 1   | Kick-off: goal, success text/URL, test account, network policy agreed in writing (default LOCAL)     |
| 2   | `launch-check` on baseline; security/eval adapters on the repository (if access)                     |
| 3   | Candidate run (if a new version exists) and comparison; review every finding against its evidence    |
| 4   | Write the report: top 5 fixes with evidence, what was **not** tested, calibration state              |
| 5   | 60-minute review call; hand over the commands so the team can re-run; delete customer data as agreed |

Deliverables: HTML report + PDF export, `evidence.jsonl`, the exact commands used, the network ledger.
Never include discovered secret values; report their location and type only.
