# BRIEF: QUALITY PASS — PLAN AND ME (the Agenda's spending, the Markets, the Radio; Memory, Settings, System, Links, Social made right; nothing new added)

BRIEF-QUALITY-PLAN-ME (OWNER-ISSUES 178 "i want everything to have insane quality even if there's things in the past which we've had which
could have better quality"; QUEUE-11-NOV, the sixth QUALITY PASS). One builder, one PR. The mid tier. Nothing new is added: the PLAN and ME
rooms are measured and made right by the method of BRIEF-UPGRADE-PASS, and the STATES RATCHET (apps/edge/test/ratchet.test.mjs, grown by the
LIFE, HOME, SEE and MAKE passes) gains their screens. What this pass owns: in PLAN, SPENDING (features/agenda/spending.ts: the statement's
lines, the month, the categories, the nudges' words), THE MARKETS (features/markets/index.ts: the cards, a price with its time, the chart's
states, a watch's words) and THE RADIO (features/radio/index.ts: the stations, PLAY, the stream's states, the sleep timer); in ME, MEMORY
(features/memory/{index,places,timeline}.ts: what I know about you, the timeline, your places, FORGET), SETTINGS' pages other than the packs
(features/settings/{character,faces,guardian,meaning,offline,principles,shortcuts,switch,voice,voiceknown,deeplinks}.ts: words and drawn
states only), SYSTEM's pages (features/system/{loops,reportcard,storage,training,backup,independence,night,speed,foresight,ledger}.ts: words
and drawn states only), LINKS (features/links/{index,drafts,notifications,social}.ts: the accounts, the drafts for his OK, the notifications'
list) and SOCIAL (features/social/{index,queue}.ts: the queue, APPROVE, a post's states), and the catalogue words for all of them
(packages/shared/src/catalogue/*). NOT THIS PASS'S: THE AGENDA's own screen (features/agenda/index.ts) and the SYSTEM screen's front
(features/system/index.ts) and SETTINGS' front (features/settings/index.ts): POLISH 3 gives those three their upgrade pass and their one
sentence a screen; THREATS (the SEE pass did it); the settings PACKS page (the SEE pass's words stand); the markets' feeds and maths; the
radio's stream and audio code; memory's store and what is kept; the backup's format; training's job; the social posting rule (APPROVE every
time, kept exactly); the hubs' cards (shell/hubcards.ts, shell/areadefs.ts). Starts FROM THE SEE PASS'S HEAD (08a5337a, the same base as
the MAKE pass), so the ratchet's table with its LIFE, HOME and SEE rows, POLISH 1's error voice (ui/hisWords.ts), the wait helper (ui/wait.ts)
and the words-file pattern (features/lens/words.ts) are in the tree; the orchestrator lands only the diff above that head, after the MAKE
pass is on main, resolving the ratchet table's rows and the `all=` word as a union (the rows are independent). Read STANDARD.md,
BRIEF-UPGRADE-PASS.md (the method), BRIEF-QUALITY-LIFE.md, BRIEF-QUALITY-HOME.md, BRIEF-QUALITY-SEE.md (the SEE report in the scratchpad
shows the measured list's shape), BRIEF-POLISH-3.md (what it owns, so nothing is done twice), `tests/spending.spec.mjs`, `tests/markets.spec.mjs`,
`tests/radio.spec.mjs` (a known sandbox red: no audio here; its checks stand), `tests/memory.spec.mjs`, `tests/settings.spec.mjs`,
`tests/backup.spec.mjs`, `tests/independence.spec.mjs`, `tests/notifications.spec.mjs`, `tests/social.spec.mjs`, `tests/upgrades.spec.mjs`,
`tests/progress.spec.mjs`. THE QUALITY RULE holds (every state designed, every word his, every wait said, every number honest, every control
44 pt, nothing merely fine).

## His words
"i want everything to have insane quality even if there's things in the past" (11 Nov, 178). The ME room is where he reads what Ghosty knows
and decides what it may do: every word there must be plain, and FORGET, APPROVE and the switches must be the clearest taps in the app.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. Nothing of another room's files.

## What is made right

1. **MEASURE FIRST, WRITTEN DOWN (the method's step 1), ALL EIGHT.** Open, at 440 × 956 and 390 × 844, in GLASS, THE SCAN and ONE INK,
   reduced motion on and off, the brain live and mocked dead, the signal on and off, nothing kept yet and things kept: SPENDING with no
   statement, a statement read, a month with nothing, a category opened, a nudge; THE MARKETS cold, a price with its time, the chart loading
   and failed, a watch set and tripped, offline with the last price and its age; THE RADIO's list cold, PLAY's wait, a stream that fails,
   offline, the sleep timer; MEMORY with nothing known, a day's timeline, a place, FORGET and its undo, a search with no hit; SETTINGS' pages
   each cold and set (character, faces with none and one introduced, guardian, meaning, offline packs' words only where not the packs page,
   principles empty, shortcuts, the switch, voice and the voice known); SYSTEM's pages (loops idle and running, the report card with no data,
   storage with its sizes, training with no run and a run, backup before and after, independence's meter, night, speed, foresight's ledger);
   LINKS with no account, an account linked and one failed, a draft for his OK, the notifications' list empty and full; SOCIAL's queue empty,
   a post waiting for APPROVE, a post sent, a post that failed. List every rough spot: a state with no message (empty, loading, error,
   offline, nothing kept yet, refused), a word not his (developer words: "worker", "sync", "fetch", "status", "token", "payload", a raw
   browser string, a label that repeats its row, a sentence over 20 words, two where one would do), a number without its unit or its word
   (a price without its currency and its time, a size without MB, a rating without its word, a percentage without what it is of), a wait
   over half a second with no words (a statement being read, a chart drawing, a stream buffering, a backup writing, a page of memory loading),
   a tap that does nothing or does two things, a control under 44 pt, anything sideways, a thing a good app of that kind does better (a
   banking app's statement, a markets app's chart, a radio app's player, a notes app's search, a settings page in the phone's own style). Rank
   by how much he would feel it. The whole list is in the report, per screen, before any fix.
2. **FIX THE TOP TWENTY-FIVE (SPENDING three, THE MARKETS four, THE RADIO three, MEMORY four, SETTINGS' pages four, SYSTEM's pages three,
   LINKS two, SOCIAL two), each the smallest change that does the job, each with a spec check that fails on the old code.** Known to start
   with, from the specs' own comments and the earlier passes' leftovers: SPENDING's amounts to the penny with the currency, a month with nothing
   said as that with the next thing, a nudge in one sentence; a MARKETS price always with its time ("as of 14:02", never bare), a chart that
   fails said with RETRY, offline with the last price and how old it is, a watch's trip said as "X fell under Y at 14:02"; the RADIO's PLAY
   wait said ("Tuning…") and a dead stream said with TRY ANOTHER, the sleep timer's end said; MEMORY's FORGET with an undo bar and the line
   that says what was forgotten, a search with no hit with what to try, the timeline's day headings in his words ("Yesterday", not a date
   alone), the empty state with the one next thing; SETTINGS' every switch with one line of what it does and what changes when off, faces with
   none said with the rule's line, the voice page's record state under his thumb; SYSTEM's every number with its unit and its "as of", a
   running loop with its wait and STOP, backup's size said before the tap (POLISH 3 owns the System front, not its pages: do not do its ten);
   LINKS' failed account said with the one thing to try, a draft for his OK with SEND and NOT THIS under his thumb; SOCIAL's post waiting for
   APPROVE with the exact text he approves, a failed post said with RETRY, never sent twice; every control 44 pt; the chat phrases that open
   each screen listed on it in one line (119) where a local phrase exists (list what opens; invent no new ability).
3. **THE STATES RATCHET gains PLAN and ME.** The table in apps/edge/test/ratchet.test.mjs gains rows for SPENDING, THE MARKETS, THE RADIO,
   MEMORY, SETTINGS' pages, SYSTEM's pages, LINKS and SOCIAL, measured on the base and pinned at the new, higher number (equal or higher from
   then on); `sourceOf`'s directory list gains the new directories. The before and after counts per screen in the report.
4. **WORDS.** Each page's introduction at most one line; each row's helper one sentence that never repeats its label; the catalogue words for
   PLAN and ME re-cut to the same voice; nothing lost: a fact cut from a screen goes to its "?" (the WHY pattern) or a sheet, never to smaller
   type. Each screen's lines in one pure words file (features/<screen>/words.ts) the spec imports.
5. **PROVE IT.** Before-and-after stills of SPENDING, THE MARKETS, THE RADIO, MEMORY's timeline, a SETTINGS page, a SYSTEM page, LINKS and
   SOCIAL at 440 (sixteen stills, written by the spec, deleted after the report lists them) and the measured numbers before and after where
   there are numbers (a statement's read, a chart's draw, a stream's start, a backup's write).
6. **LEAVE THE LIST.** What was found and not fixed, ranked, with why, per screen, so the next pass knows.

## What must not change

The social posting rule (APPROVE every time, the exact text shown); what memory keeps and FORGET's effect; the backup's format and the
restore; the markets' feeds and their maths; the radio's stream code; faces and voices on the phone only; the first-screen budget and every
other budget; GLASS pixel-equal; ONE INK's page; every control 44 pt; nothing sideways at 440 × 956 or 390 × 844; the finding rule; the colour
ratchet (hex 506, rgba 1016, radiusPx 470, total 1992: equal or lower); the prompt guard; no new key; nothing that can cost money; nothing
fetched that was not fetched before; the Agenda's, Settings' and System's fronts (POLISH 3's).

## Tests (each fails on the code before this brief; run against it once and say so)

- tests/planmepass.spec.mjs (new; `all=` word `planmepass` at the END of the list in check.yml, nothing else in .github touched), at 440 and
  390: one check per fix (twenty-five, grouped SPENDING · THE MARKETS · THE RADIO · MEMORY · SETTINGS · SYSTEM · LINKS · SOCIAL), each named
  for the rough spot it closes; plus, for every screen: the empty state's words and key; a load shows its waiting words; a forced error shows
  his words and no raw string; offline's words; every control 44 pt; BODY 21 clips nothing; nothing sideways; the chat phrases listed on the
  screen open it; a post is never sent without APPROVE; FORGET's undo puts the memory back.
- apps/edge/test/ratchet.test.mjs gains PLAN's and ME's rows in the STATES RATCHET (equal or higher).
- spending, markets, radio, memory, settings, backup, independence, notifications, social, upgrades, progress, agenda, hubcards, deck, nav,
  speed2, look, ink, thescan, seepass, homepass, lifepass unchanged unless a fix lives in a screen they own; then that spec's check is the
  proof, red before, green after, nothing loosened.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8841:
`(nohup setsid node tests/preview-server.mjs 8841 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8841.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8841 NO_GL_SHOTS=1 timeout 590 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` and tests/.shots are NEVER committed (`git status` before every commit; tests/.shots removed after
every run). In the foreground, alone, one after another: planmepass, spending, markets, memory, settings, backup, independence,
notifications, social, upgrades, progress, agenda, hubcards, deck, nav, speed2, look, ink, thescan, seepass, homepass, lifepass; radio once,
its known audio red named and its other checks read. The brain tests once at the end (rebuild the preview's brain bundle first:
`npx esbuild src/index.ts --bundle --format=esm --platform=neutral --external:cloudflare:sockets --outfile=test/.build/brain.mjs` in
apps/edge). A timing budget missed under load is rerun alone before it is called red and the budget is never changed; a spec killed at 590 s
with no failure line is rerun once alone and, if killed again, reported as that with the last line it printed. Known sandbox reds not
touched: direct, aim, radio's audio, scroll, safari, eye's own screenshot, tabs2, talk's cooling lines, tabs' jump bar under load, look's
BODY 21 cut on the Theme page. The machine is shared (load 11 to 20): one spec at a time.

## The owner's phone check

1. PLAN → the Agenda → SPENDING with no statement: what does it tell you to do? Add one: amounts to the penny; a month with nothing says so.
2. THE MARKETS: every price has its time; aeroplane mode: the last price and how old it is; a chart that cannot load says RETRY.
3. THE RADIO: PLAY says "Tuning…"; a dead station says TRY ANOTHER; the sleep timer ends and says so.
4. ME → MEMORY: FORGET one thing: the undo bar; search nonsense: what to try; the timeline says "Yesterday", not a date alone.
5. SETTINGS: each switch has one line of what it does; faces with none says the rule's line. SYSTEM's pages: every number has its unit and
   its "as of"; BACKUP says its size before you tap.
6. LINKS: an account that fails says the one thing to try; a draft for your OK has SEND and NOT THIS under your thumb. SOCIAL: a post waits
   for APPROVE with the exact words; a failed post says RETRY and never goes twice.
7. Biggest text in each of the eight: nothing cut. Each screen lists the words that open it from the chat: say one.
8. Do PLAN and ME feel like one app with the rest now? Say which screen does not.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/planmepass-report.md: the measured list per screen (before
any fix); the twenty-five fixes with before and after (words quoted, numbers where there are numbers, the sixteen stills named); the
states-ratchet counts before and after per screen; the leftovers ranked per screen; each spec's last line (before and after for the new one);
NEEDS HIS WORD; the phone check as above; the commit list. One commit per fix on builder/planmepass; the orchestrator squashes to one on
landing.
