# Overnight report — 2026-09-26

Overnight autonomous session. Goal: finish the RC to production detail, reconcile the pending
security work onto `main`, verify the last "unknown" (a live cloud-LLM run), add novel high-value
options, and leave the repo in a reviewable state.

## What changed

### 1. Security layer reconciled onto `main` (branch `feat/security-egress-sandbox`)

`main` already carried the network ledger (`src/policy/network.ts`), `scrubbedEnv` exec and the
static `audit-repo`. It was missing the sandbox/egress work that only existed on a stale side
branch. Ported and wired into the live paths:

- `src/security/net-guard.ts` — SSRF / DNS-rebinding guard: classifies every address against
  RFC1918, loopback, link-local, CGNAT, cloud-metadata and other non-public ranges;
  `assertPublicUrl` + `resolveRedirectChain` validate target URLs and their redirect hops.
- `src/security/egress-proxy.ts` — in-process HTTP proxy that Chromium runs through, so
  sub-resources, redirects and WebSockets are filtered too. Pins the first resolution per host so
  DNS rebinding cannot swap in a private address.
- `src/sandbox/docker.ts` — MODE C runner: non-root, cap-drop ALL, no-new-privs, read-only root,
  cpu/memory/pids limits, registry-only network for install, timeout + output cap. Refuses host
  execution in hosted mode or for a remote repo.
- `src/simulator/session.ts` — hosted mode refuses non-public targets and external engines; the
  egress guard runs by default (`BUYER_ARENA_EGRESS_GUARD=0` opts out) and is recorded in the
  manifest.
- `agent-eval --sandbox <host|docker>` — runs build/test in a throw-away container.
- Fixed `tests/unit/models.test.ts` (ambient `OPENROUTER_API_KEY` isolation) and re-applied the
  `secret-scan` allowlist. 57/57 security tests pass, including a real Chromium journey through the
  egress proxy.

### 2. Multilingual heuristic buyer (ES · EN · NL)

The deterministic buyer matched page text with English-only keywords, so a Spanish or Dutch site
was scored as if it had no pricing/CTA/trust signals. `src/simulator/heuristic.ts` now:

- recognises ES/NL terms in every keyword class (`Precios`, `Prueba gratis`, `Aanmelden`,
  `Garantía`, `Kosten`, `Características`…),
- adds a `LOGIN` pattern so a sign-in form is never mistaken for sign-up (`Iniciar sesión`,
  `Inloggen`, `Entrar`),
- updates the disclosure copy (`drv.cta_not_found` and the red-team `POLICY_DRIVEN` note) that
  previously claimed the keywords were English-only.

Covered by `tests/unit/heuristic-kw.test.ts` (59 cases).

### 3. Live cloud-LLM run verified + ensemble published

The last major unknown — does a real cloud LLM drive a buyer journey end to end? — is now verified.

- **OpenRouter is configured but has no credits.** The key reaches `openrouter.ai` and gets
  `HTTP 402 "Insufficient credits … never purchased credits"`. Recorded faithfully as
  `provider_error` on the journey.
- **`openai-compatible:deepseek-chat` works.** With `OPENAI_BASE_URL=https://api.deepseek.com/v1`
  and `OPENAI_API_KEY` set from `DEEPSEEK_API_KEY`, real LLM buyers navigated the demo store.

Paired evidence (same population seed 42, same task, same demo-store baseline, 12 buyers each):

| Buyer                              | Completion | Cost    | Calls | Session id            |
| ---------------------------------- | ---------- | ------- | ----- | --------------------- |
| heuristic (deterministic, free)    | 42 %       | $0      | 0     | `20260926-054556-a159` |
| `openai-compatible:deepseek-chat`  | 58 %       | $1.4610 | 86    | `20260926-054603-f655` |

`ensemble` (heuristic × LLM) — 12 shared persona × variant pairs:

- completion agreement **83.3 %**, Cohen's kappa **0.68** (substantial),
- decision agreement 66.7 %, friction Jaccard 0.465, trajectory divergence 0.35,
- model disagreement **16.7 %**, reported separately from population and calibration uncertainty
  (never merged, per the project invariant).

Interpretation: the two independent buyers agree substantially on *who completes*, while the LLM
buyer completes more journeys (it handles the pricing/CTA steps that the deterministic buyer
misses). This is a consistency signal, not ground truth.

## Verification

- `npm run check` green: 304 tests passed + 1 opt-in skipped; typecheck, ESLint and secret scan
  clean. Security tests 57/57.

## State

- Repo is **public** (`abrahamhl/buyer-arena`, default branch `main`, last pushed 2026-09-26 01:29).
  Not on npm (`npm view buyer-arena` → 404).
- Site live at `https://abrahamhl.github.io/buyer-arena-site/` (public, Pages from `main`).
- This session's work is committed on `feat/security-egress-sandbox` (2 commits), ahead of `main`.

## Still open (see `OPEN_LOOPS.md` / `NEXT.md`)

- Human launch audit; OpenRouter key needs credits (or standardise on DeepSeek).
- First external calibration case study; `agent-eval` benchmark.
- Sensitivity sweep over the heuristic buyer's tunable thresholds.
- npm publish + site `SITE_LAUNCH_STATE=public`.
