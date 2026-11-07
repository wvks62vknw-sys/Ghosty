# BRIEF: ONE LENS — point it and Ghosty tags what he sees, in the Machine's marks (awareness PR B)

STATUS item 3, PR B (STARS 151 ONE LENS and 152 THE MACHINE'S RETICLE ON THE LENS; the owner's 5 Nov budgets in OWNER-ISSUES
131: "cheap detectors every frame, heavy ones on a steady frame, two seconds per tag, 'I see text — tap to read it'"; his
three rules in 139; 143: every feature stays a usable, findable thing). Read STANDARD.md first, then FACTS-AWARENESS.md
sections 3(g), 5 and 9, then MAP.md's Lens rows, then apps/web/src/features/lens/index.ts's header (the Lens today: SEE,
READ, HANDS, ASK, NAME, PEOPLE, SCAN, AIM, MEASURE, SOUND, SHAPES as modes picked from a tile row). The mid tier. PR A
(BRIEF-AWARENESS) is on the branch you start from: the Lens already publishes its ScreenContext (counts, never who).

## What is fixed

1. ONE LENS, NO MODES TO PICK. The Lens opens on ONE VIEW: the camera with the Machine's marks over what it sees. He points
   it and Ghosty TAGS what is there, each tag a thin reticle with one true line (ui/machine.ts: `reticle`, `tag`, `truthLine`;
   the same language as God's Eye and the reader; drawn in the DOM over the video, positioned from the detection's box via
   vision/boxes.ts; not on the overlay canvas), and OFFERS THE ACT under it as a key (`key`): text → READ (into the library,
   as READ does today) and, when the text is not in his language, TRANSLATE (ASK with the OCR text and "translate this" to the
   brain: the model is allowed here, it is a question he tapped); a barcode or QR → what SCAN does today (the code's kind
   and its act); a face he knows → the name he introduced and nothing else; a stranger → "someone I don't know" and no act;
   an object, a plant, a part → NAME's guess (CLIP) as "looks like a …" with NAME IT (the card as today) and, for a part,
   FIND THE PART (the car's/shed's part flow where one exists; otherwise ASK); anything → ASK (a question with the picture),
   MEASURE and AIM where their inputs are present. A tap on a tag or its key does the act; a word does it too ("read that",
   "what is that", "translate it", "measure it"), through the no-model tables (assistant/phrases.ts + local.ts) with the
   Lens's selection as the thing ("that one" from PR A: the tag he tapped is `selected`).
