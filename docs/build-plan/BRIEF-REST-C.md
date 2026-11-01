# BRIEF-REST-C — anti-spoofing for faces, hand shapes to blueprints, TV mode for the PS5 (batch ⑧ part C, 1 Nov 2026)

Worktree from the LOCAL tip of claude/ghosty-ai-training-idwhp9 (at or after the commit that adds this brief; never reset to
FETCH_HEAD or origin, only to the local branch). Your preview port: 8722. Read first: ROADMAP.md row ⑧ and the "Not possible
from a phone app" lines (the PS5); OWNER-ISSUES 86 (the faces as built: PEOPLE, ENROL ME, on-phone only), 91 (c) ("i make
shapes with my hand, Ghosty builds it as blueprints, like an advanced architectural engineer in 3d"), 94 (e) and 97 (b)
(the PS5's hidden browser: an older WebKit, no WebGPU, weak WebGL; Ghosty opens there; the Eye and the new centre piece
fail), 95–97, 99 (the catalogue rules), 108 (the car's 3-D stage and how a scene lands in the Studio); `apps/web/src/features/
lens/*` (PEOPLE, the hand tracking if any: `public/vendor/mediapipe` and `vendor/faces` hold the models), `apps/web/src/
features/studio/*`, `apps/web/src/features/space/*` (DESIGN MY HOME: a plan drawn from words — your blueprints land the same
way), `shell/boot.ts` and `shell/layout.ts` (the boot and the layout), `apps/web/src/features/eye/*` (the 3-D map). Other
builders run in parallel (the people/work/creative packs, offline Wikipedia + Shortcuts + Morse, chess + coach + demo): touch
nothing under `features/people|work|creative/`, `wiki/`, `morse/`, `coach/`, `demo/`, `gym/`. Yours: `apps/web/src/features/
lens/liveness.ts` + the PEOPLE file's hooks, `apps/web/src/hands/*` (new) + a Lens tile, the Studio's blueprint scene,
`apps/web/src/tv/*` (new) + `shell/layout.ts` hooks for the TV layout, your phrases, `packages/shared/src/catalogue/restc.ts`
(joined where the catalogue files are), `apps/edge/test/restc.test.mjs`, `tests/restc.spec.mjs`, the CI smoke loop's list
(`restc` after the last `rest*` or after `games3`), `apps/edge/package.json`'s test list, a CSS block at the END of styles.css.
The plain prompt is at exactly 5,500: add nothing to it.

## 1. ANTI-SPOOFING FOR FACES (the Lens's PEOPLE)

Today a photo of him held up to the camera could pass as him. Add LIVENESS, on the phone, no model call: before "It's you."
or a named person is accepted for anything that matters, a quick challenge the phone can judge — blink twice, or turn the
head left then right — tracked with the landmarks the face model already gives (eye aspect ratio for blinks; nose-to-cheek
ratio for yaw), plus a flatness check (a printed photo or a screen has no depth cue: use the landmark motion parallax
between the turns; say in the code what it can and cannot catch). Fail → "I can't be sure that's a live face" and no name.
A setting in PRIVACY → FACES: CHECK IT'S LIVE (on by default). The check is skipped for the harmless uses (greeting by name
in the Lens) and required for anything that unlocks or acts (say which in the catalogue words). Tested with recorded
sequences: a real blink sequence passes, a still image fails, a screen video with no parallax fails.

## 2. HAND SHAPES TO BLUEPRINTS (the Lens → SHAPES; "draw a room with my hands")

With the hand tracker (vendored MediaPipe hands if present; else add the hand landmarker task from Google's own model
hosting under public/vendor with LICENCE and SOURCE.md, Apache-2.0): he traces shapes in the air with a finger — a rectangle,
an L, a circle, a line — and pinches to place or to finish; the trace is simplified into clean geometry (corners snapped to
right angles when within 12°, lengths rounded to 5 cm at a scale he sets by saying one real length: "that wall is four
metres"); the shapes become a PLAN: rooms with walls, openings where he "cuts" with a two-finger gesture, furniture blocks
by size words ("a bed here") — drawn as a 2-D blueprint (walls, dimensions, areas, a scale bar, a north arrow he sets) AND
as the same 3-D model in the Studio (walls with height, openings, a roof toggle), the way DESIGN MY HOME already lands
plans; EXPORT as PNG and as a measured list (walls with lengths, areas, materials guessed by his words); the honest line:
"a sketch to measurements you gave, not a survey". Works one-handed at arm's length; a tutorial of four gestures on first
open; VoiceOver describes what was placed. Plain words throughout, no CAD jargon in the UI.

## 3. TV MODE (for the PS5's hidden browser and any television)

Detect a TV-shaped viewport (landscape ≥ 1,100 px wide with a coarse pointer or no touch) or a toggle in SETTINGS →
LOOK → TV MODE: a layout with big targets (≥ 56 pt), a visible focus ring, D-PAD NAVIGATION (arrow keys and the Gamepad
API's d-pad move the focus between controls in reading order; A/Enter activates; B/Escape goes back), the deck as a grid of
large tiles, the chat with a bigger type size and an on-screen keyboard fallback (the console has its own), the Eye drawn
as flat tiles (no WebGL where the browser cannot do it: feature-detect and say "this screen can't draw the 3-D map"), the
3-D Studio and games hidden with one line where WebGL fails, the arcade's DOS games offered where WebAssembly works (the
PS5 browser has it; test the engine's start in a feature probe and say the result), the boot shortened (the sphere and
greeting keep; nothing that needs WebGPU). The old centre piece he saw on the PS5 means the fallback path is live there:
make it a tidy fallback, not a stale one. Nothing in TV mode may need the phone's sensors. Tested in the spec with a
1,920 × 1,080 viewport and keyboard navigation through the deck, a chat message, the Eye's flat fallback and the arcade's
shelf.

## The lines that hold

Faces stay on the phone (the liveness check too; nothing leaves); only people he introduced are ever named; the blueprints
are a sketch to his measurements and say so; nothing that bills; the plain prompt untouched; no test skipped or weakened; the
guard job untouched; no model names anywhere; every new thing has its catalogue entry.

## Tests

`restc.test.mjs`: the liveness judges (blink detection on a landmark sequence; yaw; parallax; the still-image and screen
cases), the shape simplifier (snapping, scale, rounding) and the plan builder (rooms, openings, areas), the TV-mode
detector and the focus order. `tests/restc.spec.mjs` on your preview: PEOPLE with the fake camera's recorded frames — a
still image is refused with the line, a blink sequence passes; SHAPES with a scripted hand trace → a room's blueprint with
dimensions and the Studio's 3-D; EXPORT; TV mode at 1,920 × 1,080 driven by the keyboard; nothing sideways at 390 × 844 in
the phone layout; VoiceOver labels.

## Working lean

Ranged reads; `tail -30`; the brain suite once at the end under `nice -n 10`; no narration. Validation: brain typecheck +
suite; web typecheck + build; on one fresh preview: websites, apps, lens, restc, deck, nav, eye.

## The report (one message)

Base SHA, HEAD SHA, the worktree branch; commits; files (vendor sizes); validation numbers; what the liveness check catches
and misses; LIMITS; DESIGN PICKS THE OWNER MAY CHANGE; NEEDS HIS PHONE (his face; his hands; the PS5); WHAT THE MERGE MUST KNOW.
