# BRIEF-CAR — "I have this car and this is what's wrong with it": the car in 3-D, bonnet up, the fault lit (batch ⑤ part 1, 1 Nov 2026)

Worktree from the LOCAL tip of claude/ghosty-ai-training-idwhp9 (at or after 86f0f56; never reset to FETCH_HEAD or origin,
only to the local branch). Your preview port: 8777. Read first: OWNER-ISSUES 91 (a), 92 ⑤, 93 (c), 95–97, 99 (the catalogue
rules), 101 (the CAR card and the cars he names, as built); ROADMAP.md row ⑤; `apps/web/src/features/core/cards.ts` (the
CAR card: `carVisual`, `showCar`), `apps/edge/src/cars.ts` (the cars he names), the `vehicle` tool group in
`apps/edge/src/tools/extra.ts` (DVLA and DVSA facts by plate; keys in SYSTEM → KEYS; the spec stubs them), the Studio
(`apps/web/src/features/studio/index.ts`, `catalog.ts`, `samples.ts`: find where its three.js scene lives and how a scene
is shown; three.js is vendored under public/vendor/three), `assistant/phrases.ts` + `local.ts` (the no-model phrases
registry), `packages/shared/src/catalogue/app1.ts` (an entry's shape). Other builders run in parallel (the arcade player's
wiring, the packs, three games): touch nothing under `arcade/`, `features/arcade/`, `features/money|body|kitchen/`,
`tools/money|body|kitchen.ts`, `.github/workflows/check.yml` (the orchestrator adds your spec to the loop). Yours:
`apps/web/src/car/*` (new), the Studio files for the car scene, `features/core/cards.ts` (the CAR card's new line and
button only), `assistant/phrases.ts` + `local.ts` (your phrases), `packages/shared/src/catalogue/car.ts` (+ one spread line
where the catalogue files are joined), `apps/edge/test/car.test.mjs`, `tests/car.spec.mjs`, a CSS block at the END of
`apps/web/styles.css`.

## The owner's words

"i have this car and this is what's wrong with it and he makes it in literal 3d with the bonnet open and everything is
super realistic … interactive and then he's showing me what is wrong and like how we can fix it … very simple and user
friendly so even the dumbest user could use it". The rule he agreed: SHOW ME, DON'T TELL ME. He does not drive; his dad's
and Haris's cars are the ones (he tells Ghosty their plates himself; the specs use made-up plates and stubbed facts).

## The honest shape of it (say it in the UI, once, small)

There is no free photoreal model of a given car. We build the car ourselves in three.js from the public facts (body shape,
colour, plate, wheels, doors) with real materials — metallic paint with a clear coat, glass, chrome, rubber, lit lamps —
so it reads as that car at a glance, and we say in one small line: "A stand-in: the shape, colour and plate are the car's;
the parts are where they are on most cars like it." The engine bay and the wheel's insides are detailed stand-ins, every
part named. That is the bar: it must look like a very good game's car, not a toy, at 60 fps on his phone.

## What to build (a commit each)

1. THE CAR FROM THE FACTS (`car/spec.ts`, `car/body.ts`): from the vehicle facts the tool gives (make, model where DVSA
   has it, colour, year, fuel, body type where present; the plate) → a `CarSpec` (silhouette: hatchback, saloon, estate,
   SUV, MPV, van, coupé, pickup — chosen from the model name's known families and the body type, with a sensible fallback
   and `exact: false` when guessed; the colour from DVLA's colour word to a real paint; wheels, doors, roof rails for an
   estate, a boot line for a saloon…) → a parametric car with proper proportions (wheelbase, overhangs, greenhouse,
   shoulder line), PBR materials, headlamps and tail lamps that light at night, the plate rendered front and back, a
   shadow on a ground disc, a sky and soft light from the kit the arcade's games use if it helps (`arcade/games/kit.ts`,
   read-only) or the Studio's own. Orbit by drag, pinch to zoom, tap a part to name it.
2. BONNET UP, WHEELS OFF (`car/bay.ts`, `car/wheel.ts`): an OPEN BONNET animation to a detailed stand-in engine bay (the
   engine cover, battery with its terminals, coolant reservoir with its cap, brake-fluid reservoir, washer bottle, air box
   and filter, drive belt, alternator, radiator and fan, hoses, fuse box, dipstick, oil cap, the strut tops), each a named
   part with a plain line; a WHEEL view that pulls one wheel off to show the disc, pads, caliper, hub, the tyre's tread
   depth marks, the shock and spring, the brake hose; an UNDERNEATH view (exhaust, cat, sump, driveshafts, the tyres' wear
   pattern). A part can be LIT (a pulsing glow) and tapped for its sheet: WHAT IT IS, A 30-SECOND CHECK, DIY OR GARAGE, A
   ROUGH COST (UK ranges, "a first estimate, not a quote"), and the MOT advisory that points to it when there is one.
