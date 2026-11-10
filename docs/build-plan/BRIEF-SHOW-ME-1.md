# BRIEF: SHOW ME, THE FIRST SLICE (STARS 164, STATUS item 5): when I answer, the Machine shows the thing

BRIEF-SHOW-ME pass 1 (his words, 4 Nov, OWNER-ISSUES 129: "he pulls it up immediately and i see it"; OWNER-ISSUES 131 the speaking rule).
Read STATUS.md item 5 and STARS.md 164 first, then BRIEF-SHELL-2.md for the shape of this brief, then BRIEF-AWARENESS.md (the `Show`
protocol it defines and leaves for this item), then apps/web/src/ui/machine.ts (the marks every part of this uses), the cards
(packages/shared/src/cards.ts, apps/web/src/features/core/cards.ts), the commands that already show a thing (commands/builtin.ts:
show_map, show_route, show_journey, open_studio, open_docs), the workbench (packages/shared/src/workbench), the room (studio/room.ts)
and THE SYSTEM section of styles.css. The mid tier. Start from the session branch (main's tree). The brain is not touched.

## What is fixed

1. **THE STAGE.** One surface, `#thestage` (role region, named by what it shows), that takes the centre of the screen while something is
   shown: a plate brought to the front (`g-plate strong`: the world draws it, so Glass is glass, The Scan a plate with corner marks
   and ONE INK a pair of rules), docked above the ask line so the ask line and the house stay, with the conversation shrunk above it
   (never hidden): a tag (`SHOWING · CHART`), the picture, one truth line (what it is made from, in mono), two keys: OPEN (the
   full screen for it) and CLOSE. It arrives on `--g-dur-bring`; Reduce Motion lands it whole. It goes at his next word, on CLOSE, on
   Escape, and when he leaves Home's chat. One at a time. 44 pt keys; nothing sideways at 440 or 390. (The app's own `#stage` is the pages' host: this surface is `#thestage`, and
   nothing here ever touches the other.)
2. **WHAT SHOWS FOR EACH KIND OF ANSWER (the first slice), decided on the interface from his words, the reply's words and the tool
   results the phone already receives (the `Show` protocol's `stage` variant stays defined and unused: a brain-side emit needs
   agent.ts, see the report):**
   - a place (a saved place, a city of the world pack; a map the brain's own tool drew stays on its own screen) → `map`: a tile map centred on it with its pin (a
     saved place or a street-level answer), or `eye`: God's Eye's globe drawn from the world pack's own land and cities, centred and
     lit on it (a city, a country, "from space"); OPEN flies the real map or God's Eye there.
   - a route (a route or a journey the brain's tools drew) → the journey, drawn by its own screen at once (show_route, show_journey
     already take the screen): the Stage does not draw it a second time; it records that it was shown (`via: 'its screen'`).
   - numbers (three or more label-and-number pairs in the reply: a list, a table, "Jan £120, Feb £95") → `chart`: bars, or a line
     when the labels run in time, drawn by code from those numbers, the figures written on it.
   - a plan or a letter (a write ask, or a plan-shaped ask with a list in the reply) → `document`: the reply laid out as a page
     (docs/model docFromReply), OPEN opens the document editor on it.
   - a formula (a workbench problem in his words: a throw, a fall, an orbit) → `simulation`: the shared solver's numbers, and the
     path run on a canvas (a first estimate, never certified, said on it).
   - a room or a part (a room's size and what is in it; a table, desk, shelf, bed, sofa, wardrobe, chair, stool, bench, cabinet) →
     `room` / `part`: built from parameters (his numbers where he gave them, a stated default where not) as boxes, drawn in 3-D on the
     Stage (turns by drag, slowly by itself, still with Reduce Motion), with the honest wall said on it: composed from parameters,
     no free text-to-3D on a phone. OPEN opens the Studio's room on it.
3. **THE SPEAKING RULE.** The sentence is never held for the picture: the Stage is begun after the turn's stream ends, off the reply's
   own render, in a dynamic import that does not block it, and a picture that cannot be made (no data) is simply not shown; nothing
   says "loading". What the Stage says of itself is its truth line, not a second spoken sentence.
4. **HONEST WALLS ON SCREEN.** The room and part say what they are composed from; the simulation says first estimate, not certified;
   the chart says it is drawn from the numbers in the answer; no picture is ever drawn for a thing the data does not hold.
5. **THE LOOK.** Every colour, size, line and duration is a token (the Stage's CSS sits in THE SYSTEM section, tokens only; the
   ratchet's ceiling hex 506, rgba 1016, radiusPx 470, total 1992 holds: equal or lower, and the section holds no raw colour). The
   picture's own strokes read `currentColor`/the token classes, so the three worlds (The Scan with its house, Glass, ONE INK with its
   foot) each draw it in their own plate.
6. **NO MONEY, NO KEYS, NO NETWORK OF ITS OWN.** The only fetches the Stage causes are the map's tiles the card kit already uses. Nothing
   is downloaded (the free-model library fetched on his tap is NOT in this slice: it does not exist yet; when it does, its download
   is his tap on Wi-Fi with the size said). No live GPS goes to the brain.
7. **UNDER A TEST RUNNER** the Stage waits for `window.__ghostyShow = true` (as the cards do for `__ghostyCards`), so no other spec
   meets a surface it did not ask for.

## What must not change

The prompt guard and `agent.ts`, `index.ts`, `tools/{index,types,repo}.ts`; `.github/*` beyond the one `all=` word (`showme`, after
`ink`); `apps/*/package.json`; the brain (untouched); every existing spec's behaviour (show_map, show_route, show_journey, open_studio
and open_docs go on taking their screens; the document offer card and the cards stay); the Glass world's look; the ratchet; no
model name anywhere; every engineering, car or build number a first estimate.

