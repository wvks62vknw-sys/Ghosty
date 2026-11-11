# BRIEF: THE OCTOBER IDEAS, SLICE 3 — FURTHER (interpreter mode, the orb as a map of what he knows, his own missing tools, the lab, WALK ME THROUGH IT, WHAT CHANGED SINCE YESTERDAY, REHEARSE, places and spending, the nature diary, the Sunday note)

BRIEF-OCT-IDEAS-3 (OWNER-ISSUES 176 "do all of it" and 178 "insane quality"; IDEAS-24-OCT "More advanced"; STARS 166, 167, 168 offered on 4 Nov;
STATUS section 6 "New ideas from today" of 1 Nov; QUEUE-11-NOV item 3). Ten things, each free, each within the rules; the three that need the
brain's own files are built to the line the licence allows and the rest named under NEEDS HIS WORD. One builder, one PR. The design system is the
only look; THE SCAN, ONE INK and GLASS all keep working; THE QUALITY RULE holds (every state designed, every word his, every wait said, every
number honest, every control 44 pt, nothing merely fine).

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. New brain routes go in their own files and
are mounted where the feature routes already mount; if that needs index.ts, it is NEEDS HIS WORD and the phone side is built to a stub.

## What is built

1. **INTERPRETER MODE.** A screen under SEE (and the words "interpreter", "translate for us", "help me talk to…"): two halves of the screen, one
   facing him, one facing the other person (the far half upside down), each with a hold-to-talk key; what is said in one language is heard and
   written in the other, both ways, using the phone's own speech recognition and voice (assistant/voice.ts speakIn) and the offline translation
   already on the phone when there is no signal (the Lens's translate path), the brain's when there is. Languages picked once at the top (the
   last pair remembered). Nothing recorded; nothing of the other person kept; a plain line says so on the screen.
2. **THE ORB AS A REAL MAP OF WHAT HE KNOWS.** On Home, a long hold on the orb (or "what do you know?") opens MIND AS A MAP: the memory's own
   records (features/memory, the timeline and places) laid out as nodes by subject, the orb's own points reused (features/core/mind.ts), the
   nearest subjects largest; tap a node and the memory behind it is read out in a sheet with KEEP / FORGET (the existing memory actions with UNDO).
   No model; nothing sent; it is a view of what is already on the phone and in his own brain's memory.
3. **GHOSTY BUILDS HIS OWN MISSING TOOLS.** When he says he cannot do a thing ("Not yet. Want me to learn it?" already exists), YES now also drafts
   a self-edit job in the Workshop (features/workshop, the existing self-edit path with its DRAFT card): a one-paragraph plan of the change in
   his words, the files he would touch, the test he would add; SHIP IT stays the owner's tap and nothing is shipped otherwise. Only the drafting is
   new; the job runs through the self-edit that exists.
4. **THE LAB.** A tab under MAKE: experiments on free public data, each kept as a page: a question, the data's source (public only), the chart or
   table, what it showed, the date; "run it again" refreshes; pages export as a built page like a website draft does. Five seeded experiments
   from the sources the Digest already reads (quakes by month, the rain at Home against the forecast's record, the city's bus punctuality, the
   markets' week, space weather), so the tab is never empty.
5. **WALK ME THROUGH IT (STARS 166).** The words "walk me through <screen>" or a long hold on any screen's card in the plan: he drives the screen
   step by step: a soft pointer on the one key to press next, one sentence of why in his voice (spoken if the voice is on), NEXT / DONE; the steps
   come from each screen's own `thingsOf` list (shell/rooms.ts) and the deck's example prompts, so every screen has a walk with no new copy to
   maintain. Reduced motion stills the pointer's pulse.
6. **WHAT CHANGED SINCE YESTERDAY (STARS 167).** One line per room on the plan ("LEARN: he passed Year 4 maths", "PLAN: two new alerts near Home",
   "LIFE: £42 added"), from the shared mind and the local stores only, made on the phone; a room with nothing new says nothing. The words
   "what changed?" read them all.
7. **REHEARSE (STARS 168).** A screen under LEARN: he rehearses a conversation or a talk against Ghosty: the situation in his words ("a job
   interview for a junior mechanic", "telling my landlord about the damp"), Ghosty plays the other side in his own voice (the brain, with the
   persona's fieriness setting), the owner answers by voice or text, three rounds, then NOTES: what landed, what to tighten, in five lines; a
   presentation mode where he talks for a minute and gets back his filler words, pace and the one line to cut. Nothing kept unless he taps KEEP.
8. **PLACES AND SPENDING TOGETHER.** From the statements and his saved places only: "you spent £62 near work this week" on the SPENDING sheet and
   in the Brief's money line when a merchant's saved place is known; the commute's cost (the fare or the fuel estimate from his own saved
   commute) in the Brief with "estimate" said. No live GPS to the brain; nothing new fetched.
9. **THE NATURE DIARY.** The Lens's living-things cards (lens/living.ts) kept in the library as a diary ("seen: a robin, 24 Oct, Cannon Hill Park")
   when he taps KEEP on the card (never by itself), with a small map of where from his own position at the time (on the phone only, as a saved
   place, not sent to the brain); a page under LEARN, the library's own reader for it.
10. **THE SUNDAY NOTE.** "What Ghosty learned this week", Sunday morning, from the LOOPS card and the Report card, in the inbox and on Telegram
    (the Sunday letter already exists: this is one more section of it, not a second message), five lines at most, honest about the gap.

## What must not change

The first-screen budget and every other budget; GLASS pixel-equal; ONE INK's page; every control 44 pt; nothing sideways at 440 × 956 or 390 ×
844; the finding rule (every new screen reachable in three taps or one word, and on Every screen); the ratchet ceiling (hex 506, rgba 1016,
radiusPx 470, total 1992: equal or lower); the prompt guard; no new key; nothing posted, sent, shipped or bought without his tap; no face, voice
or word of another person kept (interpreter mode keeps nothing; REHEARSE keeps only on KEEP).

## Tests (each fails on the code before this brief; run against it once and say so)

- tests/further.spec.mjs (new; `all=` word `further` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390: (a)
  interpreter mode opens from the words and from SEE, two halves, hold-to-talk on each, a seeded phrase one way is written and spoken the other
  way (the fake speaker counts), nothing stored after leave; (b) the long hold on the orb opens MIND AS A MAP with nodes from seeded memory, a tap
  reads one and FORGET undoes; (c) "Not yet" then YES drafts a Workshop job with the three parts and no SHIP without the tap; (d) the LAB lists
  five pages, one runs again and its date moves; (e) "walk me through the library" shows the pointer on the first key and NEXT moves it; (f) with
  seeded changes the plan shows one line on three rooms and none on the rest; (g) REHEARSE runs three rounds against the mock brain and shows
  NOTES, nothing kept without KEEP; (h) seeded statements and a saved work place give the "near work" line; (i) KEEP on a living card files a diary
  entry with its place and the diary page lists it; (j) the Sunday letter's fixture carries the new section (the brain test below covers the
  words).
- apps/edge/test/sundaynote.test.mjs (new; imported from an existing test file as kernel-yes was, one import line, since the test list is
  protected; NEEDS HIS WORD names it): the letter's new section from seeded loop and report records, five lines at most.
- speed2, look, ink, thescan, lens, library, memory, workshop, brief, spending specs unchanged unless a fix lives in a screen they own.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8814:
`(nohup setsid node tests/preview-server.mjs 8814 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8814.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8814 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is never committed. In the foreground, alone, one after another: further, speed2, look, ink,
thescan, lens, library, memory, brief, spending (or the spec that owns SPENDING), workshop (or sites), talk, layout, nav, deck. The brain tests
in the background once at the end (rebuild the preview's brain bundle first if a brain route changed: `npx esbuild src/index.ts --bundle
--format=esm --platform=neutral --external:cloudflare:sockets --outfile=test/.build/brain.mjs` in apps/edge). A timing budget missed under load
is rerun alone before it is called red. Known sandbox reds not touched: direct, aim, radio, scroll, safari, eye's own screenshot, tabs2, talk's
cooling lines.

## The owner's phone check

1. "Interpreter": hold your key and say a sentence; the far half writes and speaks it in the other language; hand the phone over and back.
2. Hold the orb: your memories as a map; tap one; FORGET, then UNDO.
3. Ask for something he cannot do, say YES: the Workshop has the drafted job; nothing shipped.
4. MAKE, THE LAB: five pages; run one again.
5. "Walk me through the library": the pointer and the sentence, NEXT to the end.
6. Open the plan tomorrow: one line under the rooms that changed.
7. LEARN, REHEARSE: "a job interview for a junior mechanic", three rounds, NOTES.
8. SPENDING with statements and Work saved: the "near work" line; the Brief's commute cost said as an estimate.
9. Lens on a bird or a plant, KEEP: LEARN, the nature diary has it with its place.
10. Sunday morning: the letter has "what I learned this week".

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/further-report.md: what was built, each spec's last line (before
and after for the new one), found-not-fixed, NEEDS HIS WORD, the phone check as above, the commit list. One commit per step on builder/further;
the orchestrator squashes to one on landing.
