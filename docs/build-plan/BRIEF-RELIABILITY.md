# BRIEF: RELIABILITY AND HEALTH — a health mark on every ability, actions verified, the permissions screen, crash records, "that felt off"

BRIEF-RELIABILITY (PLAN-STARS Pass 2, STARS 85 to 95; OWNER-ISSUES 176 "do all of it", 178 "insane quality"; THE-GUIDE-11-NOV section 7 and
the top tier's own additions in section 9 ("a one-line health mark on every ability (WORKING / DEGRADED / NEEDS KEY / OFFLINE) so you can see
at a glance what is real"; "a 'that felt off' tap on any moment that files it with its screen"); SMALL-GAPS.md section 3 (the app feeding
itself); QUEUE-11-NOV item 9). One builder, one PR. The mid tier. Starts after POLISH 1 is on main (it uses its one error voice, ui/hisWords.ts,
and its waiting() helper); LIFE EASIER's guardian mount is the pattern for the brain route but not waited on. Read STANDARD.md,
BRIEF-POLISH-1.md, BRIEF-UNDO-OFFLINE.md (UNDO everywhere: the list of actions), BRIEF-OFFLINE-DEFAULT.md, `apps/web/src/abilities/{registry,
sources,offer}.ts` and `packages/shared/src/abilities.ts` (the Ability type, its `off` line), `apps/edge/src/abilities.ts` (GET /api/abilities,
the groups that need a key), `apps/edge/src/guardian.ts` (where `/guardian/*` routes mount), `apps/web/src/features/system/{index,reportcard,
independence,storage,backup}.ts`, `apps/web/src/features/core/rate.ts` (👍/👎 to the brain), `apps/web/src/ui/hisWords.ts` (POLISH 1), `tests/
abilities.spec.mjs`, `tests/independence.spec.mjs`, `tests/undo.spec.mjs`, `tests/backup.spec.mjs`. THE QUALITY RULE holds (every state
designed, every word his, every wait said, every number honest, every control 44 pt, nothing merely fine).

## His words
91a and the audit's standing complaint behind this: a thing that says it can and then does not. STARS 87 "a status line when degraded; self-
healing when a feed or model returns"; 90 "crash records for everything; the owner never sees a stack trace, a blank or a frozen spinner"; 94
"the brain's health page in his words".

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. The brain's health route goes in its own
file (apps/edge/src/health.ts) mounted in guardian.ts as `/guardian/health` and `/guardian/feltoff` (guardian.ts is not protected). A key's
NAME may be read to say NEEDS KEY; a key's VALUE never leaves the brain and is never written anywhere.

## What is built

