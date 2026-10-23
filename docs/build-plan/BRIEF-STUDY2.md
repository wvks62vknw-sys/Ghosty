# STUDY at scale: hundreds at once, one topic at a time, on his own

Read BRIEF-W0.md in this folder first (the shared rules; one change: the target phone is now the **iPhone 18 Pro
Max, 440 × 956 points**), then MAP.md's entries for `library/study.ts` (self-study), `meter.ts` (the database
meter), `library/curriculum`, and the Library tab (`features/library/index.ts`, SELF-STUDY). Work ONLY in:
`apps/edge/src/library/study.ts`, `apps/edge/src/library/curriculum/*`, `apps/edge/src/library/digest.ts` if needed,
`apps/web/src/features/library/index.ts`, `tests/library.spec.mjs`, `apps/edge/test/study.test.mjs`, MAP.md's entries
for these, and `apps/web/styles.css` only inside one clearly marked `/* STUDY at scale */` block. Protected files are
off limits (MAP.md, "Protected kernel"; `agent.ts` runs the `study` job: if the job truly needs a new hook there, STOP
and say exactly what one-line change you need instead of making it). The prompt budgets in
`apps/edge/test/prompt.test.mjs` must still pass. Another builder is working on the GYM at the same time: stay out
of `features/gym` and `gym/`.

The owner, in his words: "It takes far too long: making him study ~4,000 pieces of text by hand, because he studies
only 3 at a time. I want WAY more material. He should absorb it on his own, all the time, including into the offline
brain. Pressing STUDY should study hundreds at once, ONE TOPIC AT A TIME, not a mix of topics." He is not technical.

## Build

1. **One topic at a time.** The study job works through a QUEUE of topics (a curriculum field such as "Algebra", or a
   FOCUS the owner typed), reading and digesting every piece of that topic before it moves to the next, never
   interleaving topics. Queue order: the owner's FOCUS first, then the curriculum's own order (foundations first).
2. **Hundreds at once.** STUDY (the button) queues the WHOLE current topic (hundreds of pieces) and the job drains it as
   fast as the free allowances allow: a bounded amount of work per alarm tick (the Worker's CPU time per invocation is
   small: keep a tick to a handful of page reads and model calls), and the next tick scheduled at once while there is
   work and room, instead of 15 minutes later. "Room" is still decided by the database meter (`spare()` and the day's
   caps: never spend the free allowance; past 70% it waits, as today) and by the model router's background lane for the
   digests (when no cheap model is free, reading continues and digesting catches up later through today's "read but
   not yet digested" list). Honest status from measured throughput: "Reading Algebra · 212 of 480 · about 40 minutes
   left at this pace".
3. **On his own, all the time.** With nothing queued, the job queues the next unfinished topic itself. A STUDY ALL
   switch (default ON; the owner can turn it off) makes this explicit. A finished topic is marked and not re-read
   unless the owner asks.
4. **Way more material: a curriculum that grows itself.** For each field, fetch Wikipedia's "Outline of <field>" or
   "Index of <field> articles" (the way study fetches pages today) and add the linked topics the curriculum does not
   have yet: deduplicated, tagged with the field and a rough level (basic / intermediate / advanced from the outline's
   section depth), capped per field per week (say 200) so it cannot run away, and counted in the status. Report how
   many new topics three sample fields produced.
5. **The SELF-STUDY panel** (Library tab): the queue (current topic, pieces done of total, time left), STUDY (queue this
   topic), a topic picker (fields with done counts and locks-to-come left alone), the STUDY ALL switch, FOCUS as today,
   and "what he learned today" (pieces read, topics finished, notes written). Plain words, UPPERCASE buttons, 44 px
   targets, nothing sticks out sideways at 440 px.
6. **Into the offline brain.** Nothing new to build here, but keep the hooks: the weekly training reads the library
   through `ownerPassages` in `apps/edge/src/selftrain/cycle.ts` and the digests by kind; do not change what those read.
   Say in your report exactly what the training will see from a topic studied this way.

## Tests (each must FAIL on the old code)

`apps/edge/test/study.test.mjs`: one topic at a time; a tick does many pieces but stays within its caps; the next tick
is immediate while there is work and room and backs off when the meter says no; continuous mode queues the next topic;
outline growth adds new, deduplicated topics and respects the weekly cap; the status text is honest ("x of y").
`tests/library.spec.mjs` (viewport 440 × 956 for the new checks): the panel shows the queue; STUDY queues the current
topic (through the mock brain); the STUDY ALL switch is remembered.

## How to run things here

- One-time, in your worktree: `cd apps/edge && npm install --no-audit --no-fund` (also builds the interface, ~3 min);
  then at the worktree root `npm install --no-audit --no-fund --no-save playwright@1.56.1` (Chromium is preinstalled;
  never run `playwright install`).
- The brain bundle the preview server needs: in `apps/edge`,
  `npx esbuild src/index.ts --bundle --format=esm --platform=neutral --external:cloudflare:sockets --outfile=test/.build/brain.mjs --log-level=warning`.
  The study tests import `test/.build/study.mjs` and friends: build them with the matching `esbuild` lines from the
  `test` script in `apps/edge/package.json` (copy the line for the files you need) and run
  `node --import ./test/no-network.mjs --test test/study.test.mjs`.
- Preview server: from the worktree root `node tests/preview-server.mjs 8802 &` (YOUR port is 8802; kill only your own:
  `ps -eo pid,args | awk '/preview-server.mjs 8802/ && !/awk/ {print $1}' | xargs -r kill`). Spec:
  `BASE=http://localhost:8802 node tests/library.spec.mjs /tmp/study2-shots`.
- While working run only the tests you touch. The full `apps/edge` `npm test` takes about 14 minutes here: run it ONCE
  at the end, with `npx tsc --noEmit -p tsconfig.json` in `apps/edge` and `npm run check` in `apps/web`. Machine:
  4 cores shared with other runs; do not run the whole browser suite.

## Finish

Commit on your worktree branch with clear messages (do not push, do not merge). Update MAP.md's entries for what you
changed. Final report: files changed; tests added and proof they fail on the old code; every check you ran and its
exact result; what the weekly training will see; anything not done and why. Be exact; never claim a check you did not
run.
