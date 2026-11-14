# APPLIB PLAY & MAKE: the game kinds and App Maker

The PLAY & MAKE lane of THE APP LIBRARY (brief: `APPLIB.md`). Branch `claude/new-session-4erjve-lane-applib-play`.

## What landed

### All twenty game kinds
Each kind has two parts:
- pure logic in `packages/shared/src/applib/games/<kind>.ts`;
- a board in `apps/web/src/features/applib/games/<kind>.ts`.

The boards register as the engine's `game` renderer (`games/index.ts` calls `registerRenderer('game', …)`). The options each kind reads are listed at the top of both files, and in `GAME_OPTIONS` in `maker.ts`.

| Kind | What makes it fair or right | Options |
|---|---|---|
| sudoku | A removal is kept only while the puzzle has exactly one solution. Clashes are shown, with notes and a hint. | difficulty, mistakes, daily |
| mines | Mines are laid after the first tap, away from it and its neighbours, so the first tap always opens an area. Chording and long-press flags. | rows, cols, mines |
| merge | Tiles join once per swipe. Play can go on past the target. | size, target |
| solitaire | Every deal is played out by a solver before it is dealt; the first winnable deal from the seed is used (20 of 20 sampled deals won). Tap-to-move, home all, auto-finish. | draw (1 or 3) |
| wordguess | Repeated letters are marked fairly. A 550-word British list. The daily word is the same all day. A strict mode is optional. | words, tries, daily, strict |
| nonogram | A picture is kept only if line logic alone solves it, so no guessing is ever needed. Drag to paint; cross mode; finished clues grey out. | size, density, daily |
| pairs | Every pair is dealt twice. A miss turns back; the score is turns over pairs. | pairs, cols |
| blocks | A seven-piece bag, wall kicks, a shadow and the next piece. 100, 300, 500 or 800 points times the level. | cols, rows, level |
| snake | Cannot turn back on itself; quickens every five foods; wrap is optional. | size, speed, wrap |
| slide | Shuffled by legal moves from solved, so it can always be solved (the parity rule is checked). | size |
| lights | Scrambled by presses from all-off, so it can always be cleared within par. | size, moves |
| simon | The sequence grows by one; a soft tone per pad. | pads, speed |
| reaction | An early tap retakes the round. Lower is better, so the best kept is the lowest. | rounds, minMs, maxMs |
| hangman | Drawn as a lamp that dims, not a gallows. | words, misses |
| anagram | A scramble never spells the word; any listed word from the same letters counts. | words, secs |
| typing | Words a minute counted the standard way (five characters a word, correct characters only). | passages, secs |
| sprint | Division always comes out whole; subtraction never goes below zero. | secs, ops, max |
| dots | The fair phone takes a free box and never gives one away while it has a safe line. | size, cpu |
| quiz | Built-in plain facts, or his own lines ("Question \| right \| wrong \| wrong"). | questions, count, secs |
| wordgrid | Every listed word is placed before the grid is filled. Drag, or tap the first and last letters. | words, size, count, diagonal |

**The game frame** (`games/frame.ts`):
- the live score and a line beside it, the best kept on the phone, and the streak (wins in a row);
- PAUSE hides the board;
- the game is kept after every move under `ghosty.app.<id>.play`, so a reload, a call or a locked phone comes back to the same game, paused, with RESUME;
- the end card says when it is a new best, with PLAY AGAIN;
- the kit's own UNDO and REDO keys at the bottom take a move back and forward, up to 50 moves, from the kept snapshots. This works in sudoku, mines, merge, solitaire, nonogram, slide and lights. It is never offered for a guess in a word game, a memory flip or a real-time move, where taking a move back would be a cheat.

**Real time:** snake and blocks draw on a canvas at the phone's pixel ratio, on `requestAnimationFrame`. Everything else uses DOM grids. All colours are world tokens, read again from the tokens on pause and resume.

**Touch:**
- every `button` is at least 44 pt, checked at 390 for every board;
- swipes and the arrow keys work on the swipe kinds;
- board cells are grid cells, not keys;
- the word kinds' letter keys are phone-keyboard size (about 35 pt wide and 52 pt tall, like the phone's own keyboard), because ten keys across cannot be 44 pt wide at 390.

