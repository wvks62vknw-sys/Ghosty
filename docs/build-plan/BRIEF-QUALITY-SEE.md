# BRIEF: QUALITY PASS — SEE (God's Eye, the Machine view, the Lens, Threats made right; nothing new added)

BRIEF-QUALITY-SEE (OWNER-ISSUES 178 "i want everything to have insane quality even if there's things in the past which we've had which
could have better quality"; 137, 139 the Machine's marks; 55, 56, 58 the Lens's people rule; QUEUE-11-NOV item 13, the third QUALITY PASS).
One builder, one PR. The mid tier. Nothing new is added: the SEE room is measured and made right by the method of BRIEF-UPGRADE-PASS, and
the STATES RATCHET (apps/edge/test/ratchet.test.mjs, begun by the LIFE pass and grown by the HOME pass) gains SEE's screens. What this pass
owns: GOD'S EYE (features/eye/{index,places,roadahead}.ts: the globe, its search, sensor modes, layers, the target card, the labels, the zoom
rail, the public cameras' grid and card), THE MACHINE VIEW (features/eye/machine.ts, machineview.ts; the marks in ui/machine.ts are the
design system's and are re-cut in words only), THE LENS (features/lens/*: SEE, READ, HANDS, ASK, NAME, PEOPLE, MEASURE, SCAN, AIM, MARK,
PHOTO TOOLS' sheet, the liveness check; apps/web/src/vision/* only where a word or a state is drawn), THREATS (features/threats/*: the
hazards list, NEAR HOME, RECON), the offline eyes' panel (features/settings' pack rows for THE LENS'S EYES, THE NAMER, PEOPLE HE KNOWS,
MEASURE'S DISTANCE in offline/eyes.ts), the catalogue words for all of them (packages/shared/src/catalogue/*). Starts FROM THE HOME PASS'S
HEAD (builder/homepass, when it hands back), so the ratchet's table with its LIFE and HOME rows and POLISH 1's error voice (ui/hisWords.ts)
and wait helper (ui/wait.ts) are in the tree; the orchestrator lands only the diff above that head, after the HOME pass is on main. Read
STANDARD.md, BRIEF-UPGRADE-PASS.md (the method), BRIEF-QUALITY-LIFE.md and BRIEF-QUALITY-HOME.md (the first two passes), BRIEF-DESIGN-SYSTEM
(the Machine's marks), BRIEF-OFFLINE-1.md (the eyes kept on the phone), `tests/eye.spec.mjs`, `tests/machine.spec.mjs`, `tests/lens.spec.mjs`,
`tests/scan.spec.mjs`, `tests/name.spec.mjs`, `tests/faces.spec.mjs`, `tests/measure.spec.mjs`, `tests/threats.spec.mjs`, `tests/cameras.spec.mjs`,
`tests/offlineeyes.spec.mjs`, `tests/photo.spec.mjs`. THE QUALITY RULE holds (every state designed, every word his, every wait said, every number
honest, every control 44 pt, nothing merely fine).

## His words
"i want everything to have insane quality even if there's things in the past" (11 Nov, 178). "we're missing couple crucial 'the machine'
feeling benchmarks" (139). SEE is the room that made him want Ghosty: the globe, the camera that understands, the world's alerts. It was
built in the first fortnight, before the design system, the one error voice and THE QUALITY RULE.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. The Lens's people rule is the heart of this
room and is not touched in its logic (vision/faces.ts, facestore.ts, facemath.ts, liveness.ts: words only, drawn states only); the vision
models and their pins (offline/eyesfiles.ts, tests/offlineeyes.spec) are not changed; no model is added; nothing new is fetched. The HUDs'
homes (features/core/{eye,orbit,grown,map}/*) and THE MAP belong to their own builds and are not touched; the Machine's marks (ui/machine.ts)
are the design system's: their words may be re-cut, their drawing may not. Nothing of another room's files.

## What is made right

1. **MEASURE FIRST, WRITTEN DOWN (the method's step 1), ALL FOUR.** Open, at 440 × 956 and 390 × 844, in GLASS, THE SCAN and ONE INK,
   reduced motion on and off, the brain live and mocked dead, the signal on and off, the camera granted and refused (the fake camera): GOD'S
   EYE cold (no position, no layers loaded), a search with a hit and with none, each sensor mode, each layer on and off, a target card for a
   place, a camera, a plane, a ship (where they exist), the cameras' grid with none near, a camera that will not play; THE MACHINE VIEW on
   each of its things; THE LENS in every mode with the camera refused, with it granted and nothing in view, with a thing in view, READ with
   no words, NAME with no match, PEOPLE with no one enrolled, with him enrolled, with a stranger (the rule's line), MEASURE with no depth
   pack, SCAN, AIM, MARK, ASK with no brain, PHOTO TOOLS with no brain, each pack row (not kept, fetching, kept, failed); THREATS with no
   signal, with nothing worst, with a quake, NEAR HOME with no places, RECON. List every rough spot: a state with no message (empty, loading,
   error, offline, refused, nothing kept yet), a word not his (developer words: "sensor", "layer", "runtime", "inference", "model", a library's
   text, a raw browser or permission string, a label that repeats its row, a sentence over 20 words, two where one would do, a number without
   its unit or its word (estimate · measured · from the feed), a wait over half a second with no words (the globe's first draw, a camera
   stream's open, a model's load, the depth pack's first run), a tap that does nothing or does two things, a control under 44 pt, anything
   sideways, a thing a good app of that kind does better (a flight tracker, a camera app, a weather alerts app). Rank by how much he would
   feel it. The whole list is in the report, per screen, before any fix.
2. **FIX THE TOP TWENTY-FIVE (GOD'S EYE eight, THE LENS ten, THREATS four, THE MACHINE VIEW and the pack rows three), each the smallest
   change that does the job, each with a spec check that fails on the old code.** Known to start with, from the specs' own comments: the
   Lens's camera refusal said once in his words with how to allow it (Settings → Ghosty → Camera), never the browser's string; every model's
   first load under waiting() with what for ("Waking the eyes…", "Loading the names…", "Measuring…"); PEOPLE's stranger line exactly the
   rule's ("Someone I don't know. I never identify a stranger."); READ with no words: "No words in view. Hold the page flatter."; NAME with no
   match: the closest three said as "maybe", never one said as fact; MEASURE's every number with its unit and "a first estimate"; GOD'S EYE's
   first draw said once ("Drawing the world…") and its no-position state offered the search; the cameras' grid with none near in one line;
   a camera that will not play said in his words with TRY ANOTHER; every target card's numbers with their unit and source word (altitude
   "from the feed", a ship's speed in knots); THREATS' every row with when ("12 minutes ago, from the USGS feed"), its empty state ("Nothing
   serious anywhere right now.") and its offline state ("No signal; this is from 09:40."); NEAR HOME with no places offering the one next
   thing; every pack row's size said before the tap and its failed state with RETRY; every control 44 pt (the zoom rail's keys, the Lens's
   mode pills, the shutter); the chat phrases that open each screen listed on it in one line (119).
3. **THE STATES RATCHET gains SEE.** The table in apps/edge/test/ratchet.test.mjs gains rows for GOD'S EYE, THE MACHINE VIEW, each Lens mode,
   THREATS, NEAR HOME, RECON and the pack rows, measured on the base and pinned at the new, higher number (equal or higher from then on). The
   before and after counts per screen in the report.
4. **WORDS.** Each screen's introduction at most one line; each mode pill's helper one sentence that never repeats the pill; the catalogue
   words for SEE re-cut to the same voice; nothing lost: a fact cut from a screen goes to its "?" (the WHY pattern) or a sheet, never to
   smaller type.
5. **PROVE IT.** Before-and-after stills of GOD'S EYE, THE MACHINE VIEW, each of the Lens's modes and THREATS at 440 (sixteen stills, written by
   the spec, deleted after the report lists them) and the measured numbers before and after where there are numbers (the globe's first draw,
   a model's load to its first box, a camera's open).
6. **LEAVE THE LIST.** What was found and not fixed, ranked, with why, per screen, so the next pass knows.

## What must not change

The Lens's people rule and everything about faces; what runs on the phone and what needs the brain (the panel's CANNOT lines stay true);
the models and their pins; the globe's data sources and the hazards' feeds (data/hazards.ts, read only for words); the first-screen budget
and every other budget; GLASS pixel-equal; ONE INK's page; every control 44 pt; nothing sideways at 440 × 956 or 390 × 844; the finding rule;
the colour ratchet (hex 506, rgba 1016, radiusPx 470, total 1992: equal or lower); the prompt guard; no new key; nothing that can cost money;
nothing fetched that was not fetched before.

## Tests (each fails on the code before this brief; run against it once and say so)

- tests/seepass.spec.mjs (new; `all=` word `seepass` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390:
  one check per fix (twenty-five, grouped GOD'S EYE · THE LENS · THREATS · THE MACHINE VIEW and the packs), each named for the rough spot it
  closes; plus, for every screen: the empty state's words and key; the refused camera's words; a model's load shows its waiting words; a
  forced error shows his words and no raw string; every control 44 pt; BODY 21 clips nothing; nothing sideways; the chat phrases listed on
  the screen open it.
- apps/edge/test/ratchet.test.mjs gains SEE's rows in the STATES RATCHET (equal or higher).
- eye, machine, lens, scan, name, faces, measure, threats, cameras, offlineeyes, photo, guardian, deck, nav, speed2, look, ink, thescan
  unchanged unless a fix lives in a screen they own; then that spec's check is the proof, red before, green after, nothing loosened.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8832:
`(nohup setsid node tests/preview-server.mjs 8832 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8832.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8832 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is never committed. In the foreground, alone, one after another: seepass, eye, machine, lens,
scan, name, faces, measure, threats, cameras, offlineeyes, photo, guardian, deck, nav, speed2, look, ink, thescan, homepass, lifepass. The
brain tests in the background once at the end (rebuild the preview's brain bundle first: `npx esbuild src/index.ts --bundle --format=esm
--platform=neutral --external:cloudflare:sockets --outfile=test/.build/brain.mjs` in apps/edge). A timing budget missed under load is rerun
alone before it is called red. Known sandbox reds not touched: direct, aim, radio, scroll, safari, eye's own screenshot, tabs2, talk's
cooling lines, tabs' `data-id="eye"` finding tap.

## The owner's phone check

1. SEE: GOD'S EYE cold: what does it say while the world draws? Search a town you know; search nonsense. Tap a camera; tap one that is dead.
2. THE LENS with the camera refused: the words, and how to allow it. Allow it: point at nothing, at a cup, at a page with no words.
3. NAME a plant: does it say "maybe"? PEOPLE: point at yourself, then at a stranger on the TV: the rule's line, word for word.
4. MEASURE a table: the number, its unit, "a first estimate". Aeroplane mode: which modes still work, and does each say so?
5. THREATS: when is each row from? Aeroplane mode: the time it is from. NEAR HOME with your places.
6. The pack rows: a size before every GET; pull Wi-Fi mid-fetch: what does it say?
7. Biggest text in each of the four: nothing cut. Each screen lists the words that open it from the chat: say one.
8. Does SEE feel like the same app as the newer rooms now? Say which screen does not.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/seepass-report.md: the measured list per screen (before any
fix); the twenty-five fixes with before and after (words quoted, numbers where there are numbers, the sixteen stills named); the states-
ratchet counts before and after per screen; the leftovers ranked per screen; each spec's last line (before and after for the new one); NEEDS
HIS WORD; the phone check as above; the commit list. One commit per fix on builder/seepass; the orchestrator squashes to one on landing.
