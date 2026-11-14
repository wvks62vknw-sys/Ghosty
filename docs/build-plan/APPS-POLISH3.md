# THE APPS ROUND: SYSTEM AND SETTINGS (14 November 2026), the lane's report

Branch `claude/new-session-4erjve-lane-polish3`, merged into `claude/new-session-4erjve-apps`. Specs: `arcadeapp` and
`clockcalc`, their words at the end of check.yml's `all=`. arcade.spec gained the MOVE THE BUTTONS checks.

## What I built

### The flagship: THE ARCADE, console-class
Everything below is kept on the phone and never sent anywhere. Games are still fetched only on his tap, on Wi-Fi, with the
size said. Only free, openly licensed games are on the shelf, each with its licence and credit.

- **A page for every game.** Tap a game's title on the shelf, in MY GAMES, in THE FREE LEVELS or in CONTINUE PLAYING. The
  page shows:
  - its one key: GET with the size, or PLAY;
  - **screenshots** taken as he plays (the latest four kept for each game, a blank frame never kept);
  - **how to play** by touch, by controller and by keyboard;
  - **his record:** sittings, time played, first and last played, and his best;
  - **its five trophies,** each with how far along he is;
  - **save slots** (below);
  - its **licence and credit**, and that GET waits for Wi-Fi;
  - ASK GHOSTY, which asks the chat for three tips on that game;
  - FORGET MY RECORD, asked first. His best score stays.
- **CONTINUE PLAYING** opens the Arcade: the games he played lately, newest first, each with when he last played, his
  sittings and his time. The arrow opens the game's page. CONTINUE starts the game:
  - DOOM and Quake go straight into the game he saved last (their own -loadgame and +load);
  - the other games load their own save as they always do.
- **THE TROPHY ROOM:**
  - five trophies for every game played, including the games he makes: First go, Settling in (10 minutes), Devoted (an hour),
    Regular (five sittings) and On the board (a best of his own);
  - five for the whole Arcade: Explorer (5 games), Collector (10), Marathon (5 hours), Maker (a game he made) and Seven days;
  - a sitting that earns one says so on the game's card ("Trophy: First go").
- **Named save slots.** On a game's page, KEEP A SLOT saves the game's current save under a name ("My castle"). LOAD puts it
  back, first keeping what was there as "Before loading", so a LOAD can be undone. DELETE asks first. This works for any engine
  that saves.
- **Keyboard play:** DOOM and Quake play with a hardware keyboard:
  - W A S D or the arrows to walk, ← and → to turn;
  - Space, F or Ctrl fires · E or Enter uses · Q and R change weapon;
  - Shift runs · Tab or M shows the map · C jumps · Esc opens the game's menu.

  The games made here and the DOS classics already read keys themselves.
- **Controllers:** they already worked; each game's page now shows the mapping.
- **MOVE THE BUTTONS:** in PAUSE, drag the big buttons to where his thumb rests and change their size (80 to 140%). The layout
  is kept for each kind of game; RESET puts them back.
- **GYRO AIM:** in DOOM and Quake, turning the phone turns the view. It is off until he turns it on in PAUSE, and an iPhone asks
  first. The gain and direction are a first estimate, to tune on his phone.
- **Search the shelf:** by a game's name or line, as he types. When nothing matches it says so, with CLEAR SEARCH.
- **By words:** "show my trophies" and "continue my game" open the Arcade there, with the count or what he played last.
- **The Arcade's card on Learn** now names the last game he actually played, from the record of play.

### New apps on the App Kit
Both are built on CONSISTENCY's App Kit: its header, one scroll area, notices under the header, keys at the bottom, undo and
redo, Recently deleted, search, share as CSV or JSON, and a first run with sample data and a three-step tour.