1. **A HEALTH MARK ON EVERY ABILITY (apps/web/src/abilities/health.ts; apps/edge/src/health.ts).** Every ability (the brain's groups and the
   app's own, abilities/registry.ts) carries one of four marks, computed, never written by hand: NEEDS KEY (the group's `off` line: a key the
   brain does not have, named by its key's name only); OFFLINE (the brain cannot be reached, or the ability needs a feed the phone cannot
   reach right now, read from the app's existing offline state); DEGRADED (the brain's last run of one of its tools failed, or a feed it reads
   is older than its own staleness (weather past 3 hours, news past 6, the markets past a day, the MOT record past a month), or a fallback is
   in use (the offline brain answering for the cloud, the offline map for the online one)); WORKING otherwise. The brain's side: health.ts
   keeps, per tool group, the last success and the last failure (time and the error's kind, never its raw text) from the trail the agent
   already writes (why.ts's Trail, read, not changed), the keys' names present, each feed's last good read, and serves them as `GET
   /guardian/health` in one small object; the phone joins them with its own (the offline state, the feeds it reads itself, the storage line).
   SELF-HEALING: a DEGRADED mark clears itself when the next run succeeds or the feed returns; the mark's line says "back since 14:02" for an
   hour after. SHOWN: one word after the ability's line wherever abilities are listed (the YOU CAN lines on the deck's screens, the offer card,
   the chat's "what can you do"), in the system's truth style, never a colour alone (the word is always there); SYSTEM → HEALTH (a new page,
   replacing nothing: the report card stays) lists every ability under its mark with the one reason and the one key to put it right (NEEDS KEY
   → SYSTEM → KEYS at that row; OFFLINE → the offline brain's page; DEGRADED → RETRY which runs the ability's own check), and at the top one
   honest line: "Everything is working." or "3 things need you." or "Offline: 41 of 60 things still work." The Brief's first line gets the
   same count when anything needs him and nothing otherwise.
2. **ACTIONS VERIFIED (STARS 86; apps/web/src/assistant/verify.ts).** When the brain says it did a thing that leaves a record (a reminder or
   event set, a memory kept, a watcher added, a document saved, a site published or unpublished, a setting changed, a message drafted), the
   phone reads it back through the route that lists it before saying "Done" (within the Stage's 2 s budget; the reply's line is held as
   "Setting it…" from waiting() until then). Read back: the reply's sentence stands and gains the system's tick mark. Not read back after one
   retry: the sentence changes to "I tried to set that, but I cannot see it yet." with RETRY and SHOW ME (the list it should be on), never a
   bare "Done". The verify table (which tool → which list → which field) is one file; a tool not in the table is not verified and says nothing
   extra. Optimistic actions keep POLISH 1's and UNDO's shape: the UNDO bar where the thing can be put back.
3. **THE PERMISSIONS SCREEN (SETTINGS → PERMISSIONS; apps/web/src/features/settings/permissions.ts).** One row per thing the phone can be
   asked for: camera, microphone, location, notifications, motion, the clipboard, kept storage, the home-screen app, Wi-Fi only downloads. Each
   row: its state as the browser tells it (the Permissions API where Safari answers; the phone's own record of the last grant or refusal where
   it does not, said as "last time: allowed", never guessed), what Ghosty uses it for in one sentence, what Ghosty never does with it (the rules
   in his words: the camera never names a stranger, the location never reaches the brain live), and HOW TO CHANGE (the iOS Settings path as
   words, no deep link that cannot work). A permission refused mid-task anywhere in the app lands here with one line (the funnel: hisWords'
   `permission` kind). Nothing here asks for a permission by itself.
4. **CRASH RECORDS, NEVER A BLANK (STARS 90; apps/web/src/core/crash.ts).** window.onerror and unhandledrejection, the service worker's failed
   fetches of the app's own files, a screen's mount that throws, and a frame that stays frozen over 2 s on a screen that draws (the Lens, the
   Studio, the arcade, the engine) each write a record on the phone (the last 40: the time, the screen, the error's kind by hisWords, the raw
   text only on the WHY trail) and show his words in place of the blank: a screen's mount failing shows "This screen fell over. RELOAD IT." in
   the room's own frame with RELOAD IT and HOME, never white, never a spinner with no words; a frozen draw shows "Still drawing…" after 2 s and
   "This stopped. RELOAD IT." after 8. SYSTEM → HEALTH shows "No crashes this week." or the records (the screen, the hour, his words), each
   with THAT FELT OFF prefilled. A test hook throws on demand in one screen for the spec.
5. **"THAT FELT OFF" (SMALL-GAPS section 3; apps/web/src/features/core/feltoff.ts).** On any reply (beside 👍/👎) and in every screen's "?"
   or WHY (where the screen has one; the house line's long press elsewhere), one key: THAT FELT OFF. One tap files a moment: the screen, what
   he had just done (the last three of his own actions from the awareness line, in words), what was on the screen (the visible text, trimmed
   to 600 characters; never a picture, never the camera, never a face, never another person's message text), the health marks at that moment,
   the hour; one optional line of his own words; SEND. It goes to `POST /guardian/feltoff` and is kept in the brain's store (the last 300),
   listed at SYSTEM → HEALTH → FELT OFF with the moment's words, and read by the Sunday note (OCTOBER IDEAS 3's selftrain/learned.ts Sunday
   section, where landed; else named as the next hand) as "7 moments felt off this week; the most on the Agenda." A moment also counts as a 👎
   for the reply it was tapped on, through rate.ts's existing path, nothing new. Offline: kept on the phone and sent when the brain is back,
   said once.
6. **THE BRAIN'S HEALTH PAGE IN HIS WORDS (STARS 94).** SYSTEM → HEALTH's second half: the brain itself (reachable, its version's day, its
   store's size in his words, the clock's jobs with the last run of each as "ran at 06:00, fine" or "failed at 06:00: the feed was down", the
   keys by name as present or missing, the GPU job's last week), each line one sentence, every number with its unit and "as of", the page
   loading under waiting(). The report card (reportcard.ts) links here and does not repeat it.

## What must not change

The first-screen budget and every other budget (the health read is one request, cached on the phone for ten minutes, never on the first
screen's path); GLASS pixel-equal; ONE INK's page; every control 44 pt; nothing sideways at 440 × 956 or 390 × 844; the finding rule; the
ratchet ceiling (hex 506, rgba 1016, radiusPx 470, total 1992: equal or lower: the mark is a word in the truth style, no new colour); the prompt
guard; no new key; the brain never gets live GPS; the UNDO bar's rules; the independence meter and the report card's existing lines.

## Tests (each fails on the code before this brief; run against it once and say so)

- apps/edge/test/health.test.mjs (new; imported from an existing test file as kernel-yes was, one import line, since the test list is
  protected; NEEDS HIS WORD names it): the health object from a seeded trail (one group with a failure, one with a success after a failure
  says back-since, a feed past its staleness); a key named and never its value (the test plants a value and asserts it is absent from the
  response's text); a felt-off moment stored, listed, capped at 300, and never holding a field named image, face or camera; the four marks
  from the eight combinations of key, reach, failure and staleness.
- tests/health.spec.mjs (new; `all=` word `health` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390: (a)
  every listed ability shows one of the four words, and SYSTEM → HEALTH's top line counts them right against a mocked brain with one key
  missing and one group failed; RETRY on the failed one with the mock healed clears it and says back-since; (b) with the mock brain down,
  OFFLINE on the brain's abilities, the phone's own still WORKING, the top line's count right; (c) an action the mock accepts but does not
  store gives "I tried to set that, but I cannot see it yet." with RETRY and SHOW ME, never "Done"; one it stores gives the tick; (d)
  SETTINGS → PERMISSIONS lists the rows with their states and the words, and a refused camera lands there with its line; (e) the test hook's
  throw shows the fallen-over frame with RELOAD IT and HOME and no blank (a screenshot's pixels not all one colour; the body has text), and a
  record appears under HEALTH; (f) THAT FELT OFF on a reply files a moment the mock receives with the screen and the text and without any
  picture field; a moment filed offline is sent when the mock returns; (g) the brain's health half lists the jobs with their last runs in his
  words, every number with a unit and an "as of"; (h) every control 44 pt, BODY 21 clips nothing, nothing sideways, no raw browser string
  anywhere (POLISH 1's lint stays at zero).
- abilities, independence, undo, backup, settings, system, speed2, look, ink, thescan, talk unchanged unless a fix lives in a screen they own.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8823:
`(nohup setsid node tests/preview-server.mjs 8823 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8823.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8823 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is never committed. In the foreground, alone, one after another: health, abilities, independence,
undo, backup, settings, speed2, look, ink, thescan, talk, nav, layout, guardian. The brain tests in the background once at the end (rebuild
the preview's brain bundle first: `npx esbuild src/index.ts --bundle --format=esm --platform=neutral --external:cloudflare:sockets
--outfile=test/.build/brain.mjs` in apps/edge). A timing budget missed under load is rerun alone before it is called red. Known sandbox reds
not touched: direct, aim, radio, scroll, safari, eye's own screenshot, tabs2, talk's cooling lines.

## The owner's phone check

1. SYSTEM → HEALTH: one honest line at the top; every ability under WORKING, DEGRADED, NEEDS KEY or OFFLINE with its reason and its key.
2. Turn Wi-Fi off: HEALTH says how many things still work; the Brief's first line says what needs you, or nothing.
3. "Remind me at 3 to call the garage": a tick when it is really on the Agenda. (The builder's mock proves the other case; you cannot.)
4. SETTINGS → PERMISSIONS: each row's state right for your phone; the words say what Ghosty never does with it.
5. Any screen, "?" or long press the house line: THAT FELT OFF, add a word, SEND; SYSTEM → HEALTH → FELT OFF lists it.
6. SYSTEM → HEALTH's brain half: every job with its last run in plain words, every number with its unit and "as of".
7. Did anything say "Done" that was not? Say which.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/health-report.md: what was built, the verify table, the
marks' rules as a table, the staleness per feed, each spec's last line (before and after for the new ones), found-not-fixed, NEEDS HIS WORD
(the test's name in the list; the Sunday note's line if OCTOBER IDEAS 3 is not yet on main), the phone check as above, the commit list. One
commit per step on builder/health; the orchestrator squashes to one on landing.