## Tests (each fails on the code before this brief; run against it once and said so)

New spec tests/showme.spec.mjs (the one word `showme` in check.yml's `all=`):
1. Decisions (pure, in the page): a saved place → map; a city → eye; a postcode card → map; a route command → journey (via its
   screen); six figures → chart (bars; a line for months); a letter ask → document; a throw with numbers → simulation with the
   solver's range; "a desk 140 wide" → part with those numbers; "a room 4 by 3 with a sofa and a bed" → room; words with nothing to
   show → nothing; a reply with two numbers → no chart; a person's name → nothing (no prediction about any person).
2. Each kind, through a real turn in the chat (the stream faked as journey.spec does): the Stage appears under the reply with its tag,
   its picture (the map's pin, the globe's centre, N bars with figures, the page's heading, the canvas drawn, the boxes drawn) and its
   truth line; the reply's sentence is in the log BEFORE the Stage exists (the order is recorded).
3. Speaking rule: with the picture's module made slow, the sentence still lands first; with no data, no Stage.
4. Keys: CLOSE and Escape remove it; his next word removes it; OPEN opens the real screen (map sheet, document editor, studio room).
5. The three worlds and the phone: in The Scan, Glass and ONE INK at 440 x 956 (and 390): the Stage is in the world's own plate (a
   computed-style check on border and radius), every key 44 pt, nothing sideways, the ask line still on screen, Reduce Motion lands it
   with no animation; screenshots to the scratchpad.
6. The wall: under a test runner without the flag nothing appears; the flag is `__ghostyShow`.
7. The ratchet (apps/edge/test/ratchet.test.mjs) still at or under its ceiling; the section holds no raw colour.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; results to the scratchpad file showme-report.md)

`cd apps/web && npx tsc --noEmit -p . && node build.mjs`; the brain tests (`cd apps/edge && PATH=$PWD/node_modules/.bin:$PATH npm
test`, about ten minutes, in the background); the preview on port 8799 only; then every spec in check.yml's `all=` list, one at a
time in the foreground: `BASE=http://localhost:8799 NO_GL_SHOTS=1 timeout 480 node tests/<name>.spec.mjs tests/.shots`, each last
line into the report. Sandbox reds that are not this pass's: direct, aim, radio, scroll, safari (no WebKit here) and eye's own
screenshot.

## The owner's phone check (in these terms)

(1) Ask "where is Lisbon?": the sentence first, then the globe turns up lit on Lisbon. (2) "How is my spending: Jan 120, Feb 95, Mar
140, Apr 80": the sentence, then the bars. (3) "Write a letter to my landlord about the damp": the letter laid out as a page. (4) "Throw a
ball at 20 m/s at 40 degrees": the path runs, the range written on it. (5) "Show me a desk 140 by 70" and "a room 4 by 3 with a sofa
and a bed": they stand on the Stage and turn; it says they are built from parameters. (6) Ask for a route: its own screen, as ever.
(7) In each of the three looks: it sits in the look's own plate, the ask line under it, CLOSE puts it away. Does it feel like the Machine
pulling the thing up and you seeing it?

## Report

showme-report.md in the scratchpad: every commit's hash and one line; what shows for each kind of answer and the spec that proves it;
each spec's last line verbatim and the verdict; NEEDS HIS WORD; the owner's phone check; what was not done and why. Never push. Never
touch a protected file. Named by tier, never by model.
