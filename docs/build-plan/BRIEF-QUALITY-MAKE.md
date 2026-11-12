# BRIEF: QUALITY PASS — MAKE (the Workshop, the 3D studio, Reverse, Space, the Workbench, Convert, House made right; nothing new added)

BRIEF-QUALITY-MAKE (OWNER-ISSUES 178 "i want everything to have insane quality even if there's things in the past which we've had which
could have better quality"; 127, 164 the MAKE room as his workbench; QUEUE-11-NOV, the fourth QUALITY PASS). One builder, one PR. The mid
tier. Nothing new is added: the MAKE room's older things are measured and made right by the method of BRIEF-UPGRADE-PASS, and the STATES
RATCHET (apps/edge/test/ratchet.test.mjs, begun by the LIFE pass and grown by the HOME and SEE passes) gains MAKE's screens. What this pass
owns: THE WORKSHOP (features/workshop/{index,draftcard}.ts with state/whatsnew.ts: the WHAT'S NEW panel, the draft cards, the things being
made and their states), THE 3D STUDIO (features/studio/{index,catalog,samples}.ts and apps/web/src/studio/*: the reactor, TAKE APART, the
catalogue search, MAKE · PHOTO, a card's credit and licence; the 3-D ENGINE's pane (engine3d/*) in words and drawn states only, its scene,
store and file untouched), REVERSE (features/reverse/index.ts: the job list, START, a finished report, SAVE TO LIBRARY), SPACE (features/
space/{index,home,fromphoto}.ts: the planner, DESIGN MY HOME, a room from a photo), THE WORKBENCH (features/workbench/{index,panels,card,
tunnel,tunnelwork}.ts: every panel's answer card, the wind tunnel), CONVERT (features/convert and apps/web/src/convert/*), HOUSE (features/
house and apps/web/src/house/*), and the catalogue words for all of them (packages/shared/src/catalogue/*). Starts FROM THE SEE PASS'S HEAD
(builder/seepass, 08a5337a), so the ratchet's table with its LIFE, HOME and SEE rows, POLISH 1's error voice (ui/hisWords.ts), the wait
helper (ui/wait.ts) and the words-file pattern (features/lens/words.ts: a screen's lines in one pure file the spec reads) are in the tree;
the orchestrator lands only the diff above that head, after the SEE pass is on main. Read STANDARD.md, BRIEF-UPGRADE-PASS.md (the method),
BRIEF-QUALITY-LIFE.md, BRIEF-QUALITY-HOME.md and BRIEF-QUALITY-SEE.md (the first three passes; the SEE report, scratchpad/seepass-report.md,
shows the measured list's shape), BRIEF-ENGINE-3D-1.md, `tests/studio.spec.mjs`, `tests/studiomake.spec.mjs`, `tests/engine3d.spec.mjs`,
`tests/reverse.spec.mjs`, `tests/space.spec.mjs`, `tests/homeplan.spec.mjs`, `tests/workbench.spec.mjs`, `tests/tunnel.spec.mjs`,
`tests/hubcards.spec.mjs`. THE QUALITY RULE holds (every state designed, every word his, every wait said, every number honest, every control
44 pt, nothing merely fine).

## His words
"i want everything to have insane quality even if there's things in the past" (11 Nov, 178). "every engineering, car or build number a first
estimate, never certified" (the rule). MAKE is the room he builds in: the oldest of its things (the Workshop, the 3D studio, Reverse, Space)
were made before the design system, the one error voice and THE QUALITY RULE; the Workbench and the tunnel carry the first-estimate rule in
their own words and must keep it.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. NOT THIS PASS'S: the MAKE hub's cards and
their band (shell/hubcards.ts, shell/areadefs.ts, tests/hubcards.spec.mjs: THE WORKSPACE build folds the editors under one EDITORS card there
and lands first; a hub word is re-cut in the catalogue only); the editors (features/docs and apps/web/src/docs, and the sheets, slides,
workspace, photo, video and game-studio trees as they land: each is new under THE QUALITY RULE and has its own pass if it needs one); the
3-D ENGINE's scene, store, file and physics (engine3d/*: words and drawn states only); the Workbench's solvers (packages/shared/src/workbench:
read only; a number is re-said, never re-computed); the catalogue's model index and its fetches (data/models3d.json, the Hugging Face path:
nothing new fetched); REVERSE's GitHub path (what it refuses without GitHub stays refused in the same place). Nothing of another room's files.

## What is made right

1. **MEASURE FIRST, WRITTEN DOWN (the method's step 1), ALL SEVEN.** Open, at 440 × 956 and 390 × 844, in GLASS, THE SCAN and ONE INK,
   reduced motion on and off, the brain live and mocked dead, the signal on and off, nothing kept yet and things kept: THE WORKSHOP cold (no
   drafts, nothing being made), with a draft, with a thing being made (the state words as it goes), a thing that failed, WHAT'S NEW with
   nothing new and with this week's; THE 3D STUDIO cold (three.js loading), the reactor, TAKE APART, a search with a hit and with none, a
   card's open (the GLB fetching), a GLB that will not load, MAKE · PHOTO with no photo and with one, the 3-D ENGINE's pane cold and with a
   scene; REVERSE with no jobs, a job running, a finished report, a failed job, START without GitHub; SPACE cold (no room), a room, a piece
   dragged too close, WILL IT FIT? each answer, DESIGN MY HOME with empty words and with the brain dead, a room from a photo with no photo and
   with a photo that gives no room; THE WORKBENCH each panel's default card, a panel with a number typed wrong (blank, negative, text), the
   wind tunnel while it starts (before its first numbers), the tunnel with the worker dead; CONVERT with nothing typed, a unit it does not
   know, a file it cannot read; HOUSE with no plan and with one. List every rough spot: a state with no message (empty, loading, error,
   offline, nothing kept yet), a word not his (developer words: "GLB", "mesh", "worker", "job", "payload", "null", a library's text, a raw
   browser string, a label that repeats its row, a sentence over 20 words, two where one would do, a number without its unit or its word
   (estimate · measured · from the file), a wait over half a second with no words (three.js's load, a GLB's fetch, the tunnel's first
   numbers, a draft being made, a photo being read), a tap that does nothing or does two things, a control under 44 pt, anything sideways,
   a thing a good app of that kind does better (a CAD viewer, a room planner, a unit converter). Rank by how much he would feel it. The whole
   list is in the report, per screen, before any fix.
2. **FIX THE TOP TWENTY-FIVE (THE WORKSHOP five, THE 3D STUDIO six, SPACE four, THE WORKBENCH and the tunnel four, REVERSE three, CONVERT
   and HOUSE three), each the smallest change that does the job, each with a spec check that fails on the old code.** Known to start with,
   from the specs' own comments and the SEE report's leftovers: three.js's load said once ("Loading the studio…") and a GLB's fetch said with
   its size where the card knows it; a GLB that will not load said in his words with the card's way out, never a console string; the
   catalogue's no-hit line with what to try; every card's credit and licence in one plain line (the licence's own name, nothing else
   renamed); TAKE APART's slider 44 pt; the Workshop's draft states in his voice (making, made, failed with RETRY, nothing yet with the one
   next thing); WHAT'S NEW empty ("Nothing new since you last looked.") and GOT IT 44 pt; REVERSE's job rows with when and their state word,
   its empty list with the one next thing, its START refusal in his words with what to connect and where; SPACE's walkway warning with the
   number and its unit ("62 cm: under the 70 cm a walkway needs"), WILL IT FIT? with why, DESIGN MY HOME with empty words refusing in one
   line, and the brain dead said as that; a room from a photo that finds no room said with what to try; the Workbench's every number with
   its unit and FIRST ESTIMATE · NOT CERTIFIED kept exactly, a wrong input said beside the field (not a silent NaN), the tunnel's start said
   ("Starting the wind…") and the worker dead said with RETRY; CONVERT's unknown unit named back with the nearest it knows, an unreadable
   file said in his words; HOUSE empty with the one next thing; every control 44 pt; the chat phrases that open each screen listed on it in
   one line (119) where a local phrase exists (the SEE pass found that only a tool-backed phrase opens some screens: list what opens, invent
   no new ability).
3. **THE STATES RATCHET gains MAKE.** The table in apps/edge/test/ratchet.test.mjs gains rows for THE WORKSHOP (and WHAT'S NEW), THE 3D
   STUDIO (the scene, the catalogue, MAKE · PHOTO, the engine's pane), REVERSE, SPACE (the planner, DESIGN MY HOME, from a photo), THE
   WORKBENCH (the panels, the tunnel), CONVERT and HOUSE, measured on the base and pinned at the new, higher number (equal or higher from then
   on); `sourceOf`'s directory list gains the new directories (features/workshop, studio, reverse, space, workbench, convert, house) and the
   `at:` form is used for apps/web/src/studio, convert, house and engine3d where a state is drawn there. The before and after counts per
   screen in the report.
4. **WORDS.** Each screen's introduction at most one line; each pill's helper one sentence that never repeats the pill; the catalogue words
   for MAKE's seven re-cut to the same voice (the editors' catalogue words untouched); nothing lost: a fact cut from a screen goes to its "?"
   (the WHY pattern) or a sheet, never to smaller type. Each screen's lines in one pure words file (features/<screen>/words.ts, as the SEE
   pass did) the spec imports, so the spec reads the very words the page is built from.
5. **PROVE IT.** Before-and-after stills of THE WORKSHOP, THE 3D STUDIO's catalogue, REVERSE, SPACE, THE WORKBENCH's first panel, the tunnel,
   CONVERT and HOUSE at 440 (sixteen stills, written by the spec, deleted after the report lists them; WebGL stills hang in the sandbox, so
   the reactor and the engine's pane are read through the page's own state as engine3d.spec does) and the measured numbers before and after
   where there are numbers (three.js's load, a card's open, the tunnel's first numbers).
6. **LEAVE THE LIST.** What was found and not fixed, ranked, with why, per screen, so the next pass knows.

## What must not change

The first-estimate rule in every Workbench, tunnel, engine and car number (FIRST ESTIMATE · NOT CERTIFIED stays, word for word, where it
stands); the solvers' numbers; the catalogue's sources, credits and licences (a licence's name is a licence's name); REVERSE's refusal without
GitHub; what the 3-D ENGINE saves and exports (engine3d.spec green, byte for byte where it checks bytes); the MAKE hub's cards and band (the
WORKSPACE build's); the first-screen budget and every other budget; GLASS pixel-equal; ONE INK's page; every control 44 pt; nothing sideways
at 440 × 956 or 390 × 844; the finding rule; the colour ratchet (hex 506, rgba 1016, radiusPx 470, total 1992: equal or lower); the prompt
guard; no new key; nothing that can cost money; nothing fetched that was not fetched before.

## Tests (each fails on the code before this brief; run against it once and say so)

- tests/makepass.spec.mjs (new; `all=` word `makepass` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390:
  one check per fix (twenty-five, grouped THE WORKSHOP · THE 3D STUDIO · SPACE · THE WORKBENCH · REVERSE · CONVERT and HOUSE), each named for
  the rough spot it closes; plus, for every screen: the empty state's words and key; a load shows its waiting words; a forced error shows his
  words and no raw string; a wrong input is said beside its field; every control 44 pt; BODY 21 clips nothing; nothing sideways; the chat
  phrases listed on the screen open it.
- apps/edge/test/ratchet.test.mjs gains MAKE's rows in the STATES RATCHET (equal or higher).
- studio, studiomake, engine3d, reverse, space, homeplan, workbench, tunnel, hubcards, deck, nav, speed2, look, ink, thescan, seepass,
  homepass, lifepass unchanged unless a fix lives in a screen they own; then that spec's check is the proof, red before, green after, nothing
  loosened.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8838:
`(nohup setsid node tests/preview-server.mjs 8838 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8838.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8838 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is NEVER committed (the SEE pass committed four by mistake; `git status` before every commit). In
the foreground, alone, one after another: makepass, studio, studiomake, engine3d, reverse, space, homeplan, workbench, tunnel, hubcards,
deck, nav, speed2, look, ink, thescan, seepass, homepass, lifepass. The brain tests in the background once at the end (rebuild the preview's
brain bundle first: `npx esbuild src/index.ts --bundle --format=esm --platform=neutral --external:cloudflare:sockets --outfile=test/.build/brain.mjs`
in apps/edge). A timing budget missed under load is rerun alone before it is called red; a spec killed at its 590 s budget with no failure
line is rerun once alone and, if killed again, reported as that with the last line it printed (not as red). Known sandbox reds not touched:
direct, aim, radio, scroll, safari, eye's own screenshot, tabs2, talk's cooling lines, tabs' `data-id="eye"` finding tap, look's BODY 21 cut
on the Theme page.

## The owner's phone check

1. MAKE → the Workshop with nothing on the go: what does it tell you to do? Ask for something small to be made and watch the card's words
   change as it goes; pull the signal mid-way: the words.
2. The 3D studio cold: what does it say while it loads? Search "kettle"; search nonsense. Open a card: its credit and licence in one line.
   TAKE APART's slider under your thumb.
3. REVERSE with no jobs; START without GitHub: the refusal and where to connect.
4. SPACE: drag two pieces too close: the gap in centimetres and the rule. DESIGN MY HOME with empty words. A room from a photo of a wall.
5. The Workbench: type "abc" into a number: said beside the field. The tunnel: what it says before the first numbers. Every number: unit
   and FIRST ESTIMATE · NOT CERTIFIED.
6. CONVERT "12 furlongs to km"; then a unit it does not know. HOUSE with no plan.
7. Biggest text in each of the seven: nothing cut. Each screen lists the words that open it from the chat: say one.
8. Does MAKE's older half feel like the same app as the editors now? Say which screen does not.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/makepass-report.md: the measured list per screen (before any
fix); the twenty-five fixes with before and after (words quoted, numbers where there are numbers, the sixteen stills named); the states-
ratchet counts before and after per screen; the leftovers ranked per screen; each spec's last line (before and after for the new one); NEEDS
HIS WORD; the phone check as above; the commit list. One commit per fix on builder/makepass; the orchestrator squashes to one on landing.
