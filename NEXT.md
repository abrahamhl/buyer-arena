# Next (highest ROI first)

1. Push to GitHub, let CI run on ubuntu + windows, fix anything platform-specific; add the real repo URL to README/SECURITY/issue config.
2. Run one bounded live LLM session (`--buyer anthropic:claude-haiku-4-5 --budget 0.25 --max-buyers 5`) with a valid key; compare LLM vs heuristic journeys on the demo and document agreement.
3. Record a 20-second GIF of `npm run demo` + report for the README (assets/demo/).
4. Promptfoo provider plugin + DeepEval export (currently documented as planned).
5. i18n keyword packs for the heuristic buyer (ES/DE/FR) and a Browser Use sidecar example.
