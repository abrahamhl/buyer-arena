# Next, highest ROI first

1. **Go public.** Make the repository public and enable private vulnerability reporting.
2. **Run one bounded live LLM session** with a valid key: `--buyer anthropic:claude-haiku-4-5 --budget 0.25 --max-buyers 5`. Publish how closely the LLM journeys agree with the heuristic journeys on the demo.
3. **Add a sensitivity sweep** (`buyer-arena sweep`) over the heuristic buyer's parameters, and a second demo against an unmodified open-source storefront, so the demo does not rely only on planted defects.
4. **Ship the PR-preview GitHub Action** (see `examples/github-actions/`) as a reusable action. This is the bridge to a hosted product.
5. **Record a 20-second GIF** for the README.