2. THE BUDGETS, HELD BY A TEST. Cheap detectors run every frame the budget allows (vision/frame.ts `FrameBudget`): the barcode
   reader (native `BarcodeDetector` where present, else the vendored one, as today), a "text present" check (a cheap
   heuristic on a downscaled frame: stroke-like edge density in tiles; it NEVER names the text, it only says "I see text — tap
   to read it"; measured under 4 ms a frame on the preview's CPU), a face he knows (BlazeFace + the on-phone store, as PEOPLE
   does, only when PEOPLE's models are already on the phone; otherwise no face tag at all and no download without his tap).
   Heavy detectors (NAME's CLIP, the object detector, OCR itself, a part) run ONLY on a steady frame (frame-difference under
   a threshold for 400 ms; say the threshold and how it was chosen) and at most one heavy pass at a time. A TAG LIVES TWO
   SECONDS after its last sighting, then fades (dur('turn')). When unsure he says what he can and never guesses ("I see
   text", "something round", "a code I can't read yet"); confidence under the detector's floor makes no tag.
3. EVERYTHING STAYS FINDABLE (143). The old modes become ACTS and TOOLS, not deletions: HANDS, AIM, MEASURE, SOUND and SHAPES
   are under a MORE key on the bar and by their words ("hands", "measure", "is it distorting", "draw a room"), each opening as
   today; READ, ASK, NAME, PEOPLE and SCAN become the acts above (their code reused, their cards kept, their specs re-pointed,
   never loosened). PEOPLE's enrolment (introducing himself and a person present) stays a screen reached from the MORE key
   and by words. The catalogue entries `lens:<mode>` are re-expressed (an act or a tool, with its words); the catalogue test
   diffs both ways, so no entry is lost.
4. THE BOUNDARY, UNCHANGED: faces only his own and people he introduced, kept on the phone, never a stranger identified, a
   face never leaves the phone; a number plate is read only from the READ chip on a tap as today; nothing leaves the phone
   until he taps ASK or TRANSLATE or shares a crop; the published ScreenContext says counts and kinds, never who ("the Lens:
   3 tags: text, a code, someone I know" is the most it says; a known person's name is NOT in the context line).
5. THE SPEED HABIT: first tag within 2 s of a steady frame on the preview (the fake camera; a drawn test card with a line of
   text, a QR code and a plain object, as lens.spec draws text today); the camera opens only on his tap as today; the frame
   loop never drops the UI under 30 fps while tagging (measured in the spec by rAF timing over three seconds); on a phone
   that cannot keep up the cheap pass thins to minHz and says nothing; the WORKING / DEGRADED / OFFLINE mark on the Lens's
   bar: WORKING (the cheap pass running), DEGRADED (the heavy detectors not loaded yet, with the download key and its size),
   OFFLINE (ASK and TRANSLATE greyed, the rest working).

## What must not change

The prompt guard; the CI guard job; check.yml untouched (the Lens's specs keep their names: lens, scan, name, faces,
measure, aim, mark, sound; re-point them to the one view, never loosen them; no new spec file unless a check has no home,
and then one word in the `all=` list after `awareness`); no packages, no new models (the vendored ones only), nothing from
the network, no new keys; never a model name; no live GPS; the camera never opens on its own.

## Tests (each fails on the old code; run them against the old code once and say so)

apps/edge/test/lens.test.mjs (or a new file imported from it): the tag kinds and their acts as a pure table (packages/shared
if the catalogue needs it), the "text present" heuristic on three drawn frames (text / no text / noise) under its budget,
the steady-frame rule on a frame sequence, the two-second life. tests/lens.spec.mjs re-pointed to the one view: the fake
camera's test card shows text, a code and an object; within 2 s of the steady frame three tags stand with their keys; a tap
on the text tag reads it into the library (as READ did); a tap on the code tag does what SCAN did; the object tag says
"looks like …" only after the heavy pass; the tags fade after two seconds of absence; MORE opens HANDS/AIM/MEASURE/SOUND/
SHAPES; "read that" by words; the mark on the bar; nothing sideways, every control 44 pt, at 440 and 390; the fps floor.
faces.spec: a known face tagged by its introduced name, a stranger "someone I don't know", the context line without a name.

## Validation before the PR (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; results to the scratchpad file)

web typecheck and build, the brain bundle and the lens/vision/faces/scan/catalogue/abilities tests, then the specs lens,
scan, name, faces, measure, aim, mark, sound, awareness, deck, tabs; look at the screenshots.

## The owner's phone check (write it into OWNER-ISSUES with the build record, with context in every line)

(1) Lens, point at a page of print: a box lands on the text with "I see text" and READ under it within two seconds of
holding still; tap READ: the text goes to the library as before. (2) Point at a product barcode: the code's box and its act
appear while the camera moves (no need to hold still). (3) Point at a plant or a mug, hold still: "looks like a …" with
NAME IT; tap it: the card as before. (4) Point at yourself (PEOPLE's models on the phone): your name on the box; point at a
photo of a stranger: "someone I don't know", no name, no act. (5) Say "read that" with the text box on screen: it reads.
(6) MORE → MEASURE, HANDS, SOUND, SHAPES each open as before. (7) Airplane mode: ASK and TRANSLATE greyed with OFFLINE on the
bar, READ and the codes still working.

## Size

A day on the mid tier; one PR. Questions for the owner with their context in the question itself, recommendation first.
