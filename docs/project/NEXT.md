# Next, highest ROI first

1. **Human launch audit** of this RC (Abraham + external reviewer): read
   `docs/project/RC_FINAL_REPORT.md` and `docs/project/OVERNIGHT_REPORT.md`, run
   `npm run check`, try the offline demo and the published live-LLM evidence.
2. **Fund an OpenRouter key** (the current one returns HTTP 402 "insufficient credits") so the
   documented `openrouter:*` path can be used, or standardise on `openai-compatible` (DeepSeek)
   as the default live provider.
3. **First external case study** with an aggregate funnel from a real product → first
   PARTIALLY_CALIBRATED / CALIBRATED result.
4. **Benchmark agents with `agent-eval`** on a small public task set (same baseline, several
   agents), publish the method and raw evidence.
5. **Sensitivity sweep** over the heuristic buyer's tunable thresholds (scroll budget, step budget,
   click thresholds) so reports can state how much the result depends on simulator tuning.
6. Go live: npm publish, site `SITE_LAUNCH_STATE=public`, and review/merge the open security +
   multilingual PR.
