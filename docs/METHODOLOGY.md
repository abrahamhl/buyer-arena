# Methodology

This document covers how journeys are measured, how friction and findings are derived, how
variants are compared, how the ROI score works, how calibration works, and what Buyer Arena
explicitly does not claim.

## 1. What is measured

Every journey is a sequence of typed events (`src/core/types.ts`). Each event has the id
`<run>:e<seq>`, a step number, a timestamp and the URL. Metrics are pure functions of those events
(`src/metrics/run-metrics.ts`):

| Metric                | Definition                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| goal_completion       | The task's success regex matched the page text or URL                                                                    |
| abandonment           | The journey ended without reaching the goal (buyer quit, step limit or timeout), excluding infrastructure errors         |
| steps / steps_to_goal | Buyer decisions taken, or taken until the goal was reached                                                               |
| time_to_goal          | Wall-clock time of the _automation_. It is not a proxy for human reading time                                            |
| funnel reach          | The share of buyers reaching a stage **or any later stage** (monotone)                                                   |
| navigation_loops      | Returns to a page visited earlier (A → B → A)                                                                            |
| repeated_actions      | The same decision on the same target twice in a row                                                                      |
| dead_ends             | GET responses with 404 or 410                                                                                            |
| browser_errors        | Console errors, uncaught page errors, failed requests and 5xx responses (4xx on form POSTs counts as validation instead) |
| failed_forms          | Distinct validation alerts shown after a submit                                                                          |

## 2. From events to findings

1. **Detectors** (`src/metrics/friction.ts`) fire only when they can point at events. Each firing becomes a signal with its evidence ids.
2. **Clusters** group signals by variant and detector, then count affected buyers, buyers who did not complete the goal, and affected segments.
3. **Auditors** (`src/auditors/rules.ts`, or LLM auditors) each receive the same packet independently and produce structured findings: `finding`, `evidence_ids[]`, `affected_segments[]`, `severity`, `confidence`, `claim` and `proposed_experiment`.
4. **Consensus** (`src/auditors/consensus.ts`):
   - drops evidence ids that do not exist, and rejects findings that are left with none;
   - writes the **observed fact** from cluster counts or computed aggregates, never from auditor text. A statement from an LLM auditor with no matching computed aggregate is labelled _Unverified auditor statement_;
   - only accepts evidence ids that belong to the finding's own variant;
   - labels the interpretation as an **inference** only when at least two _independent sources_ agree and the red team did not challenge it; otherwise it is a **hypothesis**. The rule-based auditors all read the same detector output, so together they count as one source. The other sources are LLM auditors and the **counterfactual**: the same personas on the other variant (for example, 3 out of 3 buyers who left the baseline over missing pricing completed on the candidate);
   - lowers confidence when a finding is challenged, and lowers severity when the challenge is about too little evidence.

"Did not complete" is co-occurrence, not proof of causation. A buyer can hit a pop-up and later
leave over price. A friction counts as _blocking_ only when its evidence includes the journey's exit event (abandon, objection or timeout). The report says "_N ended their journey at it_". It never says "_caused N losses_".

## 3. Comparison statistics

- **Pairing.** Both variants are run with the same personas. Only personas with a finished run on both sides are paired, and excluded personas are reported.
- **Delta interval.** A paired percentile bootstrap resamples personas with replacement (2,000 iterations, seeded, so the result is reproducible) and reports the mean difference with a 95% interval.
- **Rates.** 95% Wilson score intervals, which behave well for small n and for rates of 0% or 100%.
- **Discordant pairs.** The report shows how many buyers flipped from failing to completing, and how many flipped the other way. The delta is exactly (gained − lost) / n.
- **Survivorship.** Steps to goal are compared only for personas who completed on both versions. Rows without an interval are descriptive and carry no verdict.
- **Labels.** Below 30 pairs a result is always an **EXPLORATORY SIGNAL**. At 30 or more pairs, an interval that excludes 0 is a **CONSISTENT SYNTHETIC EFFECT**; otherwise the result is **INCONCLUSIVE**.
- **What the interval means.** It describes variability across _this synthetic population_. With the deterministic buyer, re-running gives identical journeys, so the interval reflects persona diversity, not behavioural randomness. It says nothing about how real customers would respond.

## 4. ROI score

```
score = 100 × frequency × (0.1 + 0.9 × goal_impact) × confidence × (0.5 + 0.25 × reversibility + 0.25 × testability) / effort_cost
```

- `frequency × goal_impact` is the share of all buyers whose journey **ended** at this friction. This is the "if fixed" ceiling on recoverable goal completion.
- The score is therefore roughly _confidence-weighted percentage points of goal completion recoverable per unit of effort_.
- Friction that never ends a journey keeps a small weight (0.1), so hygiene issues still rank above zero.
- Labels: HIGH-LEVERAGE at 5 or more, MEDIUM at 2 or more.
- No money is claimed without revenue data.
- Effort, reversibility and testability are playbook defaults (`src/auditors/playbook.ts`) that teams should override.
- Items that describe the measurement itself (funnel leak, variant delta) or restate a symptom (segment gap) appear as findings but are left out of the backlog.

## 5. Calibration (aggregates only)

`CalibrationInputSchema` accepts segment shares, objection shares and funnel rates, together with
the minimum group size behind them (at least 10). It has no field for an individual record.
`calibrate()` turns these into population weights and objection prevalence. `calibrationError()`
reports the simulated rate against the real rate for each funnel stage, plus a real/simulated
correction factor. That factor is recorded as metadata and is **not** applied to results.

## 6. Known limitations

- The deterministic buyer is a model of behaviour, not a human. Its objections come from persona configuration, and several detectors depend on its parameters: the price-sensitivity threshold, the scroll budget, the step budget, and a pop-up tolerance of 2 attempts. The red team discloses this for every finding it affects. A sensitivity sweep over these parameters is on the roadmap.
- LLM buyers add behavioural variety but also model bias. Compare them against the deterministic baseline before trusting them.
- Keyword heuristics (for example "pricing", "start trial") are written for English sites.
