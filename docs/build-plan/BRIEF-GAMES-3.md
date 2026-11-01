# BRIEF-GAMES-3 — three more games of our own in 3-D, at the bar: THE KART RACER, THE HOPPER, THE ARENA (batch ③ part 3, 1 Nov 2026)

Worktree from the LOCAL tip of claude/ghosty-ai-training-idwhp9 (at or after a4ec2f6; never reset to FETCH_HEAD or origin,
only to the local branch). Your preview port: 8799. Read first: BRIEF-ARCADE.md (the bar and the lines: binding),
BRIEF-GAMES-2.md and OWNER-ISSUES 104 (how the first two games of our own were made and measured), `apps/web/src/arcade/
games/kit.ts` (the shared kit: three.js typed for the games, the geometry builder, shaders and sky, the frame clock and
resolution control, menus, haptics — use it, extend it only in ways the two existing games keep working), `games/audio.ts`
(the synth), `games/shelf.ts` (GAMES2 entries: yours follow the same shape, `madeByUs: true`, `data: null`),
`games/runner/` and `games/voxel/` (the pattern of an `Engine` of our own), `arcade/engines/types.ts` (the adapter; `Engine.id`
is widened at merge), `arcade/input.ts`, `arcade/scores.ts`, `arcade/learnable.ts`, `packages/shared/src/catalogue/games2.ts`
(the words' shape). Another builder is wiring the arcade player right now (`features/arcade/*`, `arcade/shelf.ts`,
`arcade/engines/index.ts`, `arcade/input.ts`, the DOS and native engines, `tests/arcade.spec.mjs`): touch none of those.
Yours: `apps/web/src/arcade/games/kart/*`, `games/hopper/*`, `games/arena/*`, `games/shelf3.ts` (your three entries, merged
into the shelf at merge time), `games/pad3.ts` (your pad mappings, spread into PAD_BUTTONS at merge), additions to
`games/kit.ts` and `games/audio.ts` that keep the two existing games green, `packages/shared/src/catalogue/games3.ts`,
`apps/edge/test/games3.test.mjs`, `tests/games3.spec.mjs` with a harness under `tests/fixtures/games3/`, and a CSS block at
the END of `apps/web/styles.css`.

## The owner's words

"i want games that are like WOAH how are you playing that in a different app"; "insanely good quality and not just slop".
Our own look, names, characters and sounds; never a commercial game's.

## THE KART RACER (`games/kart`)

A small kart racer in 3-D against Ghosty and two of his bots on three tracks of our own (a seaside loop, a mountain pass
with a tunnel, a night city with neon), arcade physics (drift on a held turn, a boost from a clean drift, bumping, a
catch-up for the bots so a race stays close), three laps, items from boxes (a speed boost, a shield, an oil slick, a
homing orb) with our own look, a minimap, a lap counter, a start light, a finish with positions, lap records per track in
scores.ts and Ghosty's own best. Touch: steer by tilting the stick or two steering buttons, accelerate held by default
(an option to hold a button), ITEM and DRIFT buttons; gamepad through the Intent. The bots' driving is code (a racing line
with noise by difficulty); Ghosty's line on his position at the finish. 60 fps budgeted the way the kit does it.

## THE HOPPER (`games/hopper`)

A Crossy Road-style hopper in 3-D with our own voxel look: a tap or swipe-up hops forward, swipe left or right sidesteps,
across roads with cars and lorries, rivers with logs and lily pads, railways with a train and a warning light, a slowly
rising hazard behind (an eagle of our own? no: a tide of fog) that ends a run spent idle; coins; a score in rows crossed;
a run ends on a hit or in the water; unlockable hoppers of our own design (a frog, a chicken, a robot, Ghosty's figure) by
coins; Ghosty's best as a line across the road. Instant restart. Haptics on a hop and on a hit.

## THE ARENA (`games/arena`)

An eat-or-be-eaten arena against Ghosty's bots: you steer a cell (or a snake: pick ONE of the two mechanics and do it at the
bar; the cell is the simpler to make feel right — Agar-style), eat pellets to grow, eat smaller bots, avoid bigger ones,
split and eject with buttons, viruses that pop the big; the arena is a soft-glow 2.5-D plane drawn with the kit (a
tilted camera, depth by size); 12 bots with names of our own and three temperaments (greedy, cautious, hunter) whose
parameters the GYM can tune later (`Learnable` implemented: observe = the nearest pellets, bots with sizes and headings,
own size; act = a heading and split/eject; score = mass·seconds). A round is three minutes or until you are eaten;
leaderboard of the round; Ghosty's best mass as a ghost ring. Touch: drag to steer, SPLIT and EJECT buttons.

## All three

Menus (Play · How to play · Sound · Quit) in the app's sentence case at 44 pt, VoiceOver labels, haptics, pause on a tap or
when hidden, scores through scores.ts (the kit's menus and the two games show how), Ghosty's line on the shelf card and at
the end of a race, run or round, nothing sideways at 390 × 844 (portrait works; the kart may prefer landscape and say so
in one line while allowing portrait), the Engine handle honoured (pause/resume/quit/setSound), the canvas freed on quit,
each game its own AudioContext inside PLAY's tap as the two existing ones do. Measure in your harness at 390 × 844 × 3:
frame-interval p50/p95, our own work per frame p95, draw calls, triangles, first frame; record them (software rendering:
say so).

## The lines that hold

As BRIEF-ARCADE and BRIEF-GAMES-2. Our own everything; no model calls; everything on the phone; the plain prompt untouched;
no test skipped or weakened; the guard job and check.yml untouched (the orchestrator adds your spec to the loop); no model
names anywhere.

## Tests

`games3.test.mjs`: the kart's physics (a drift builds boost; a bump conserves the sum of speeds within tolerance; the
catch-up never exceeds its cap; lap counting and finish order), the bots' racing line stays on the track for a full lap on
each track; the hopper's lane generation (never an impossible row: a crossing exists), collision kinds, score and coins,
the fog tide's pace; the arena's eating rules (bigger eats smaller by the ratio), split/merge timers, virus pop, the
Learnable contract; the shelf3 entries hold the madeByUs rule; the catalogue words' shape. `tests/games3.spec.mjs` (your
harness page on your preview): each game starts, two snapshots differ, a touch gesture changes its state (a steer, a hop,
a split), pause and resume, quit frees the canvas, the score is written; the numbers printed.

## Working lean

Ranged reads; `tail -30`; the brain suite once at the end under `nice -n 10`; no narration. Validation: brain typecheck +
suite; web typecheck + build; your spec on your preview; deck and nav green.

## The report (one message)

Base SHA, HEAD SHA, the worktree branch; commits; files and sizes; validation numbers; the measurements for the three;
LIMITS; DESIGN PICKS THE OWNER MAY CHANGE; NEEDS HIS PHONE; WHAT THE MERGE MUST KNOW (shelf3 entries, pad3, the engines to
register, the catalogue words, the spec's place in the loop).
