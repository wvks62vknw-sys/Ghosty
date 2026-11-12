# BRIEF: QUALITY PASS — LEARN (courses, the Arcade, the GYM, School, the Library, Learning, the Coach made right; nothing new added)

BRIEF-QUALITY-LEARN (OWNER-ISSUES 178 "i want everything to have insane quality even if there's things in the past which we've had which
could have better quality"; 125 the Library as a library; QUEUE-11-NOV, the fifth QUALITY PASS). One builder, one PR. The mid tier. Nothing
new is added: the LEARN room is measured and made right by the method of BRIEF-UPGRADE-PASS, and the STATES RATCHET (apps/edge/test/
ratchet.test.mjs, grown by the LIFE, HOME, SEE and MAKE passes) gains LEARN's screens. What this pass owns: COURSES (features/learn/{index,
store}.ts: the MAP of a course, a lesson's six parts, the pace, the quiz), THE ARCADE (features/arcade/index.ts: the shelf, GET with the
size, a game's card and its states; the games' own engines are not touched), THE GYM (features/gym/{index,play,store,art,chessrated}.ts:
the twenty-two games' cards, TRAIN, PLAY HIM, the ratings; the training workers are not touched), SCHOOL (features/school/index.ts: the
ladder, SIT, a paper's progress and its result), THE LIBRARY (features/library/{index,reader}.ts: the shelf, add, search, the reader's
pages, READ TO ME, the notes), LEARNING (features/learning/{index,library,sheet,typing,voices}.ts: the six pills and the sheet's twelve
pages), THE COACH (features/coach/index.ts and coach/sheet.ts: the tuner, the lessons, the metronome), and the catalogue words for all of
them (packages/shared/src/catalogue/*). Starts FROM THE MAKE PASS'S HEAD (builder/makepass, when it hands back), so the ratchet's table with
its LIFE, HOME, SEE and MAKE rows, POLISH 1's error voice (ui/hisWords.ts), the wait helper (ui/wait.ts) and the words-file pattern
(features/lens/words.ts: a screen's lines in one pure file the spec reads) are in the tree; the orchestrator lands only the diff above that
head, after the MAKE pass is on main. Read STANDARD.md, BRIEF-UPGRADE-PASS.md (the method), BRIEF-QUALITY-LIFE.md, BRIEF-QUALITY-HOME.md,
BRIEF-QUALITY-SEE.md and BRIEF-QUALITY-MAKE.md (the four passes before; the SEE and MAKE reports in the scratchpad show the measured list's
shape), BRIEF-LIBRARY-READER.md, `tests/learn.spec.mjs`, `tests/arcade.spec.mjs`, `tests/gym.spec.mjs`, `tests/school.spec.mjs`,
`tests/library.spec.mjs`, `tests/reader.spec.mjs`, `tests/reader2.spec.mjs`, `tests/sit.spec.mjs`, `tests/packs.spec.mjs` (the learning and
coach packs' first checks). THE QUALITY RULE holds (every state designed, every word his, every wait said, every number honest, every control
44 pt, nothing merely fine).

## His words
"i want everything to have insane quality even if there's things in the past" (11 Nov, 178). "i can't pull up the library and read them
myself" (125, since fixed; the reader is now the room's best screen and sets the bar for the rest). LEARN is the room with the most screens
built the earliest (courses, the Arcade, the GYM and School all from the first fortnight), each with its own voice; this pass gives them one.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. NOT THIS PASS'S: the games themselves
(apps/web/src/arcade's engines, the games' harness pages and tests/games*.spec: GAMES 5 and 6 own them; a game's card and its states on the
shelf are this pass's), the GYM's training workers and the ratings' maths (words and drawn states only), School's papers and marking (the
offline brain's: words and drawn states only), the reader's page engine (library/reader.ts's drawing of a PDF, Word file or e-book is kept;
its words and states are this pass's), the learning and coach packs' timers, voices and pitch code (words and states only), the LEARN hub's
cards (shell/hubcards.ts, shell/areadefs.ts: a hub word is re-cut in the catalogue only), the Arcade's download rule (the size said before
GET, Wi-Fi only: kept exactly). Nothing of another room's files.

## What is made right

1. **MEASURE FIRST, WRITTEN DOWN (the method's step 1), ALL SEVEN.** Open, at 440 × 956 and 390 × 844, in GLASS, THE SCAN and ONE INK,
   reduced motion on and off, the brain live and mocked dead, the signal on and off, nothing kept yet and things kept: COURSES with no course,
   a course planned (the MAP), a lesson's six parts, a quiz answered right and wrong, the brain dead mid-lesson; THE ARCADE's shelf cold, GET
   on mobile data, a fetch mid-way, a fetch that fails, a game kept, a game that will not start; THE GYM's cards, a game training (the
   timer, the progress), PLAY HIM, a lost and a won game, the ratings; SCHOOL's ladder cold, SIT while the paper runs ("Question x of y"), a
   paper passed, a paper failed, the offline brain not kept; THE LIBRARY's shelf empty, a file added, a file the reader cannot open, a search
   with no hit, the reader's pages, READ TO ME, a note; LEARNING's six pills each cold and mid-drill, a streak kept and one broken; THE COACH's
   tuner with the microphone refused and granted, a lesson, the metronome. List every rough spot: a state with no message (empty, loading,
   error, offline, nothing kept yet, refused), a word not his (developer words: "worker", "engine", "model", "fetch", "status", a library's
   text, a raw browser string, a label that repeats its row, a sentence over 20 words, two where one would do, a number without its unit or
   its word (a rating, a size, a time, a score out of what), a wait over half a second with no words (a course being planned, a game's
   fetch, TRAIN's first move, a paper's marking, a file being opened, a page being drawn), a tap that does nothing or does two things, a
   control under 44 pt, anything sideways, a thing a good app of that kind does better (a courses app, a chess app, an e-reader, a language
   app). Rank by how much he would feel it. The whole list is in the report, per screen, before any fix.
2. **FIX THE TOP TWENTY-FIVE (COURSES four, THE ARCADE three, THE GYM four, SCHOOL three, THE LIBRARY five, LEARNING three, THE COACH three),
   each the smallest change that does the job, each with a spec check that fails on the old code.** Known to start with, from the specs' own
   comments and the earlier passes' leftovers: a course being planned said once ("Planning your course…") and the brain dead mid-lesson said
   with what still works (the parts already read); the quiz's wrong answer said kindly with the right one; the Arcade's every state in his
   voice (mobile data: "On Wi-Fi I'll fetch it (38 MB)", mid-way with the bytes, failed with RETRY, a game that will not start with the one
   thing to try); the GYM's TRAIN wait with its first move's time, the rating with its word ("about club level"), a lost game said as that
   with PLAY AGAIN; SCHOOL's ladder with what unlocks the next stage in one line, SIT's progress with the time left, a failed paper with what
   to read, the offline brain not kept offering its pack with the size; the Library's empty shelf with the one next thing, an unreadable file
   said in his words with what works instead, a search with no hit with what to try, the reader's page draw said when it is slow, READ TO
   ME's stop under his thumb; LEARNING's each pill's helper one sentence, a broken streak said without blame; the COACH's microphone refusal
   in his words with how to allow it (as the Lens says it: Settings, Ghosty, Microphone), the tuner's note with its cents and the word
   ("a little flat"); every control 44 pt (the shelf's GET keys, the GYM's board's squares where they are taps, the reader's page controls);
   the chat phrases that open each screen listed on it in one line (119) where a local phrase exists (list what opens; invent no new
   ability).
3. **THE STATES RATCHET gains LEARN.** The table in apps/edge/test/ratchet.test.mjs gains rows for COURSES, THE ARCADE, THE GYM, SCHOOL, THE
   LIBRARY (the shelf, the reader), LEARNING and THE COACH, measured on the base and pinned at the new, higher number (equal or higher from
   then on); `sourceOf`'s directory list gains the new directories. The before and after counts per screen in the report.
4. **WORDS.** Each screen's introduction at most one line; each pill's helper one sentence that never repeats the pill; the catalogue words
   for LEARN re-cut to the same voice; nothing lost: a fact cut from a screen goes to its "?" (the WHY pattern) or a sheet, never to smaller
   type. Each screen's lines in one pure words file (features/<screen>/words.ts) the spec imports.
5. **PROVE IT.** Before-and-after stills of COURSES' MAP, THE ARCADE's shelf, THE GYM's cards, SCHOOL's ladder, THE LIBRARY's shelf and the
   reader, LEARNING and THE COACH at 440 (sixteen stills, written by the spec, deleted after the report lists them) and the measured numbers
   before and after where there are numbers (a course's plan, a game's fetch, TRAIN's first move, a file's open).
6. **LEAVE THE LIST.** What was found and not fixed, ranked, with why, per screen, so the next pass knows.

## What must not change

The Arcade's download rule (the size said before GET, Wi-Fi only, kept on the phone, removable); what trains and plays on the phone (the
GYM's workers, School's offline brain); the reader's drawing of a file and READ TO ME's voice path; the microphone's rule (starts only on
START, stops when left, nothing recorded to keep); the learning and coach packs' timers and voices; the first-screen budget and every other
budget; GLASS pixel-equal; ONE INK's page; every control 44 pt; nothing sideways at 440 × 956 or 390 × 844; the finding rule; the colour
ratchet (hex 506, rgba 1016, radiusPx 470, total 1992: equal or lower); the prompt guard; no new key; nothing that can cost money; nothing
fetched that was not fetched before.

## Tests (each fails on the code before this brief; run against it once and say so)

- tests/learnpass.spec.mjs (new; `all=` word `learnpass` at the END of the list in check.yml, nothing else in .github touched), at 440 and
  390: one check per fix (twenty-five, grouped COURSES · THE ARCADE · THE GYM · SCHOOL · THE LIBRARY · LEARNING · THE COACH), each named for
  the rough spot it closes; plus, for every screen: the empty state's words and key; a load shows its waiting words; a forced error shows his
  words and no raw string; the refused microphone's words; every control 44 pt; BODY 21 clips nothing; nothing sideways; the chat phrases
  listed on the screen open it.
- apps/edge/test/ratchet.test.mjs gains LEARN's rows in the STATES RATCHET (equal or higher).
- learn, arcade, gym, school, library, reader, reader2, sit, packs, hubcards, deck, nav, speed2, look, ink, thescan, makepass, seepass,
  homepass, lifepass unchanged unless a fix lives in a screen they own; then that spec's check is the proof, red before, green after, nothing
  loosened.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8840:
`(nohup setsid node tests/preview-server.mjs 8840 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8840.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8840 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is NEVER committed (`git status` before every commit). In the foreground, alone, one after
another: learnpass, learn, arcade, gym, school, library, reader, reader2, sit, packs, hubcards, deck, nav, speed2, look, ink, thescan,
makepass, seepass, homepass, lifepass. The brain tests in the background once at the end (rebuild the preview's brain bundle first:
`npx esbuild src/index.ts --bundle --format=esm --platform=neutral --external:cloudflare:sockets --outfile=test/.build/brain.mjs` in
apps/edge). A timing budget missed under load is rerun alone before it is called red; a spec killed at its 590 s budget with no failure line
is rerun once alone and, if killed again, reported as that with the last line it printed. Known sandbox reds not touched: direct, aim,
radio, scroll, safari, eye's own screenshot, tabs2, talk's cooling lines, tabs' `data-id="eye"` finding tap, look's BODY 21 cut on the Theme
page.

## The owner's phone check

1. LEARN → courses with none: what does it tell you to do? "Teach me photosynthesis": the wait's words, then the MAP. Aeroplane mode
   mid-lesson: what still works?
2. The Arcade on mobile data: GET says the size and waits for Wi-Fi. Pull Wi-Fi mid-fetch: the words. A game kept: it opens.
3. The GYM: TRAIN on chess: what it says before the first move; PLAY HIM; lose on purpose: the words. Your rating with its word.
4. SCHOOL: what unlocks the next stage? SIT a paper: the progress and the time left; fail it: what to read.
5. The Library empty; add a PDF; search nonsense; READ TO ME and stop it with one tap. A file it cannot open: the words.
6. LEARNING: each pill's one line; break a streak. The COACH with the microphone refused: how to allow it; allowed: hum a note, the cents.
7. Biggest text in each of the seven: nothing cut. Each screen lists the words that open it from the chat: say one.
8. Does LEARN feel like one room now? Say which screen does not.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/learnpass-report.md: the measured list per screen (before
any fix); the twenty-five fixes with before and after (words quoted, numbers where there are numbers, the sixteen stills named); the
states-ratchet counts before and after per screen; the leftovers ranked per screen; each spec's last line (before and after for the new one);
NEEDS HIS WORD; the phone check as above; the commit list. One commit per fix on builder/learnpass; the orchestrator squashes to one on
landing.
