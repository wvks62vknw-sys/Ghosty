# SPEED, part 2: the card (PLAN B3; the stopwatch is part 1, merged)

The brain times every model call, tool and turn (`apps/edge/src/speed.ts`; `/status` carries `speed`, shapes in
`packages/shared/src/speed.ts`: today, last week, lines, recent); the phone times its start, tabs, replies and round
trips (`apps/web/src/core/stopwatch.ts`: `stopwatch.summary()` → `PhoneSpeed` with `lines`). Nothing shows them yet.
Read BRIEF-W0.md, MAP.md's rows for both, `apps/web/src/features/system/index.ts` (SYSTEM → STATUS; how DATABASE TODAY
is drawn from `status.meter`), `ui/statusdials.ts`, the route C card style on System (screenshots in
docs/build-plan/mockups/deck/shots/system.jpg and the route C part 2 report in HANDOFF.md).

## Build (interface only, no brain change)
A SPEED card in SYSTEM → STATUS, under DATABASE TODAY, route C style: the phone's two reply lines first ("Replies:
first word in 1.4 s, done in 6.8 s (today's medians, 3 replies) · last week 2.1 s / 8.0 s"), then the brain's ("First
word in … (median), … at the slow end · Groq fastest today", "Replies take … in the brain"), then Screens, Start, Brain
round trip, "Where a reply's time goes" as one stacked bar (model / tools / waiting / the rest, each labelled), Tools
(slowest first, up to six) and Writing speed, as small rows; a RECENT disclosure with the newest 20 brain entries
(kind, provider or tool, the time, failed ones marked). Plain words, tabular figures, no jargon. Empty states say
"No replies timed yet today" and "The brain has not timed anything yet". The card refreshes with the status poll and
when the phone's stopwatch changes. The deck's System card and Home show nothing new.

## Tests
`tests/speed.spec.mjs` at 440 × 956 (en-GB): after one chat reply and two tab opens, SYSTEM → STATUS → SPEED shows the
phone's reply line with real medians, a Screens line naming the tabs opened, the brain's first-word line (the preview
brain's mock calls are timed too), the stacked bar's four parts adding up, RECENT with entries; the empty state on a
fresh page before any reply. Keep every other spec passing (`system` is checked by `ui` and `routec`). Say the
CI-loop line for `speed` (protected). `npm run check`.

## Finish
Commit on the worktree branch (do not push, do not merge). Report: files, screenshots of the card full and empty, every
check's exact result.
