# BRIEF: QUALITY PASS — LIFE (the eight packs made right; nothing new added)

BRIEF-QUALITY-LIFE (OWNER-ISSUES 178 "i want everything to have insane quality even if there's things in the past which we've had which
could have better quality"; 119 "they're just so hard to find"; 105, 111, 117 the three packs builds; QUEUE-11-NOV item 13, the first QUALITY
PASS). One builder, one PR. The mid tier. Nothing new is added: the eight packs of the LIFE room (MONEY, BODY, KITCHEN, PEOPLE, WORK, CREATIVE,
OUTSIDE, HOME: features/{money,body,kitchen,people,work,creative,outside,homeadmin}/*, their brain tools in apps/edge/src/tools/{money,body,
kitchen,people,work,creative,outside,homeadmin}.ts where they exist, and packages/shared/src/* pure parts) are measured and made right by the
method of BRIEF-UPGRADE-PASS, with a STATES RATCHET so the old shape cannot return. Starts from POLISH 1's branch (builder/polish1, head
72f121c6), so its one error voice (ui/hisWords.ts) and wait helper (ui/wait.ts) are in the tree: the worktree is made FROM THAT HEAD and the
orchestrator lands only the diff above it, after POLISH 1 is on main. Read STANDARD.md, BRIEF-UPGRADE-PASS.md (the method), BRIEF-POLISH-1.md,
BRIEF-PACKS-1.md, BRIEF-PACKS-2.md, BRIEF-PACKS-3.md, BRIEF-TABS.md (how each pack became a screen), `tests/packs.spec.mjs`, `tests/packs2.
spec.mjs`, `tests/packs3.spec.mjs`, `tests/tabs.spec.mjs`. THE QUALITY RULE holds (every state designed, every word his, every wait said, every
number honest, every control 44 pt, nothing merely fine).

## His words
"Even with all this new stuff added I still don't feel like there's more new things cuz they're just so hard to find" (1 Nov, 119). "i want
everything to have insane quality even if there's things in the past" (11 Nov, 178). The packs were built in three strong days a week before
the design system and THE QUALITY RULE; they work, and they feel like a first draft beside the rooms built since.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. The packs' own tool files are NOT protected,
but their `action` enums and the words that turn a group on are the kernel's contract: a tool's actions are not renamed or removed. Nothing of
another room's files beyond the packs' own (LIFE EASIER's money nudges and watchers land before this: do not restructure money.ts's watch region;
re-cut only its words).

## What is made right

1. **MEASURE FIRST, WRITTEN DOWN (the method's step 1), ALL EIGHT.** Open each pack at 440 × 956 and 390 × 844 as he would (the LIFE room, the
   pack's tile, each of its pills; the chat phrase that opens each sheet; BODY 21; reduced motion; the brain mocked where it must be), and list
   every rough spot: a state with no message (empty, loading, error, offline, nothing kept yet, permission refused), a word not his (developer
   words, a library's text, a raw browser string, a label that repeats its row, a sentence over 20 words, two where one would do), a wait
   over half a second with no words, a number without its unit or its word (estimate · measured · from your statement), a tap that does
   nothing or does two things, a control under 44 pt, anything sideways, a thing a good app of that kind does better (a timer app, a to-do
   app, a budget app, a people app). Rank by how much he would feel it. The whole list is in the report, per pack, before any fix.
2. **FIX THE TOP TEN PER PACK (eighty fixes), each the smallest change that does the job, each with a spec check that fails on the old code.**
   Known to start with, from the critic's reading and the specs' own comments: every pack's empty state in his voice with the one next thing
   (MONEY with no statement: one line and PASTE A STATEMENT; PEOPLE with no one: "Tell me about someone." and the field; HOME with nothing due:
   the bin day if known else how to tell me); every fetch and every brain ask under waiting() with what for ("Reading your statement…",
   "Working out who owes whom…"); every error through sayError, never a raw string (POLISH 1's lint stays at zero across the packs); every
   number with its unit and its word (£ to the penny, a timer's minutes, a run's distance "measured by the phone", a bill's amount "from the
   bill you pasted"); the camera's and the GPS's refusals said once in his words with how to allow them; the BODY reps counter's and the
   running coach's START and STOP at 44 pt under the thumb; the KITCHEN timer's ring stopping on one tap anywhere on its card; the CREATIVE
   pages' downloads with the size said before the tap; OUTSIDE's "USE WHERE I AM NOW" saying once what is sent and that nothing is kept;
   WORK's interview critique in plain words with the time said as "62 seconds, measured"; HOME's bills list in date order with "due in 3 days"
   not a bare date; the chat phrases that open each sheet listed on the pack's own screen in one line so they can be found (119).
3. **THE STATES RATCHET (apps/edge/test/ratchet.test.mjs gains it).** For each of the eight packs' screens and sheets, a table pins which
   states are designed, read from the source by a marker the builder adds where each state is drawn (a `data-state="empty|loading|error|
   offline"` on the element, or a `/* state: empty */` comment the test greps where no element fits): the count per screen is measured on the
   base and pinned at the new, higher number (equal or higher from then on, the same shape as the colour ratchet but upward). A screen that
   loses a state fails the test. The before and after counts per screen in the report.
4. **WORDS.** Each pack's screen introduction at most one line; each pill's helper one sentence that never repeats the pill; each card's one
   key; the catalogue words (packages/shared/src/catalogue/*) for the packs re-cut to the same voice; nothing lost: a fact cut from a screen
   goes to its "?" (the WHY pattern) or a sheet, never to smaller type.
5. **PROVE IT.** Before-and-after stills of every pack at 440 (sixteen stills, written by the spec, deleted after the report lists them) and the
   measured numbers before and after where there are numbers (a sheet's open time, a statement's read time, a timer's set-to-ring).
6. **LEAVE THE LIST.** What was found and not fixed, ranked, with why, per pack, so the next pass knows.

## What must not change

The packs' brain tools' actions and the words that turn each group on; what each pack keeps and where (the phone or his brain, as each
header comment says); the privacy lines in every pack (PEOPLE never looks anyone up; OUTSIDE's position sent once on his tap and kept nowhere;
BODY's camera and GPS start only on START); the first-screen budget and every other budget; GLASS pixel-equal; ONE INK's page; every control
44 pt; nothing sideways at 440 × 956 or 390 × 844; the finding rule; the colour ratchet (hex 506, rgba 1016, radiusPx 470, total 1992: equal or
lower); the prompt guard; no new key; nothing that can cost money.

## Tests (each fails on the code before this brief; run against it once and say so)

- tests/lifepass.spec.mjs (new; `all=` word `lifepass` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390:
  one check per fix (eighty, grouped by pack), each named for the rough spot it closes; plus, for every pack: the empty state's words and key;
  a fetch shows its waiting words; a forced error shows his words and no raw string; every control 44 pt; BODY 21 clips nothing; nothing
  sideways; the chat phrases listed on the screen open the sheet.
- apps/edge/test/ratchet.test.mjs gains the STATES RATCHET (eight screens' state counts, equal or higher).
- packs, packs2, packs3, tabs, hubcards, deck, nav, speed2, look, ink, thescan unchanged unless a fix lives in a screen they own; then that
  spec's check is the proof, red before, green after, nothing loosened.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8826:
`(nohup setsid node tests/preview-server.mjs 8826 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8826.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8826 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is never committed. In the foreground, alone, one after another: lifepass, packs, packs2, packs3,
tabs, hubcards, deck, nav, speed2, look, ink, thescan, polish1. The brain tests in the background once at the end (rebuild the preview's brain
bundle first: `npx esbuild src/index.ts --bundle --format=esm --platform=neutral --external:cloudflare:sockets --outfile=test/.build/brain.mjs`
in apps/edge). A timing budget missed under load is rerun alone before it is called red. Known sandbox reds not touched: direct, aim, radio,
scroll, safari, eye's own screenshot, tabs2, talk's cooling lines, tabs' `data-id="eye"` finding tap.

## The owner's phone check

1. LIFE: open each of the eight. Does each read as the same app as the newer rooms? Say which does not.
2. MONEY with nothing pasted: one line and the key. Paste a statement: "Reading your statement…" then the month's card, every amount to the penny.
3. KITCHEN: "timer 8 minutes for the pasta"; when it rings, one tap anywhere on the card stops it.
4. BODY: REPS: the camera's ask in Ghosty's words; refuse it: what it says. START and STOP under your thumb.
5. PEOPLE with no one: "Tell me about someone." Tell it one birthday: the card and the two reminders.
6. OUTSIDE: USE WHERE I AM NOW says once what is sent. HOME: a bill pasted shows "due in N days".
7. Turn Wi-Fi off and open each pack: every one says what still works. Biggest text: nothing cut.
8. Each pack's screen lists the words that open it from the chat: say one; does it open?

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/lifepass-report.md: the measured list per pack (before any
fix); the eighty fixes with before and after (words quoted, numbers where there are numbers, the sixteen stills named); the states-ratchet
counts before and after per screen; the leftovers ranked per pack; each spec's last line (before and after for the new one); NEEDS HIS WORD;
the phone check as above; the commit list. One commit per fix on builder/lifepass; the orchestrator squashes to one on landing.
