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
   - writes the **observed fact** from the cluster counts, never from auditor text;
   - labels the interpretation as an **inference** only when at least two non-red-team auditors support it and the red team did not challenge it; otherwise it is a **hypothesis**;
   - lowers confidence when a finding is challenged, and lowers severity when the challenge is about too little evidence.

"Did not complete" is co-occurrence, not proof of causation. A buyer can hit a pop-up and later
leave over price. The report says "_N of them did not complete the goal_". It never says "_caused N losses_".

## 3. Comparison statistics

- **Pairing.** Both variants are run with the same personas. Only personas with a finished run on both sides are paired, and excluded personas are reported.
- **Delta interval.** A paired percentile bootstrap resamples personas with replacement (2,000 iterations, seeded, so the result is reproducible) and reports the mean difference with a 95% interval.
- **Rates.** 95% Wilson score intervals, which behave well for small n and for rates of 0% or 100%.
- **Labels.** Below 30 pairs a result is always an **EXPLORATORY SIGNAL**. At 30 or more pairs, an interval that excludes 0 is a **CONSISTENT SYNTHETIC EFFECT**; otherwise the result is **INCONCLUSIVE**.
- **What the interval means.** It describes variability across _this synthetic population_. With the deterministic buyer, re-running gives identical journeys, so the interval reflects persona diversity, not behavioural randomness. It says nothing about how real customers would respond.

## 4. ROI score

```
score = 100 × frequency × severity × (0.5 + 0.5 × goal_impact) × (0.75 + 0.25 × segment_breadth)
            × confidence × (0.5 + 0.25 × reversibility + 0.25 × testability) / effort_cost
```

The score is unitless: without revenue data no money is claimed. Effort, reversibility and
testability come from the playbook defaults in `src/auditors/playbook.ts`, which teams should
override. Items that describe the measurement itself (funnel leak, variant delta) or restate a
symptom (segment gap) are shown as findings but are left out of the backlog.

## 5. Calibration (aggregates only)

`CalibrationInputSchema` accepts segment shares, objection shares and funnel rates, together with
the minimum group size behind them (at least 10). It has no field for an individual record.
`calibrate()` turns these into population weights and objection prevalence. `calibrationError()`
reports the simulated rate against the real rate for each funnel stage, plus a real/simulated
correction factor. That factor is recorded as metadata and is **not** applied to results.

## 6. Known limitations

- The deterministic buyer is a model of behaviour, not a human. Its objections come from persona configuration, and the red team says so for every objection-driven finding.
- LLM buyers add behavioural variety but also model bias. Compare them against the deterministic baseline before trusting them.
- Keyword heuristics (for example "pricing", "start trial") are written for English sites.