- **THE CLOCK:**
  - the time here, big, with the date;
  - **World clocks:** seventy cities kept in the app, so it works with no signal. Each shows its time and how it stands to here
    ("Today, 5 h 30 min ahead"), summer time included. Add one by typing its name; ✕ deletes it, with Undo;
  - **Stopwatch:** start, lap, stop and reset. It keeps running while the clock is shut;
  - **Settings** (the App Kit's sheet): SHOW SECONDS on the big clock, the exports and Recently deleted;
  - **Timers:** 1, 5, 10 and 25 minutes, and 1 hour. They are the kitchen's own timers: they ring while Ghosty is open, even with the clock shut.
- **THE CALCULATOR:**
  - a keypad of 44 pt keys, and a hardware keyboard;
  - sums worked out on the phone, with no request: + − × ÷, brackets, powers and a shop's percent (64.80 + 15% = 74.52);
  - plain words when a sum can't be done ("You can't divide by nothing.");
  - COPY puts the answer on the phone's clipboard;
  - **the tape:** every answer, newest first. Tap one to use it again; search it; delete with Undo; share it as a spreadsheet file.
- **Front doors:**
  - System → CLOCK AND CALCULATOR;
  - in the chat: "open the clock", "world clock", "stopwatch" and "calculator".

  "Set a timer for 5 minutes" still sets the kitchen timer straight away.

## How to try it on your phone
1. **Arcade:** play the runner for a few seconds and quit. Its card says "Trophy: First go", and CONTINUE PLAYING is at the top.
2. **A game's page:** tap a game's title. Look at the screenshots, how to play, your record and the trophies.
3. **Save slots:** play THE BLOCK WORLD, quit (it saves), open its page, name a slot and tap KEEP A SLOT.
4. **Your own layout:** in a DOS game or DOOM, PAUSE → MOVE THE BUTTONS. Drag FIRE, tap SIZE, then DONE.
5. **Clock and Calculator:** System → CLOCK AND CALCULATOR, or say "stopwatch" or "calculator".

## Checks
- **Brain tests:**
  - arcade.test covers the trophies, the keyboard layer, play time, the save slots, gyro aim, the layout and CONTINUE's save;
  - offline2.test covers the calculator's sums and the clock's zones and words.
- **Full brain suite:** 2,484 of 2,484 on the merged tree (d274f0e47).
- **arcadeapp.spec:** at 440 × 956 and 390 × 844, in all seven looks and at BODY 21. It checks:
  - a fresh phone: nothing played, nothing fetched by looking, and the shelf's search;
  - a phone that has played: CONTINUE PLAYING, THE TROPHY ROOM, a game's page, FORGET MY RECORD;
  - "show my trophies" in the chat, and ASK GHOSTY on a game's page;
  - the runner played for real, leaving its record, CONTINUE PLAYING and a first trophy;
  - save slots: keep, load (with "Before loading") and delete;
  - CONTINUE for Freedoom carrying DOOM's -loadgame for the slot saved last.
- **clockcalc.spec:** at 440 and 390, then in all seven looks and at BODY 21. It checks:
  - both front doors and the chat's words;
  - world clocks: add, delete and Undo, and SHOW SECONDS;
  - the stopwatch (start, lap, stop, reset) and a timer;
  - the calculator's keys, keyboard, tape, percent, the division by nothing and COPY.
- **arcade.spec:** MOVE THE BUTTONS drags and sizes a button, keeps the layout, and RESET clears it.
- **Specs that read the Arcade, System or the chat's words,** re-run green on the merged tree: arcade, games5, games6,
  gamestudio, deck, systemnext, appkit, tabs, tabs2, hubcards, learnpass, learnlane, awareness, polish3, homepass, grownhud,
  orbithud, restc and nav.
- **Fixed along the way:**
  - the Clock's timer list rebuilt its keys four times a second, so CANCEL could be swapped out from under a finger; each row
    is now kept;
  - System's new line said two sentences (polish3.spec); it says one.

**For the whole branch:**
- **styles.css:** a stray merge-marker clean-up had removed the opening line of the app library importer's comment, which
  failed the knowledge self-check for every lane. I put that one line back (b8d385f63).
- **Typecheck:** packages/shared/src/applib/catalogue/learn.ts (APPLIB CAT-C) fails the typecheck on the integration branch,
  lines 42, 44 and 66. It is that lane's file, so I left it, and told the orchestrator at 15:17.

## What is left
- **The Arcade, not built:**
  - a Home summary card for the Arcade (the App Kit's `homeCard` is ready for it);
  - the Arcade itself moved onto the App Kit's frame. Its shelf is the older page, and moving it means moving several lanes'
    specs.
- **Screenshots of WebGL games** (Quake) are taken inside a frame, and are only kept when the picture is not blank. On some
  phones Quake's picture may still come back empty, and then none is kept.
- **Gyro aim's direction and gain** are a first estimate and need tuning on his phone.
- **CONTINUE into DOOM's or Quake's last save** is checked as far as the words given to the engine. A real save loading needs
  the game data, which CI does not fetch.
- **Alarms in the Clock:** a web app cannot ring a locked phone at a set time on its own, so there are no alarms, and timers
  ring only while Ghosty is open. Ringing from the lock screen would need the brain's reminders, a change on the brain as well.
- **Existing apps against the leaders** (Block World, Kart, Platformer and the rest): not reached this round beyond what the game
  pages, trophies and save slots give every game.
