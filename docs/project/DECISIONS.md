# Decisions

1. **Single TS package, modules as folders** (not a multi-package monorepo): one install, one build; split when a second consumer exists.
2. **Deterministic heuristic buyer is the default**; LLM buyers are opt-in. CI reproducibility + zero cost.
3. **Buyer brief by allow-list + leak assertion** before every journey; segment/archetype/variant never reach buyers.
4. **Observed facts are generated from data**, never from auditor prose; inference needs ≥2 unchallenged auditors.
5. **Paired bootstrap over personas + Wilson intervals**; <30 pairs ⇒ EXPLORATORY SIGNAL; never "significant".
6. **Unitless ROI score with printed formula**; no money without revenue data.
7. **Budget checked against worst-case cost before each call** ⇒ a session cannot exceed `--budget`.
8. **Same-origin network guard** for journeys; MCP targets localhost-only by default.
9. **Traces kept for failed journeys only** (default) to bound disk use; screenshots every step (JPEG q55).
10. **Apache-2.0** core; commercial value in a separate hosted layer + trademark (LICENSE_STRATEGY.md).
11. **Demo candidate deliberately includes a regression** (mobile pop-up) so the demo shows detection, not just a win.
12. **No `npx buyer-arena`** in docs until published (name squatting / supply-chain risk).
