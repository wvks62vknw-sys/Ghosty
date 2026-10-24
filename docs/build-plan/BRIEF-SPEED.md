# SPEED, part 1: the stopwatch (measure everything first; the fixes follow the numbers)

The owner (OWNER-ISSUES 4): "his speed in doing things could be better", everywhere. The plan (PLAN.md B3): a stopwatch
on everything, then the worst offenders fixed, with before-and-after numbers in UPGRADES.md and the numbers published
in SYSTEM → STATUS. This part builds the measuring; the fixes come once a day of real numbers exists.

Read BRIEF-W0.md, MAP.md's entries for the model router (`apps/edge/src/llm/router.ts`, `quota.ts`, `providers.ts`),
the agent loop's step events (how tool steps reach the chat: search MAP.md for "steps"), `apps/web/src/assistant/session.ts`
(a reply in flight, the first token), `apps/web/src/shell/tabs.ts` (`go`, tab changes), `apps/web/src/core/store.ts`
(IndexedDB), the meter (`apps/edge/src/meter.ts`: how counts are kept cheaply and shown in `/status`). Other builders
are restyling `features/*` (do not add a panel: say what the SPEED card should show) and wiring the school. Work ONLY
in: new `apps/edge/src/speed.ts`, `apps/edge/src/llm/router.ts` (timing hooks only), new `apps/web/src/core/stopwatch.ts`,
`apps/web/src/assistant/session.ts` (timing hooks only), `apps/web/src/shell/tabs.ts` (one hook), `apps/web/src/api/brain.ts`
(one hook: request round trips), the edge tests (`apps/edge/test/router.test.mjs` or a new `speed.test.mjs` run through an
existing file), `tests/ui.spec.mjs` (one check), MAP.md. The `/status` route lives in protected `agent.ts`: do NOT edit
it; report the exact one-line addition (`speed: await speedSummary(this.storage)` or similar) for the orchestrator.

## Build

1. **The brain's stopwatch** (`speed.ts`): per model call, the provider, the model, time to first token and total
   time, tokens per second where the stream exposes them, and whether it waited for a rate limit; per tool call, the
   name and duration; per request, the total. Kept cheaply: a ring of the last 300 entries in Durable Object storage
   (one key, written at most once a minute, like the meter), and daily medians per provider and per tool kept for 14
   days. `speedSummary()` → `{ today: { firstToken: { median, p90 }, reply, tools: { name: median }[] }, week: … }`
   with plain-words lines ("first word in 1.4 s (median), 3.9 s at the slow end · Groq fastest today").
2. **The phone's stopwatch** (`core/stopwatch.ts`): cold start (navigation timing to first paint and to the first
   screen), each tab's open time (from `go()` to its first paint), each reply's time to first word and to done as the
   owner sees it, and the brain's round trip (from `api/brain.ts`); kept in IndexedDB (last 500), with medians per
   screen and for replies; exported as `stopwatch.summary()` for the SPEED card; measured with `performance.now()`,
   never with timers that drift; zero cost when idle.
3. **Honest plain-words summaries**, for the SPEED card to come: "Replies: first word in 1.4 s, done in 6.8 s (today's
   medians, 23 replies) · last week 2.1 s / 8.0 s", "Screens: God's Eye opens in 0.4 s, Library 0.3 s, Workshop 1.1 s
   (slowest)", "Brain round trip 84 ms", "Tools: web search 2.3 s, weather 0.6 s, library 0.1 s".
4. **Where the time goes**: the brain's per-request breakdown (model wait, model time, tools, the rest) kept with the
   ring, so the fixes can be aimed.

## Tests (each must fail on the old code)

The ring and the medians (pure); the summary lines; the router hook records a call with its provider and the wait;
the phone module's medians from recorded samples (bundled like other web modules in the edge tests); `tests/ui.spec.mjs`:
after a reply and two tab changes, `stopwatch.summary()` reports them. Then tsc, `npm run check`, the full edge
`npm test` once (≈ 16 min on this shared machine).

## Finish

Commit on your worktree branch (do not push, do not merge). Final report: what is measured and where it is kept;
the one line for `/status`; what the SPEED card should show; tests and proof; every check's exact result.
