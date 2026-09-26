# Session state — compact, for resumption

Trunk is `main` (public). This session's work is on `feat/security-egress-sandbox` (2 commits,
ahead of `main`): the sandbox/egress security layer and the multilingual heuristic buyer.

## Done (committed, this session)

| Phase                                                              | Files                                                              | Tests                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------- |
| Security layer ported + wired (egress proxy, SSRF net-guard, MODE C docker sandbox) | `src/security/*`, `src/sandbox/*`, `src/simulator/session.ts`, `src/agent/eval.ts`, `src/cli/commands.ts` | `tests/unit/security.test.ts` (57) |
| Multilingual heuristic buyer (ES·EN·NL) + login/sign-up disambiguation | `src/simulator/heuristic.ts`, `src/i18n/messages.ts`, `src/auditors/rules.ts` | `tests/unit/heuristic-kw.test.ts` (59) |
| Fixed ambient `OPENROUTER_API_KEY` isolation                       | `tests/unit/models.test.ts`                                       | models tests              |
| Secret-scan allowlist re-applied                                   | `scripts/secret-scan.mjs`                                         | `secrets:scan` clean      |

Suite: 304 passed + 1 opt-in skipped; typecheck, lint, secret scan clean.

## Live LLM + ensemble (this session)

- OpenRouter configured but **no credits** (HTTP 402).
- `openai-compatible:deepseek-chat` verified live: 12 buyers, 58 % completion, $1.4610, 86 calls.
- `ensemble` heuristic × LLM (12 shared pairs): completion agreement 83 %, kappa 0.68, model
  disagreement 16.7 %. Evidence: `docs/project/OVERNIGHT_REPORT.md`.

## Status

RC complete and now also live-verified. Repo public (default branch `main`); not on npm. Site live
at `https://abrahamhl.github.io/buyer-arena-site/`. Final summaries: `RC_FINAL_REPORT.md`,
`OVERNIGHT_REPORT.md`. Remaining work: `NEXT.md`, `OPEN_LOOPS.md`.

## Decisions

- Default network policy is LOCAL, non-strict: escalates only for targets named on the command
  line, printed and recorded. Any explicit choice (flag/env/config) is strict.
- npm audit is not "explicit": it runs only when the policy already allows the registry.
- Dynamic model routes are never auto-selected; only pinned, and labelled.
- Live provider for verification: `openai-compatible` (DeepSeek) until the OpenRouter key is funded.
