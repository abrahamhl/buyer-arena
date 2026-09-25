# Next, highest ROI first

1. **Human launch audit** of this RC (Abraham + external reviewer): read
   `docs/project/RC_FINAL_REPORT.md`, run `npm run check`, try the offline demo.
2. **One bounded live LLM session** (`--buyer anthropic:claude-haiku-4-5 --budget 0.25
--max-buyers 5`) and an `ensemble` run heuristic × LLM on the demo; publish the agreement.
3. **First external case study** with an aggregate funnel from a real product → first
   PARTIALLY_CALIBRATED / CALIBRATED result.
4. **Benchmark agents with `agent-eval`** on a small public task set (same baseline, several
   agents), publish the method and raw evidence.
5. Go public: visibility change, npm publish, site `SITE_LAUNCH_STATE=public`.
