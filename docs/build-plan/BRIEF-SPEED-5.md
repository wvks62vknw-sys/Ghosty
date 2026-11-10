# BRIEF: THE FIVE WORST WAITS (speed pass 2) — the first screen, the turn's own reads, the calendar, the router, the lookups run together

BRIEF-SPEED-5 (PLAN 3 B3 "then the five worst offenders fixed (tools run side by side, replies stream from the first word, warm
caches, shorter prompts, the quickest free model that gives the same answer)"; AUDIT-8-NOV item 1; OWNER-ISSUES 4 "his speed
in doing things could be better"). The stopwatch (apps/web/src/core/stopwatch.ts, apps/edge/src/speed.ts) and the SPEED card
(SYSTEM → STATUS) exist, PR #54 did the first words of a spoken reply. This pass reads what they and a stopwatch of its own say
on the common journeys, writes the five worst waits down WITH NUMBERS AND THE LINE OF CODE THAT CAUSES EACH, and fixes them, one
commit each, each held by a budget that is paid for by cost and never by loosening. The mid tier. Start from the session branch.

## How it was measured (before anything was changed)

The preview (tests/preview-server.mjs on 8798, the real brain bundle behind /api, the scripted model) and Playwright at the
owner's phone size, reading `window.__ghosty.stopwatch`; the brain's own work counted by a bench that runs the real
`GhostyAgent` / `Router` / `mindSnapshot` on a storage that charges a fixed time per call (1 ms, said wherever it is used: a
Durable Object read is faster than a network call and slower than memory, and what matters is that the COUNT of serial waits
falls, which is the same whatever a read costs). The scripted model answers at once, so the model's own seconds are not in any
number here; what is in them is everything Ghosty does around the model. The sandbox draws WebGL in software: the 3D Studio's
4.3 s first open, God's Eye's 0.44 s and the Lens are the sandbox's graphics, not the phone's, and are NOT counted as offenders.

| Journey | Measured (before) |
|---|---|
| Cold start, first screen (median of 5) | 605 ms on a free local network; **1,167 ms when each request costs 150 ms** (a phone's mobile network is slower than that) |
| Open a screen (the warm tabs: Agenda, Memory, System, Library, Radio…) | 100 to 200 ms each; none is an offender |
| A chat reply, scripted model (first word, done) | 125 ms and 133 ms on the very first, 5 to 20 ms after: the brain's own code is cheap on memory |
| The same turn when storage costs 1 ms a call | **60 ms to the first word and 60 reads + 7 writes for "hello"** (83 ms, 69 reads for "remember …", 98 ms for two lookups) |
| A model call (router), storage 1 ms a call | **40 ms median, 12 reads + 9 key decryptions + 2 writes, all one after another**, every step of every turn |
| A turn when a calendar is connected, calendars 300 ms each, three of them | **992 ms before the model is even asked; the same again every 15 minutes** (947 ms); 33 ms in between |
| Two read-only lookups asked in one reply | run one after the other unless every call is flagged `pure` (read from `runCalls`; only 49 of 147 tools are flagged: the sum of the waits, not the longest). Timed by the test after the change |

## The five worst, and why

1. **THE FIRST SCREEN WAITS FOR FOUR REQUESTS IN A ROW** (web). `apps/web/src/main.ts` boot(): `await World.load()` (the Earth
   data, `/data/world.json`), THEN `await connect()` (`/api/health`, then `/api/status`, one after the other), THEN `await
   loadHistory()` (`/api/history`), and only then `go(first)`. The four have nothing to do with each other. 605 ms → 1,167 ms with
   a 150 ms network: every request costs its whole round trip on the owner's phone before he sees a screen.
2. **A TURN READS ITS CONTEXT ONE KEY AT A TIME** (brain). `apps/edge/src/mind.ts` `mindSnapshot()` is built once for every turn
   and reads about 45 stores (owner, profile, memory, lessons, principles, mood, places, events, jobs, school, study, spending,
   guardian, foresight, every pack) each after the one before. 60 reads for "hello", 60 ms of the 60 ms first word at 1 ms a read;
   on a Durable Object the same count of waits, one behind another.
3. **THE CALENDAR IS FETCHED ON THE OWNER'S TURN, ONE FEED AT A TIME** (brain). `mindSnapshot` asks `schedule.ts agenda()` for his
   calendars; `agenda()` loops `for (const f of feeds) await feedSeries(…)` and `feedSeries` fetches the link when its cache is 15
   minutes old. Each feed is a network request to a calendar server: three feeds at 300 ms are 992 ms (raced against 1.5 s) before
   the model hears the question, and the same wait comes round every 15 minutes of a conversation.
4. **THE ROUTER TALKS TO ITS STORAGE AND VAULT ONE BY ONE** (brain). `apps/edge/src/llm/router.ts` `attempt()` reads
   `llm:health`, `llm:order`, then for each provider `keyFor()` (a storage read and a decryption: nine of them) and `models()`
   (`llm:models` read again for each provider), all in sequence; after the answer it `await`s `mark()` (a read and a write) and the
   `llm:last` write before handing the answer back. 40 ms a call (12 reads, 9 decryptions, 2 writes), on every step of every turn.
5. **LOOKUPS ASKED TOGETHER RUN ONE AFTER ANOTHER** (brain). `agent.ts runCalls` runs several calls at once only when every one is
   `pure` (`tools/types.ts`); of 147 tools 49 are flagged, and the plain read-only lookups are not: list_scheduled,
   list_calendar_feeds, check_email, search_email, read_email, find_nearby, elevation, roadmap, list_lessons, list_widgets, reverse_jobs.
   "What is on, any mail, what is nearby" is the sum of three waits, not the longest. (Left alone on purpose: Spotify's lookups, which may
   renew a token as they run, and reverse_status, which refreshes and files a job.)

## What is fixed (one commit each)

1. **Boot overlaps what does not depend on itself.** The Earth data, the brain's health and status are asked together; the chat's
   history is asked as soon as the brain is known and the shell builds meanwhile; the first screen opens when each is in. Nothing
   it needed is dropped and nothing is guessed: the same data, the same order of events the specs know (boot cinematic, connected
   flag before the layout draws its dock, history before the first screen opens), earlier.
2. **`mindSnapshot` reads its stores together** (`Promise.all` over the independent parts), and builds exactly the snapshot it built.
3. **The turn never waits on a calendar's network.** Feeds are fetched side by side (all of them, together) wherever `agenda()` is
   used, and the turn's snapshot uses a feed's cached copy of up to a day old at once, refreshing it behind the turn when it is
   older than 15 minutes (stale-while-revalidate). The agenda tools and the agenda screens keep the fresh path (15 minutes); the Brief's snapshot (`/api/mind`) shares the turn's.
4. **The router asks once and decrypts together**: the stores are read once per completion, the providers' keys are opened
   together, and the bookkeeping after an answer (health mark, `llm:last`) is done behind the answer, never before it.
5. **The plain read-only lookups are flagged `pure`** (eleven tools; read_email only without `mark_read`), so the agent runs them together.

## What is NOT in this pass, and why (the report says it plainly)

- **Replies streaming from the first word** and **the turn's own per-step prelude** (`loadMemory`, `loadProfile`, `loadInbox`
  read again before every model call; `recall`, `loadPrinciples`, `loadLessons`, `loadMood` one after another before the first)
  live in `agent.ts`, which is protected. The model call is also not streamed today (`router.call` takes the whole answer, the
  agent emits one `text` event). The exact change is written in the report under NEEDS HIS WORD.
