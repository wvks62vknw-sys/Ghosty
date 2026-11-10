# BRIEF-GAMES-4 — the games he named that are not built, and no cap on skill: BLOCKS, BLAST, THE FLAP, THE CLIMB, THE BEAT (games pass 4, 10 Nov 2026)

AUDIT-8-NOV items 10 (SKILLS THAT HAVE NO CAP) and 12 (GAMES), OWNER-ISSUES 93 (his ten: #8 a rhythm platformer with our own
music, #9 Blocks with Tetris mechanics and Block Blast mechanics against him), 94 ("hundreds all sorts of COOL games", the bar:
"as long as they're all insanely good quality and not just slop"; the second wave Flappy, Doodle Jump, a platformer), 82 (c)
("much more advanced, i was thinking of things like block blast, subway surfers"), 57 (b) ("there should be no such thing as him
mastering a game because he should have no limit of how good he can get"), 92 (8) (that wish folded into games). What exists
(AUDIT line 47): DOOM, Quake, Freedoom, the DOS classics, the level packs, the block world, the runner (the Subway Surfers
reading is built), the kart racer, the hopper, the arena, chess with Elo. What is not recorded as built: the rhythm platformer,
Blocks and Block Blast, Flappy, Doodle Jump, the platformer. The mid tier. Start from the session branch; read BRIEF-ARCADE.md
(the bar), BRIEF-GAMES-2.md and BRIEF-GAMES-3.md (the pattern of a game of our own), BRIEF-ARCADE-WIRE.md (how the player
starts an engine), and `apps/web/src/arcade/{shelf,input,scores,learnable}.ts`, `arcade/games/{kit,audio,shelf3,pad3}.ts`,
`games/hopper/*` (an Engine of our own end to end), `features/arcade/index.ts`, `tests/games3.spec.mjs`.

## What is fixed

1. **FIVE GAMES, each a real one in the arcade's own frame** (`engine` ids `blocks`, `blast`, `flap`, `climb`, `beat`; each a shelf
   entry with `madeByUs: true`, `data: null`, listed with PLAY at once):
   - **BLOCKS** (Tetris mechanics, against him): a 10 × 20 well, seven pieces with a bag shuffle, rotate with wall kicks, hold,
     a ghost piece, soft and hard drop, lock delay, gravity by level; Ghosty plays a second well beside yours (a bot with a
     stack heuristic whose weights he tunes) and every double, triple or four-line clear sends garbage rows to the other well; whoever
     tops out first loses. Touch: ◀ ▶ ⟳ ▼ HOLD DROP under the thumbs and a swipe on the well (left/right moves, down drops, a tap turns).
   - **BLAST** (Block Blast mechanics): an 8 × 8 grid and three pieces offered at a time; drag a piece onto the grid (it
     previews where it lands and what it would clear), full rows and columns clear, combos and a streak multiplier score, no
     rotation, the run ends when none of the three fits. Ghosty plays it with a placement heuristic and shows his best.
   - **THE FLAP** (Flappy mechanics, our own look): a ghost drifting through glowing pillars; tap to flap; moving gaps and a
     wind as the level rises; pipes passed are the score.
   - **THE CLIMB** (Doodle Jump mechanics, our own look): a jumper that bounces on its own up an endless tower of platforms (still,
     sliding, crumbling, springs and a jet), steered by dragging or two buttons, wrapping at the edges; height is the score.
   - **THE BEAT** (the rhythm platformer, OWNER-ISSUES 93 #8, our own music): a runner who jumps, ducks and dashes in time with a
     synthesised track whose notes ARE the obstacles (a note on the beat is a gap to jump, a low note a bar to duck, an accent a
     wall to dash through); three tracks of our own, a timing grade per note (PERFECT, GOOD, LATE), a combo; the song is made by
     code (games/audio.ts's synth), no samples, no fetch.
2. **NO CAP ON SKILL** (`arcade/games/two/skill.ts`): every game has a LEVEL that rises when the player passes it and falls a
   little when he fails (a pass moves him up by one plus one more for each doubling of the target he beat; a fail takes 0.8 back,
   never below level 1), so every run is set at his edge; the numbers of a level are strictly increasing functions of the level
   with no ceiling and no top rank (past the named ranks it is just "Level 41"). Ghosty has his own level in each game, kept the
   same way: he practises on the real rules (no model; code), tunes his bot's weights by trying small changes and keeping the better,
   and his level climbs as long as his play improves. Both are shown on the shelf card, in the title menu and at the end of a run.
   The test: a simulated player whose ability grows without end keeps gaining levels past 100, 1,000 and 10,000 (a cap would have
   stopped him), a difficulty table that never repeats and never flattens, and Ghosty's real practice on each game's own rules
   raises his level over several hundred sessions.
3. **EVERY GAME'S FRAME is the arcade's own**: the kit's Overlay (menus Play · How to play · Sound · Quit at 44 pt in the app's
   sentence case, Ghosty's line, VoiceOver labels), haptics on a hit, pause on a tap or when hidden, the pad through the Intent
   (START pauses, the d-pad moves), the keyboard, sound from games/audio.ts's synth, scores through scores.ts, the canvas freed on
   quit, `Learnable` implemented by all five (observe/act/score) and held by `checkLearnable`.
4. **The look**: the games' canvases draw their own worlds, in the system's tokens' colours where they touch the frame (the
   accent from `--c`); their frames, buttons and words are the shared `.g2ui` pieces. One new CSS block at the END of styles.css,
   in tokens only, adding no new hex, rgba or px radius beyond what the ratchet allows (the ratchet's ceiling holds: hex 506,
   rgba 1016, radiusPx 470, total 1992, equal or lower). Works in all three worlds (the Scan with its house, Glass, ONE INK).

## What must not change

The prompt guard; the CI guard job; `.github/*` but the one word `games4` at the end of the `all=` list; `apps/*/package.json`;
`apps/edge/src/agent.ts`, `index.ts`, `tools/{index,types,repo}.ts`; no packages, nothing fetched (these games are built in),
no new keys, nothing that can cost money; never a model's name; no test skipped or weakened (the arcade test's list of engines
and made-by-us games is EXTENDED by the five, never loosened); the eight games already on the shelf play as they did.

