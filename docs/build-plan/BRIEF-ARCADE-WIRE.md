# BRIEF-ARCADE-WIRE — DOOM, Freedoom, the free levels and Quake in the arcade player (batch ③ part 1c, 1 Nov 2026)

Worktree from the LOCAL tip of claude/ghosty-ai-training-idwhp9 (at or after ae0dfeb; the remote is behind: never reset
to FETCH_HEAD, only to the local branch). Your preview port: 8811. Read first: BRIEF-ARCADE.md (the bar and the lines),
OWNER-ISSUES 102 and 103 (what the two arcade builders made and what they said the merge must know), `apps/web/src/arcade/`
(shelf.ts, levels.ts, store.ts, input.ts, scores.ts, dos.ts, engines/*), `apps/web/src/features/arcade/index.ts` (the
player), `apps/web/public/vendor/doom/SOURCE.md` and `vendor/quake/SOURCE.md`, `tests/arcade.spec.mjs`,
`tests/engines.spec.mjs` + `tests/fixtures/engines/` (its harness and fetch.sh), `apps/edge/test/engines.test.mjs` and
`arcade.test.mjs`. Other builders run in parallel (two 3-D games in `arcade/games/*`; the packs): touch nothing of theirs.
Yours: `apps/web/src/arcade/*` (not `games/`), `features/arcade/*`, `tests/arcade.spec.mjs`, `tests/engines.spec.mjs`,
the two arcade/engines node tests, the CI smoke loop's list and one fetch step, the ARCADE catalogue entry's words, a CSS
block at the END of styles.css if needed.

## What this step is

The native engines (OWNER-ISSUES 103) are merged but the player does not import them: `arcade/engines/index.ts` has
`ENGINES = { dos }`. Two engines tests fail on the merged tree because the shelf's `doom-dos` row has no native engine:
`doom-dos: the use button does nothing` and `doom-dos: its engine is here`. Wire it all together, in this order, a commit
each:

1. ENGINES = { dos, doom, quake }. One DOOM row on the shelf: `doom-shareware` on the native engine (drop `doom-dos`;
   the DOS engine keeps the other twelve games). FREEDOOM rows: Phase 1 from the one Freedoom package (and Phase 2 as a
   second card at no extra download, as the registry already allows). QUAKE listed (its card's line says his phone decides
   the frame rate and asks him to say if it stutters: the builder had no GPU to judge). The engines test and the arcade
   test green.
2. THE PLAYER with the native engines, exactly as OWNER-ISSUES 103 says the engines need: `start()` called inside PLAY's
   own tap (the audio context is made first thing); a fresh canvas per game (DOOM draws in 2-D, Quake in WebGL), let go on
   quit; one shared Intent updated in place (look amounts add up; the engine zeroes them); `pause` opens the game's own
   menu, so the PAUSE sheet gets a GAME MENU entry and gamepad START reaches the game's menu unless the sheet is open;
   `saveStore(game.id)`; `onQuit` returns to the shelf; `onLevelDone` writes the score (DOOM 0–300, Quake 0–200, with
   the words the engines give) and Ghosty's line; `onHit` ticks haptics where the phone has them; `probe()` feeds one small
   fps line in PAUSE (and the spec). The touch layer's buttons per game from input.ts: reconcile the Intent slots the DOS
   step added (menu, ok, crouch, special) with what DOOM and Quake read, so every button a game shows does something and the
   engines test's check holds.
3. THE LEVELS panel in the player for DOOM: the dozen free fan packs in `levels.ts` by name, author and size with GET
   (checksums as the store does), loaded over Freedoom Phase 2 (or Phase 1 where the pack says) through the adapter's
   `args` (-file), the pack's author on its card; a pack that needs a .deh says in one line that its names and messages
   are the original engine's (no DeHackEd).
4. CI: `engines` at the END of the smoke loop's list in `.github/workflows/check.yml`, and one step before the loop that
   runs `sh tests/fixtures/engines/fetch.sh` (35 MB from archive.org, never committed) with a clear line if it cannot
   fetch (the spec then skips with its one line). Nothing else in that file.
5. The ARCADE catalogue entry's line names DOOM, Freedoom and Quake as well (packages/shared/src/catalogue/app1.ts;
   the catalogue test stays green).

## The lines that hold

As BRIEF-ARCADE and BRIEF-ENGINES. Nothing commercial. Downloads on his tap on Wi-Fi with the size said and the checksum
verified. GPL kept whole. The service worker's vendor cache name is bumped in sw.js ONLY if you rebuild an engine (you
should not need to). No test skipped or weakened. No model names anywhere.

## Tests

`tests/arcade.spec.mjs` extended: with the free data present (fetch.sh), PLAY on DOOM through the native engine renders
frames, FIRE from the title reaches E1M1, PAUSE shows the fps line and GAME MENU, QUIT returns and the longest-sitting score
is written; Freedoom Phase 1 the same; LEVELS lists the packs with GET; Quake starts and renders; without the data these
checks skip with one line. The engines spec keeps passing. The two engines node tests green. deck, nav, gym green.

## Working lean

Ranged reads; `tail -30`; the brain suite once at the end under `nice -n 10`; no narration. Validation: brain typecheck +
suite; web typecheck + build; on one fresh preview: websites, apps, deck, nav, gym, arcade, engines.

## The report (one message)

Base SHA, HEAD SHA, the worktree branch; commits; files; validation numbers (fps per engine in the preview); LIMITS;
NEEDS HIS PHONE; WHAT THE MERGE MUST KNOW.