3. THE FAULT TABLE (`car/faults.ts`, code, no model): about forty everyday symptoms in his words and their suspects —
   grinding or squealing when braking, a soft or long pedal, pulling to one side, a judder through the wheel, a wobble at
   speed, a clunk over bumps, the engine won't start (a click / nothing / it cranks), the battery light, the oil light,
   the engine light, the ABS light, overheating, white or blue or black smoke, a knock, a rattle, stalling, a rough idle,
   a fuel smell, a burning smell, a sweet smell, aircon blowing warm, the battery going flat overnight, a tyre wearing on
   one edge, the clutch slipping, gears grinding, lights flickering, a headlamp out, the plate lamp out (an MOT fail), an
   exhaust blowing, a wet footwell, slow windows, the horn, the wipers — each with its suspects in order of likelihood,
   the parts to light, the check, DIY or garage, the cost range, and a SAFETY line where it matters ("Brakes: do not drive
   it; a garage, today."). The MOT history's failures and advisories map to suspects too (pads wearing thin, a tyre near
   the limit, corrosion, a lamp) and raise their likelihood.
4. IN THE CONVERSATION (show me, don't tell me): the CAR card gains WHAT'S WRONG? (a one-line box) and SHOW ME; "my dad's
   car makes a grinding noise when I brake" or the box → the fault table picks the suspects → the card says the top
   suspect in one line with the check, the cost and the safety line, and SHOW ME opens the Studio on the car with the right
   view (the wheel for brakes, the bay for the battery) and the suspects lit; "open the bonnet", "show me the engine", "show
   me the brakes", "what's under it" are no-model phrases that open the views (add them to the phrases registry with
   catalogue words). On the Studio, a FIX IT list down the side: the suspects in order with their sheets, and NEXT STEP
   (the check to do first). The guardian's danger rule applies to the SAFETY line (said first, once).
5. THE LENS GUIDE: with the camera on the real engine bay, a SIDE-BY-SIDE guide — the stand-in's picture of the part he is
   looking for beside the live view with its plain description ("the black box with the red cap, usually on the left") —
   no recognition is claimed; one small line says so.
6. Catalogue words for every new registry item (the Studio's new samples or panes, the phrases, the car panel), the
   completeness test green.

## The lines that hold

Public vehicle facts by plate only (the tool as it is; the key line when the key is missing; nothing about a keeper); cars
only his or those of people he introduced; every cost a first estimate, never a quote; the safety lines never softened;
no model calls in the show-me path; the plain prompt untouched; nothing that bills; the brain never gets live GPS; no test
skipped or weakened; the guard job untouched; no model names anywhere. Honest words in the UI: the stand-in line, once.

## Tests

`car.test.mjs`: the CarSpec from fixture facts for six real-shaped cases (a hatchback, a saloon, an estate, an SUV, a van,
an unknown model → fallback with `exact: false`); every symptom has ≥ 1 suspect whose parts exist in the bay or wheel or
underneath models; every cost is a range; every dangerous symptom has a safety line; MOT advisories map to suspects; the
phrases match and do not match. `tests/car.spec.mjs` on your preview (the vehicle tool stubbed as the cards spec stubs it;
a made-up plate): the CAR card shows WHAT'S WRONG? and SHOW ME; "grinding when I brake" → the card's suspect line, cost,
safety line; SHOW ME → the Studio's car with the wheel view, the pads lit (a test hook lists the lit parts and the view);
a tap → the sheet; "open the bonnet" → the bay view; frames render (two snapshots differ); the Lens guide shows the part's
picture beside the camera fixture; nothing sideways at 390 × 844; VoiceOver labels; frame time printed.

## Working lean

Ranged reads; `tail -30`; the brain suite once at the end under `nice -n 10`; no narration. Validation: brain typecheck +
suite; web typecheck + build; on one fresh preview: websites, apps, cards, car, deck, nav, lens.

## The report (one message)

Base SHA, HEAD SHA, the worktree branch; commits; files; validation numbers (frame times); the symptom count; LIMITS;
DESIGN PICKS THE OWNER MAY CHANGE; NEEDS HIS PHONE OR HIS WORDS (the plates said to Ghosty; the DVSA and DVLA keys); WHAT
THE MERGE MUST KNOW (your spec's name for the loop; new registry items).
