# THE PRO ROUND, lane KINDS: report

The brief is APPLIB-PRO.md. This lane rebuilt every small kind of app: calc, checklist, timer, counter, deck and guide, plus the
game launcher frame. All of it lives in `apps/web/src/features/applib/renderers/kinds.ts`. `simple.ts` now keeps only the shared
helpers and the screen kind. The styles are one block at the end of `apps/web/styles.css`, using tokens only.

## What landed
- **calc**
  - **The answer first.** The first output with `bands` (or else the first that isn't a flag) is shown big, with its band's
    words in its tone colour, for example "22.9 · Healthy weight". The tones map to `--g-ok`, `--g-amber`, `--g-red` and the
    accent. `explain` sits under the answer. The other outputs are tiles, and a tile shows its band words or its `explain`.
  - **No raw flags.** An output whose expression compares and only ever gives 0 or 1 (at the defaults and in every test) never
    shows unless it has bands. "Over 25: 0" is gone.
  - **Inputs.** Each input has a slider, − and + steppers, and a number box (typing still works). Unit chips switch the shown
    unit; the stored value stays in the app's unit. The chips cover kg/lb/st, cm/in, m/ft, km/mi, g/oz, ml/fl oz, °C/°F and
    km/h/mph. When the app sets no range, the slider takes one from the default. Choices with four options or fewer show as a
    segmented control.
  - **KEEP** saves the answer and its words to a History card. The estimate and source lines sit quietly at the foot.
- **checklist:** a progress ring hero with a cheer line and the fresh start said kindly ("It starts fresh each morning…"). On a
  new day it says how far he got last time. Sections are cards with "All done" in green when finished. A tick pops with a
  tick mark and a light buzz.
- **timer:** a big ring countdown for the current step, with the step's name, the clock and the round inside it. The next step
  is shown under the ring, rounds are dots and the steps list is a card. Every step change plays a chime and the step's name is
  said aloud (it can be switched off in Settings). The run is kept, so a reload carries on mid-ring.
- **counter:** big tactile tally tiles. Tap adds; a long press (half a second) takes one off; a small − key is also there. An
  "In the lead" card names the leader, and the leading tile gets a Leader chip.
- **deck:** a card that flips in 3D on a tap. Swipe right means knew it (Good), swipe left means again, and the card leans and
  tints as he drags. Each rating key shows its next interval from SM-2. A progress bar shows reviewed and due cards, and a
  session summary (reviewed, knew it, again, next due) closes the session.
- **guide:** an article reader with a header (icon, section count, minutes to read), every section as readable 17 px text, and
  tags as chips. A Contents sheet jumps to any section. Search filters the sections and highlights the matches.
- **game launcher:** a game opens on an art tile with its glyph, its name and pitch, a big PLAY key, and Best, Streak and Today
  chips (Best and Streak come from the board's own record; Today is counted on PLAY). A game left part-way skips the launcher
  and goes straight back to its board. The boards themselves are still PLAY & MAKE's. The hook is one line in `engine.ts`
  `mountApp`.

## Specs
- New: `tests/applibkinds.spec.mjs`, added as the last word of `all=`. At 440 × 956 and at 390 it checks:
  - calc: the worded answer, its tone and `explain`; no raw 0, 1 or boolean; the slider, typing, steppers and a unit chip
    each change it; KEEP saves to the history; the foot lines;
  - checklist: the ring and the section cards;
  - timer: the ring runs and keeps running across a reload, and the rounds turn to dots;
  - deck: a tap flips the card; a swipe right and a swipe left; the intervals; the summary;
  - counter: a tap, a long press and the leader;
  - guide: the contents sheet and highlighted search;
  - a game: the launcher and PLAY;
  - fit throughout: 44 pt keys, nothing sideways, one scroll area.
- `applib`, updated to the new screens just as strictly: the calc's hero, typing into the number box, a flag output must not
  show, and a new output that reads an earlier one must show.
- `applibplay`: its `go` taps PLAY when a launcher is shown.
- All three pass. The brain suite (`npm test` in apps/edge) ran before each landing.

## Following SHELL
Everything draws inside the kit's scroll area using `--g-*` tokens and the accent, so SHELL's skins and accent change these
screens without edits. Nothing here sets a skin.

## After SHELL landed (75dbf67), and the lead's launcher notes (landed 45d7267)
- Inside SHELL's frame, the rings, sliders, unit chips, ticks, round dots, the leader chip, the guide icon and the launcher's art
  take each app's own `--al-accent` and `--al-on-accent`. The answer's size follows `--al-pro-heronum`.
- A yes-or-no answer with bands (contrast-check's AA and AAA, for example) shows only its words, never 0 or 1. The big answer is
  always the first real number. A sweep of all 168 calcs found no flags left showing a number. Five calcs still show a 0 or 1,
  but each is a real number (a quadratic root of 1, a coin count of 0).
- The game launcher is now a game's home:
  - the name shows once, in the header;
  - Undo and Redo stay hidden until PLAY;
  - under the chips: a Levels card (the app's own, or the kind's usual levels when it names none, handed to the board so the
    level picked is the one played), a Today's game card that also starts play, and Your record (won, win rate, best run).
- `applibkinds` checks all of that at 440 and 390. `applibkinds`, `applib`, `applibplay`, `applibpro` and the brain suite (2,485 of
  2,485) were green before landing.