**Originality:**
- genres only, with no copied names, art or levels;
- word lists, passages and quiz facts were written here;
- the card faces are our own simple shapes.

### App Maker
`apps/web/src/features/applib/maker.ts` and `packages/shared/src/applib/draft.ts`.

**What he can do:**
- **NEW APP:** pick one of six kinds: records (log), checklist, counter, timer, cards (deck) or game.
- **Edit a records app:**
  - name and icon;
  - add, rename, move or remove fields of all fourteen FieldTypes, with options for choice and multi and a unit for number;
  - what each row shows;
  - stats (how many, total, average, highest, lowest, different, days in a row);
  - views (list, board, calendar and gallery, each offered only when the fields allow it).
- **Edit the other kinds:**
  - checklist: its lines and when it starts fresh;
  - counter: names, step and reset;
  - timer: steps and rounds;
  - cards: question and answer, and the mode;
  - game: any of the twenty kinds, with that kind's options.
- **DESCRIBE:** "make me an app for my vinyl" becomes a first draft, shown with what was assumed, for his OK before anything is kept. The reading builds on `appkit/brief.ts`'s `readApp`, which handles trackers, lists, timers, counters, habits, notes and cards. On top of it, draft.ts adds the things people collect, each with the fields a category leader has: vinyl, books, films, wine, plants, board games, recipes, gigs, spirits, trainers, comics, coins or stamps, watches, cameras, coffee beans and video games. It also reads game genres by their words, and turns "an app for my <thing>" into a collection of that thing.
- **Duplicate and change:** `openMaker(root, { from: def })` opens a copy of any Library app under his own id.

**How it is kept and checked:**
- Made apps are the kit's own things (`ghosty.app.maker`), so a delete goes to Recently deleted, with Undo.
- `myApps()` hands them to the Library, where the same engine draws them.
- Nothing is kept until `check()` (the engine's `validateApp` plus a free id) finds no problem. The problems are listed in plain words beside SAVE.
- `finish()` fills what the validator needs: a pitch, keywords, a three-line tour and two sample records.
- Honest refusals: live data (from brief.ts's limits), and calculators ("needs its formula from a public source and checked answers, so those come ready-made in the Library").

### Brain tests
`apps/edge/test/applibgames.test.mjs`, run from `appkit.test.mjs` after the engine's `applib.test.mjs`. It has 19 tests.
- **The dice:** seeded and replayable.
- **Solvable or fair, for every kind that needs it:**
  - sudoku: exactly one solution at three difficulties;
  - mines: 30 first taps, all openings;
  - solitaire: deals won by the solver;
  - nonogram: line-solvable at 5, 10 and 15;
  - slide and lights: always solvable;
  - wordgrid: every word placed.
- **Scoring, and the win and the loss,** for every kind.
- **App Maker:**
  - a blank app of every archetype passes the validator;
  - all fourteen field types are added, moved, changed and removed, and the app stays valid;
  - duplicate and change;
  - eleven requests from words each become a valid draft of the right kind;
  - honest refusals for live data and calculators;
  - ids stay free of the Library's and his own.

## What the ENGINE lane hooks in (sent to the ENGINE session)
1. `import './games';` once, from the Library screen. This registers the game renderer. It keeps `k.body` to itself across the kit's redraws and returns a stop function. Hiding `.ak-tools` (Undo and Redo) for games would be cleaner.
2. `openMaker(root, { taken, openApp, from?, words? })` and `myApps()` from `features/applib/maker.ts`, for "make my own from this", "make me an app for…", and listing and opening his own apps.

## Needs its own build
- **Calculators in App Maker.** A calc needs a formula with a named public source and tests whose answers come from that source. App Maker cannot honestly supply those from his words, so calculators come ready-made in the Library.

## Overlap with the Arcade
The polish3 lane's Arcade plays DOOM, Quake, DOS classics and our own 3D and board games (`apps/web/src/arcade/**`). None of those is one of these twenty puzzle and word kinds, so no logic was duplicated. The gym's AI sudoku (`apps/web/src/gym/sudoku.ts`) is a solver for training, in the web app. These kinds' logic lives in `packages/shared` so the brain tests can run it.
