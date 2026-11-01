# BRIEF-ARCADE — the games screen, DOOM and Quake inside Ghosty (batch ③ part 1, 1 Nov 2026)

Worktree from the branch tip (claude/ghosty-ai-training-idwhp9 at or after 4f08db0). Your preview port: 8855. Read first:
OWNER-ISSUES 93 (a), 94 (b), 95; ROADMAP.md row ③; HANDOFF.md from "- 31 Oct 23:00 UK" to the next "## ". Two other
builders work in parallel: batch ① (the Abilities tab, `packages/shared/src/catalogue.ts`, `apps/web/src/abilities/*`,
`apps/edge/src/abilities.ts`, the Workbench, `tests/abilities.spec.mjs`) and batch ② (`features/core/*`, `shell/*`,
`assistant/triggers.ts`, `features/brief/*`, `features/lens/*`, `agent.ts`, `tests/cards.spec.mjs`). Touch none of those.
Your area is new: `apps/web/src/features/arcade/*`, `apps/web/src/arcade/*`, `apps/web/public/vendor/<engine>/*`,
`tests/arcade.spec.mjs`, `apps/edge/test/arcade.test.mjs`; plus ONE import line in `apps/web/src/features/index.ts` (the
tab) and your CSS in one new block at the END of `apps/web/styles.css`.

## The owner's words

"games built into him for me to play"; "i want games that are like WOAH how are you playing that in a different app?";
"as long as they're all insanely good quality and not just slop". He owns no games: only what is free to run as it is.

## The bar

A game ships when it is finished and polished: a menu, sound, saves where the engine has them, haptics on a hit, touch
controls that feel made for a phone, a game controller when one is attached, difficulty, a best score and Ghosty's own line
about it. Tested in the spec. Nothing greyed "coming soon" on the shelf: it lists only what plays today.

## What to build (a commit each)

1. THE ARCADE SCREEN (`features/arcade/index.ts`, a TabDef like the GYM's; the shelf and the player). The SHELF: one card a
   game — the title, one plain line, its size, GET (on Wi-Fi, his tap; on mobile data it says so and waits) or PLAY, the best
   score, Ghosty's line. The PLAYER: a full-screen canvas with the TOUCH LAYER (a left virtual stick, drag-to-look on the
   right half, buttons where the thumb rests, a PAUSE that shows QUIT · SOUND · CONTROLS), the GAMEPAD LAYER (the Gamepad API
   with the standard mapping → each game's inputs; shows "controller connected" once), scores in `ghosty.arcade.scores`
   (per game: best, last, when), and a `Learnable` interface a game may implement (observe/act/score) so the GYM can play it
   later — the interface and one test only, no GYM change now. The SHELF REGISTRY in `apps/web/src/arcade/shelf.ts`: for each
   game `{ id, title, line, engine, data: { url[], sha256, bytes, licence, credit }, controls, saves, since }`; the screen
   renders from it and the node test checks every entry. Game DATA is never in the repo: fetched on his tap from fixed
   mirrors with the checksum verified, kept in the Cache API (the pattern `offline/brain.ts` uses for the brain's files,
   read it) and deletable in one tap (SETTINGS → STORAGE or the card's own ⋯). Engine CODE is vendored under
   `apps/web/public/vendor/<engine>/` with its LICENCE and a SOURCE.md naming the upstream project and exact commit.
2. DOOM. A WebAssembly source port (a GPL port such as Chocolate Doom's known Emscripten builds, or another you verify runs
   in Safari on iPhone at full speed; pick by trying, keep the evidence in SOURCE.md), vendored. Two data entries on the
   shelf: FREEDOOM PHASE 1 (fully free, BSD; the default: "DOOM, the free version with its own levels") and the ORIGINAL
   DOOM free episode ("Knee-Deep in the Dead", the shareware package id Software allows anyone to pass on unmodified:
   fetched as that package from a mirror, DOOM1.WAD taken out on the phone, nothing of ours redistributes it). Touch: move
   on the stick, look by drag, FIRE/USE/WEAPON buttons; the engine's saves in IDBFS; sound through the engine; 35 fps as
   DOOM runs; the first level loads in under ten seconds after GET. Ghosty's line on the card and on a finished level.
3. QUAKE. A WebGL or WebAssembly port of the Quake engine (GPL; e.g. the WebQuake project or an Emscripten QuakeSpasm; verify
   on a phone-sized viewport), vendored; the free episode "Dimension of the Doomed" from the shareware package the same
   way (pak0 taken out on the phone). Touch as DOOM plus JUMP; saves; sound. If no port runs well enough by your bar, ship
   DOOM alone and say so: never a game that stutters.
4. THE FREE LEVELS. For DOOM: a LEVELS panel in the player that lists a dozen of the most-loved free fan level packs by name
   and size with GET (fixed list, checksums, each licence allowing free distribution: the idgames archive's terms per
   entry), loaded over Freedoom or the free episode as the pack requires; say the pack's author on its card.
5. The CI loop: add `arcade` at the END of the smoke loop's list in `.github/workflows/check.yml` (nothing else in that file).

## The lines that hold

Nothing commercial is ever bundled or fetched: only data its own licence allows anyone to pass on, named per entry; no
emulator for console games. Downloads only on his tap, on Wi-Fi, size said first, checksum verified, deletable. Nothing
that bills (no paid CDN, no new keys; mirrors are public). The plain prompt gains nothing. No test skipped or weakened; the
guard job untouched. No model names anywhere. The games run entirely on the phone: no game traffic through the brain.

## Tests

Node (`apps/edge/test/arcade.test.mjs`, bundling the phone modules with esbuild as the other phone tests do): the shelf
registry (every field, every url https, every sha256 64 hex, bytes > 0, licence and credit non-empty); the scores store;
the touch mapping and the gamepad mapping (standard mapping indices → inputs); `Learnable`'s contract. Spec
`tests/arcade.spec.mjs` on your preview: the tab opens from the deck and #arcade; the shelf lists the games with sizes and
GET; GET on a stubbed mobile-data connection waits with its line; with the network stubbed to serve a tiny valid fixture
(for the engine test use the smallest real free data you can fetch at build time into tests/fixtures, or a generated
minimal WAD if the engine accepts one), PLAY opens the player, frames render (two canvas snapshots differ), the touch
layer is visible, PAUSE → QUIT returns to the shelf and the best score is written; nothing sideways at 390 × 844; VoiceOver
labels on every control. Keep `deck`, `nav`, `gym` green.

## Working lean (credits are the constraint this week)

Read only what this brief names and what it imports (`sed -n`, `grep -n`); test output through `tail -30`; the full brain
suite once at the end under `nice -n 10`; write each new file whole; no narration. Validation: brain typecheck + suite; web
typecheck + build; specs on one fresh preview: websites, apps, deck, nav, gym, arcade. Report real numbers: engine fps on
the preview, load times, bundle sizes, data sizes.

## The report (one message)

Base SHA, HEAD SHA, the worktree branch; commits in order; files changed (vendor sizes); validation numbers; which engines
run and the evidence; LIMITS (what did not meet the bar and why); DESIGN PICKS THE OWNER MAY CHANGE; NEEDS HIS PHONE (the
real test is Safari on his phone: say what to try); WHAT THE MERGE MUST KNOW (the one line in features/index.ts, the CSS
block, the CI loop line, new registry items for batch ①'s catalogue).