## Tests (each fails on the code before this brief)

1. `apps/edge/test/games4.test.mjs` (node, no screen): BLOCKS' rules (bag shuffle gives every piece once per seven, rotation and
   kicks never overlap a block, a line clear removes full rows, garbage rows rise with one hole, hold swaps once per piece, gravity
   rises with the level, top-out ends it); BLAST's (a placement is legal only on empty cells, full rows and columns clear together,
   the combo multiplies, the run ends exactly when none of three fits, the generator never offers an impossible set at low levels);
   THE FLAP's (a gap is always reachable from the last, gravity and flap arithmetic, passing counts once); THE CLIMB's (every tower
   section is climbable at every level, wrap at the edges, a crumbling platform gives once, height is monotone); THE BEAT's (every
   note's obstacle is clearable by the right move, grades by timing, the track is the same for a seed); the skill measure (above);
   Ghosty's practice raises his level; `checkLearnable` on all five; the shelf entries hold the madeByUs rule; the pad mappings; the
   catalogue words' shape.
2. `tests/games4.spec.mjs` with a harness under `tests/fixtures/games4/`: each game starts at 390 × 844 × 3, two snapshots differ, a
   touch changes its state (a rotate, a drag-drop, a flap, a steer, a jump), pause and resume, quit frees the canvas, the score and
   the level are written, nothing sideways, every control labelled and 44 pt, the frame times printed.
3. `arcade` spec (extended): the shelf lists the five made by us more, each with PLAY at once.
4. The ratchet test holds.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; results to the scratchpad file)

`cd apps/web && npx tsc --noEmit -p . && node build.mjs`; then the node test alone; then the brain tests (background, about ten
minutes); then every spec in the `all=` list run in the foreground one at a time against the preview on port 8801, each one's last
line written to the report as it finishes. The known reds of this sandbox (direct, aim, radio, scroll and safari for want of
WebKit, eye's own screenshot; tabs2 on the base too) are said as such; a timing budget missed under load is rerun alone first.

## The owner's phone check (in these terms)

(1) Open the ARCADE room (GAMES in the house, or say "open the arcade"): five new tiles beside the kart and the hopper: BLOCKS, BLAST,
THE FLAP, THE CLIMB, THE BEAT, each with "Level 1" and a line from Ghosty. (2) BLOCKS: play a well against Ghosty's; clear two or
more lines at once and watch rows rise in his; watch his stack when you send them. (3) BLAST: drag a piece; a ghost shows where it
lands; clear a row and a column together for a combo. (4) THE FLAP and THE CLIMB: tap and drag; get past the pass mark and see
"Level 2" come up, then the next game is harder; fail twice and see it ease back one. (5) THE BEAT: wear headphones; jump on the
beat. (6) Come back tomorrow: Ghosty's level on each card is higher than yesterday's: he practised on the real rules. (7) Does any
of it feel like filler? Say which.

## Report

In the scratchpad file (games-report.md): every commit's hash and one line; each game built, how it is played and how Ghosty
plays it; the no-cap proof; NOT REACHED; each spec's last line verbatim and its verdict; NEEDS HIS WORD items (apps/edge/package.json
test list: `test/games4.test.mjs` is not in it because that file is protected); the phone check. Never push. Named by tier, never
by model.
