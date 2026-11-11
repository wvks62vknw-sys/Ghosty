# BRIEF: GAMES WAVE 2 — THE PLATFORMER, THE CAVE, and four board games he can lose to (games pass 5)

BRIEF-GAMES-5 (OWNER-ISSUES 93 "second wave: Tyrian, Cave Story, Flappy, Doodle Jump, a platformer", 94 "insanely good quality and not just
slop", 172 "no cap on skill", 176 "do all of it", 178; STARS 100 "Ghosty as an opponent he can lose to: chess (exists), draughts, Connect 4
(exists), poker, backgammon, a word game"; THE-GUIDE-11-NOV section 7; QUEUE-11-NOV item 11). Of the second wave, Flappy and Doodle Jump are
built (THE FLAP, THE CLIMB) and Tyrian is on the DOS shelf; this pass builds the two that are not, as games of our own, and the board games.
One builder, one PR. The mid tier. Start from the session branch; read BRIEF-ARCADE.md (the bar), BRIEF-GAMES-3.md and BRIEF-GAMES-4.md
(the pattern of a game of our own, and NO CAP ON SKILL), BRIEF-ARCADE-WIRE.md, `apps/web/src/arcade/{shelf,input,scores,learnable}.ts`,
`arcade/games/{kit,audio,shelf3,pad3}.ts`, `arcade/games/hopper/*` and the five of BRIEF-GAMES-4 (an Engine of our own end to end),
`features/arcade/index.ts`, the GYM's chess (`features/gym`, `gym/league.ts`: the rating that both of them carry), `tests/games4.spec.mjs`.
THE QUALITY RULE holds (every state designed, every word his, every wait said, every number honest, every control 44 pt, nothing merely fine).

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. No package, no download, nothing fetched:
every game here is our own code with our own art and synthesised sound. OWNER-ISSUES 179 (f) stands: no learner loop runs on the phone's chip;
the board games SEARCH on the chip and LEARN in the GYM on the free GPU as the other games do.

## What is built

1. **THE PLATFORMER** (`engine` id `platform`, `arcade/games/platform/*`; a shelf entry `madeByUs: true`, PLAY at once). A side-scrolling
   run-and-jump in our own look (the voxel world's palette drawn flat; never a copy of anyone's sprites): eight levels of our own, each a
   screen-wide tile map with a theme (hills, caves, rooftops, a factory, clouds, a sunken ship, a snowfield, the tower), coins, crates,
   springs, moving platforms, falling blocks, four enemy kinds with their own rules (a walker, a hopper, a flyer, a shell that is kicked),
   a flag at the end and a timer; a jump that feels right (coyote time 80 ms, a jump buffer 100 ms, variable height by hold, a hard cap on
   fall speed, squash and stretch on land), a run key, a stomp, a one-hit power state (bigger, breaks crates) lost on a hit; three lives and
   a checkpoint flag in the middle of each level; haptics on land, stomp and hit; our own tune per theme (`audio.ts` Tune) and our own effects.
   Touch: ◀ ▶ under the left thumb, JUMP and RUN under the right (44 pt and more), a controller's d-pad and buttons, the keyboard. Ghosty plays
   it (a `Learnable` with the screen's tiles as its observation; a bot that practises each level at open as the five of GAMES 4 do) and his
   best time per level is the dotted ghost that runs beside you; the card ends "You: Level N · Ghosty: Level N" with no cap (GAMES 4's
   measure: the level is 1 plus the rating with no ceiling, the eight levels repeating faster and with more enemies above level 8).
2. **THE CAVE** (`engine` id `cave`, `arcade/games/cave/*`). A Cave Story-like exploration platformer of our own: one connected cave of
   twelve rooms in our own look (dark rock, bioluminescent moss, water that slows, falling drops), a map that fills as he explores (pinch to
   see it), save points (a lantern; saves in the arcade's save store), three tools found in order that open the cave further (a jump boot
   that doubles the jump, a blaster that levels up from the crystals it collects and loses a level on a hit, a lamp that shows hidden ways),
   six creature kinds with their own patterns, two bosses with three phases each and a health bar, health as hearts refilled at lanterns,
   dialogue cards in his voice from the cave's dwellers (our own words, short), an ending screen with the time and the crystals found, and
   NEW GAME / CONTINUE. Ghosty plays it too (his furthest room and his time on the card); the measure is the room reached and the time with
   no cap. Honest line in the report: this is OUR cave, not Cave Story; Cave Story itself (freeware, its engine GPL and needing its data
   files) is NEEDS HIS WORD and named there, not built here.
3. **FOUR BOARD GAMES HE CAN LOSE TO** (`engine` ids `draughts`, `othello`, `backgammon`, `connect4` (the GYM's Connect 4 moved into the
   arcade's frame and made strong); `arcade/games/board/*` with one shared board kit): each with the board drawn in the Machine's marks at
   44 pt squares and more, legal moves shown on touch, a take-back, a hint (one, costs the rating line nothing but says so), the rules on
   one card, our own sounds, haptics on a capture; Ghosty's play is SEARCH on the chip: Monte-Carlo tree search with a hand-written value
   for each game (material, mobility, position; backgammon with the dice rolled fairly and shown), the strength set by his thinking time
   (0.2 s to 8 s, the level dial as GAMES 4 has it, no cap: above level 20 the time grows and the search deepens), running in a Worker so
   the board never freezes, "thinking…" said with a dot as it does; a rating for both of them per game in the GYM's league the way chess
   has one (`gym/league.ts`), so each card ends "You: 1180 · Ghosty: 1420" and the Report card lists the four; the level rises and falls
   with the result as GAMES 4's measure does. AlphaZero-style LEARNING of a value and policy network: the slot exists (a `weights` the
   search reads if present, absent by default, with the GYM's free-GPU job named as the place that fills it), and the honest line on the
   card and in the report says "search alone until trained"; no learning loop runs on the phone (179 f).
4. **PICO-8 CARTS, HONESTLY NOT HERE.** PICO-8 is a paid, closed program; its carts need a runtime; the free re-implementations are a WASM
   build to download and most carts on its board are licensed for non-commercial sharing. It is NEEDS HIS WORD (the runtime's licence, the
   download with its size, the carts' terms) and is named in the report, not built.

## What must not change

The arcade's existing games and engines; the GYM's chess and its rating; the first-screen budget and every other budget; GLASS pixel-equal;
ONE INK's page; every control 44 pt; nothing sideways at 440 × 956 or 390 × 844 (the platformer and the cave play upright; sideways is
allowed as the kart is, said in one line); the ratchet ceiling (hex 506, rgba 1016, radiusPx 470, total 1992: equal or lower: the games'
own canvases draw from the kit's palette, not from CSS); the prompt guard; no new key; nothing downloaded.

## Tests (each fails on the code before this brief; run against it once and say so)

- apps/edge/test/games5.test.mjs (new; imported from an existing test file as kernel-yes was, one import line, since the test list is
  protected; NEEDS HIS WORD names it): the platformer's rules (a jump's height by hold, coyote time, a stomp, the flag ends the level, the
  measure rises past level 8 with no cap); the cave's rules (the three tools open the rooms in order, a save point restores, a boss's three
  phases); every board game's move generator against known positions (draughts' forced capture and kings, Othello's flips and pass, backgammon's
  bar and bearing off with a seeded die, Connect 4's win lines), the search finding a one-move win and a one-move block in each, the rating
  moving as chess's does; Ghosty's bot improving on the platformer over 100 sessions (the GAMES 4 shape).
- tests/games5.spec.mjs (new; `all=` word `games5` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390: (a)
  the ARCADE room lists six new tiles with PLAY at once, each card ending in the two scores; (b) the platformer: the pad under the thumbs,
  a jump and a run, a coin counted, a stomp, the checkpoint, the flag ends the level and "Level 2" comes up after the mark; the ghost runs; (c)
  the cave: NEW GAME, a room crossed, a lantern saves, reload and CONTINUE restores the room and hearts, the map fills; (d) each board game:
  a legal move shown on touch and made, Ghosty answers within his thinking time with "thinking…" shown, a hint, a take-back, a win ends with the
  rating line moved; (e) every control 44 pt, nothing sideways upright, reduced motion stills the parallax, sound on and off; (f) the GYM's
  Report card lists the four board ratings.
- games4, games3, games2, arcade, gym, deck, nav specs unchanged unless a fix lives in a screen they own.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8822:
`(nohup setsid node tests/preview-server.mjs 8822 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8822.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8822 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is never committed. In the foreground, alone, one after another: games5, games4, games3, games2,
arcade, gym, deck, nav, speed2, look, ink, thescan. The brain tests in the background once at the end. A timing budget missed under load is
rerun alone before it is called red. Known sandbox reds not touched: direct, aim, radio, scroll, safari, eye's own screenshot, tabs2, talk's
cooling lines. The machine is shared: load 11 to 20 is normal.

## The owner's phone check

1. ARCADE: six new tiles after THE BEAT: THE PLATFORMER, THE CAVE, DRAUGHTS, OTHELLO, BACKGAMMON, CONNECT 4, each ending in the two scores.
2. THE PLATFORMER: run and jump to the flag; does the jump feel right? Stomp a walker; kick a shell; the dotted ghost is Ghosty's best.
3. THE CAVE: find the boots; save at a lantern; close Ghosty; CONTINUE puts you back; pinch for the map.
4. DRAUGHTS at level 1, then level 12: can you still beat him? CONNECT 4: the trick that used to win every time: does it still?
5. BACKGAMMON: the dice shown; a hint; a take-back.
6. Tomorrow: Ghosty's level on THE PLATFORMER and his room in THE CAVE are higher; the GYM's Report card lists the four board ratings.
7. Does any of the six feel like filler? Say which.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/games5-report.md: what was built, each game's size minified,
frame time p95 on the shared machine (not the phone), the bots' levels after 100 sessions, each spec's last line (before and after for the new
ones), found-not-fixed, NEEDS HIS WORD (Cave Story itself; PICO-8; the test's name in the list), the phone check as above, the commit list. One
commit per step on builder/games5; the orchestrator squashes to one on landing.