- **Shorter prompts**: the plain turn is held at 5,500 characters and the tool list at 6,500 by prompt.test.mjs (the guard stays);
  nothing was found in the plain turn that is not already paid for. **The quickest free model**: the background and internal
  calls already ask for the small tier by name (`tier: 'small'`), the owner's chat keeps his provider order; no call was found
  asking for the big tier for an easy job in an unprotected file.

## What must not change

The prompt guard; the CI guard job; `.github/*` (but the one word `speed2` after the last word of the `all=` list in check.yml);
`apps/*/package.json`; `agent.ts`, `index.ts`, `tools/index.ts`, `tools/types.ts`, `tools/repo.ts`; the kernel; no packages, nothing
from the network that was not already fetched, no new keys, no cost; the brain never gets live GPS; no vendor's model name anywhere
(a tier or a slot by name only); the snapshot, the router's choice of model, every tool's result are exactly what they were.

## Tests (each fails on the code before this brief, run once against it and say so; passes after)

1. `tests/speed2.spec.mjs` (new; its word `speed2` in check.yml's `all=`): the phone's first screen with each request to the
   brain and the data costing 150 ms, median of five, within a budget set from the measured after (the before is 1,167 ms); the
   boot still lands on Home, still connected, the dock drawn, the chat history on the log.
2. `apps/edge/test/mind.test.mjs` (runs inside the CI brain tests): the snapshot on a storage charging 5 ms a read is built in under
   a budget that serial reads cannot meet, and equals the snapshot built without the delay; the calendar: three feeds of 300 ms
   cold in under 500 ms (the before: about 900 ms), a stale cache answers at once and is refreshed behind the turn, the fresh path
   still waits for the new copy.
3. `apps/edge/test/router.test.mjs`: a completion reads the stores once (a count of reads, at most four, the before 12 and 9
   decryptions) and the answer does not wait for the bookkeeping writes; the model chosen is the one chosen before.
4. `apps/edge/test/agenda.test.mjs`: two flagged lookups asked in one reply finish in about the longest of them (storage charging
   150 ms), the result messages in the order asked; `read_email` with `mark_read` still runs alone.
5. Nothing else loosened: knowledge.test (no `// …` placeholder comment), ratchet.test (colours and radii: nothing new), prompt
   guard (not raised).

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; results to the scratchpad file)

`cd apps/web && npx tsc --noEmit -p . && node build.mjs`; the brain: `cd apps/edge && PATH=$PWD/node_modules/.bin:$PATH npm test`
(about ten minutes, in the background); the preview on PORT 8798; then EVERY spec named in check.yml's `all=` list one at a time
(`BASE=http://localhost:8798 NO_GL_SHOTS=1 timeout 480 node tests/<name>.spec.mjs tests/.shots` from the repository root), the last
line of each written to the report as it finishes; God's Eye specs through the no-screenshot copy, deleted after. Known sandbox
reds that are not this pass's: direct, aim, radio.

## The owner's phone check (write it into the report in these terms)

(1) Close Ghosty fully and open it: the first screen comes sooner, most noticeably on mobile data. (2) Ask anything, "hello" will do:
the first word starts sooner, most when you have a calendar connected, and the same on the question after the one that sets off
the 15-minute refresh (it used to hesitate once a quarter of an hour). (3) Ask for two things at once ("what's on today, any new
mail, what's playing"): the answer comes after the slowest of them, not all three. (4) SYSTEM → STATUS → SPEED: the replies line and the
brain's line should read lower after a day of use than the day before. (5) Nothing else looks or behaves differently: if anything does, say.

## Report

In the scratchpad file (speed-report.md): every commit's hash and one line; the five with before and after numbers; each spec's last
line verbatim and its verdict; NEEDS HIS WORD (the protected-file changes, written exactly); the owner's phone check; what was not
done and why. Never push. Never touch a protected file. Named by tier, never by model.
