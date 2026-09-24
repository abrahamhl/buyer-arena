# Contributing to Buyer Arena

Thanks for helping. This file covers local setup, the project's principles, how to add
detectors and templates, and what a pull request needs.

## Setup

```bash
npm install
npx playwright install chromium
npm run check        # typecheck + lint + tests + secret scan (about 1 min, zero paid API calls)
npm run demo         # end-to-end sanity check
```

Useful loops:

```bash
npm run test:unit                    # fast, no browser
npx vitest run tests/integration     # real Chromium against the demo store
npm run build && node dist/cli/main.js demo --size 5
```

## Principles (please keep them)

1. **Measure first, interpret second.** Metrics come from recorded events. Auditors, human or LLM, reason over evidence. They never produce it.
2. **No finding without evidence.** Every finding cites `<run>:e<n>` ids, and consensus rejects anything that cannot be traced to recorded events.
3. **Buyers must not know the experiment.** Anything that reaches a buyer goes through `buildBrief` (an allow-list) and `assertNoLeak`.
4. **Tests never spend money.** The suite runs with `BUYER_ARENA_OFFLINE=1`. Use `MockProvider` for LLM paths.
5. **Honest statistics.** Synthetic results are a conversion proxy. Small samples are labelled EXPLORATORY SIGNAL.
6. **Safety.** Buyers only visit the origin the user supplied. There is no crawling, and no real personal or payment data.

## Adding things

- **A friction detector:** add an entry to `DETECTORS` in `src/metrics/friction.ts` and a play in `src/auditors/playbook.ts`, then a unit test that uses `tests/helpers.ts`.
- **A population template:** add it to `TEMPLATES` in `src/personas/templates.ts`, with a flavour for each of the 5 archetypes.
- **A provider:** implement `ChatProvider` (`src/providers/types.ts`) and register it in `createProvider`. Test it against a local fake endpoint (see `tests/unit/adapters.test.ts`).
- **An execution engine:** follow the JSON contract in `src/engines/external.ts`.

## Pull requests

- Keep each PR focused and include a test.
- Sign off your commits (`git commit -s`, Developer Certificate of Origin). Contributions are accepted under Apache-2.0.
- Include a screenshot of the report or CLI output when you change them.
