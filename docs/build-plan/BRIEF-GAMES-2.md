# BRIEF-GAMES-2 — two games of our own in 3-D, at the bar: THE BLOCK WORLD and THE RUNNER (batch ③ part 2, 1 Nov 2026)

Worktree from the branch tip (claude/ghosty-ai-training-idwhp9 at or after 059a82b: batch ① is in; the arcade's first half
is in `apps/web/src/arcade/`). Your preview port: 8800. Read first: BRIEF-ARCADE.md (the bar and the lines: binding),
BRIEF-ENGINES.md's adapter interface (`Engine`, `EngineHandle`, `EngineEvents`, `SaveStore`: another builder is writing
`arcade/engines/types.ts` and `engines/saves.ts` to exactly that shape — write yours against it and, if the files are not
in your tree yet, create them with that exact shape so the merge is a no-op), `arcade/input.ts` (the Intent), `shelf.ts`,
`learnable.ts`, `scores.ts`, OWNER-ISSUES 93 (a), 94 (b), 95–97, 99 (the catalogue rules: your two games need entries in
`packages/shared/src/catalogue/*.ts` and the completeness test must pass). three.js is vendored under
`apps/web/public/vendor/three` and loaded lazily by `features/studio/viewer.ts`: load it the same way, only when a game
starts. Other builders run in parallel: the arcade SCREEN and the DOS engine (`features/arcade/*`, `arcade/dos*`,
`arcade/engines/index.ts`), native DOOM and Quake (`arcade/engines/doom.ts|quake.ts`, `vendor/doom|quake`), sideways, the
small brain. Yours: `apps/web/src/arcade/games/voxel/*`, `arcade/games/runner/*`, `arcade/games/shelf.ts` (your two shelf
entries, merged into the shelf at merge time), `arcade/games/audio.ts` (synthesised sound: no recorded or copyrighted
audio), `apps/edge/test/games2.test.mjs`, `tests/games2.spec.mjs` with a harness page under `tests/fixtures/games2/`, the
catalogue words, and a CSS block at the END of `apps/web/styles.css`. Touch nothing else.

## The owner's words

"i want games that are like WOAH how are you playing that in a different app"; "insanely good quality and not just slop".
A Minecraft-style world and a Subway-Surfers-style runner, in our own look: never their textures, names, characters or
music. These two are `Engine` implementations with no data files (`data: null`; extend the shelf test to allow it for
`madeByUs: true` entries), so they PLAY at once with no GET.

## THE BLOCK WORLD (`games/voxel`)

A blocky world of our own palette (flat-shaded colours, soft light, a sky that turns), chunked and procedural from a seed
(terrain with hills, water, trees, caves near the surface; 8 block kinds), rendered with greedy-meshed chunk geometry so it
holds 60 fps at a phone's pixel density within a view distance you choose and justify; day and night; place and dig with a
tap (a reticle), the left stick to walk, drag to look, a JUMP button, fly toggle in the pause menu; three saved worlds in
IndexedDB through the SaveStore (name, seed, every changed block), autosaved. GHOSTY BUILDS WHAT YOU SAY, no model: a BUILD
button opens a one-line box; a fixed vocabulary in code — house, castle, tower, bridge, pyramid, wall, pool, garden, maze,
statue of a cat, a boat, a lighthouse — with size words (small, big, huge) and a material word (stone, wood, glass, brick,
gold); parametric generators with variation by seed place the structure in front of the player block by block over a few
seconds, Ghosty's line as it goes ("Castle coming up. Give me a moment."); an unknown word gets "I can build these:" and
the list. Say the vocabulary in the catalogue entry. Haptics on a dig; synthesised block sounds. `Learnable`: not for this
one.

## THE RUNNER (`games/runner`)

Three lanes through a long world of our own (a city of coloured blocks at dawn, then tunnels, then a bridge, then a
rooftop; the scenery loops with variation), the runner is a simple figure of our own design (Ghosty's colour), chased by
a shadow that catches you on the second stumble. Swipe left/right to change lane, up to jump, down to roll; a gamepad's
d-pad and A/B do the same. Obstacles: low barriers (jump), high beams (roll), pillars (change lane), gaps; coins in arcs;
power-ups (a magnet, a shield, a score doubler, a jump boost) with timers; speed rises with distance; a score in distance
and coins; a best; Ghosty's own best (from the GYM later) shown as a ghost marker when it exists. Camera and movement
tuned so it feels fast and fair at 60 fps; a stumble is recoverable once. `Learnable` implemented: `observe()` gives the
lane, the next three obstacles' kinds and distances, the coins and the speed as numbers; `act(move)` takes one of five
moves; `score()` the distance; the GYM will use it later (no GYM change now). Synthesised music: a short generative loop
that speeds up with the run (no recorded tracks).

## Both

Menus (PLAY · HOW TO PLAY · SOUND · QUIT) at 44 pt, VoiceOver labels, haptics, pause on a tap or when the tab is hidden,
scores through `scores.ts`, Ghosty's line on each shelf card and at the end of a run, nothing sideways at 390 × 844 (both
work in portrait), the Engine handle's pause/resume/quit/setSound honoured, the canvas freed on quit. Measure in your
harness at 390 × 844 × 3 device pixels: frame time p95 and the time to first frame; record them.

## The lines that hold

As BRIEF-ARCADE. Our own look and names (the catalogue calls them "the block world" and "the runner"); no copyrighted art,
names, characters or audio; everything runs on the phone; no model calls; the plain prompt untouched; no test skipped or
weakened; the guard job untouched; no model names anywhere.

## Tests

`games2.test.mjs`: the world generator is deterministic per seed and chunk; the greedy mesher's face count on a known
chunk; every BUILD word produces a structure within bounds with the right material; the runner's lane and obstacle logic
(collision kinds, a jump clears a barrier, a roll clears a beam, a stumble then a catch), scoring, power-up timers, the
Learnable contract. `tests/games2.spec.mjs` (harness page, your preview): each game starts, two snapshots differ, a touch
gesture changes the state (lane; a placed block), pause and resume, quit frees the canvas, the score is written; the
frame-time numbers printed. Keep `deck` and `nav` green.

## Working lean

Ranged reads; `tail -30`; the brain suite once at the end under `nice -n 10`; no narration. Validation: brain typecheck +
suite; web typecheck + build; your spec on your preview; deck, nav.

## The report (one message)

Base SHA, HEAD SHA, the worktree branch; commits; files; validation numbers; frame times and first-frame times for both;
the BUILD vocabulary; LIMITS; DESIGN PICKS THE OWNER MAY CHANGE; NEEDS HIS PHONE; WHAT THE MERGE MUST KNOW (your shelf
entries to merge into shelf.ts, the engines to register, the catalogue entries).
