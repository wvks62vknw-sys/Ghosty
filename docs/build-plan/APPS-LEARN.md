# THE APPS ROUND · THE LEARN LANE: CHESS (14 November)

My flagship is **Chess**, at Lichess's level. The round's message reached me at 13:46 UTC, so this round had a little over an
hour. I built the first must-have whole: **real puzzles, puzzle rush and the puzzle of the day**. They sit on top of what was
already there: Stockfish on the phone, Glicko-2 ratings and the after-game check.

## What I built
- **Puzzles from Lichess's open database.** In the GYM, open chess. A new **PUZZLES** panel sits under Rated chess.
  - The puzzles are CC0 (public domain) and come through Lichess's public API: no key, no account, and no player is ever looked
    up.
  - **GET PUZZLES · ABOUT 12 KB** fetches a pack of 20, only when you tap. The size is said on the key. On mobile data, or on
    a phone that can't tell which network it is on, the first tap says so and a second tap within 20 seconds is your yes.
  - The pack is kept on this phone, so the puzzles work with no signal.
- **Solving.**
  - **SOLVE** gives the puzzle rated nearest your own. It says whose move it is, the puzzle's rating and its theme, for example
    "mate in 1".
  - Tap a piece, then where it goes. After a right move, the reply is played for you.
  - A different move that mates also counts, as Lichess counts it.
  - A miss says **Not that one**, with **SHOW ME** to play the answer.
- **Your puzzle rating.** It moves after each puzzle, against the puzzle's own rating, and is always said as "about". A puzzle
  solved after a miss counts as a miss. The panel's line shows your rating, how many you've solved and how many are waiting.
- **Puzzle rush.**
  - **PUZZLE RUSH** gives you three minutes and three lives, starting with the easiest puzzle.
  - The clock and hearts show on the panel's line.
  - At the end it says how many you solved, and whether that is a new best. Your best is kept on this phone.
- **Today's puzzle.** **TODAY'S PUZZLE · ABOUT 1 KB** fetches Lichess's puzzle of the day on your tap and sets it up first. If
  you've already done it, it says so.

**In the brain:** `GET /chess/puzzles?n=` (up to 20, one request at a time, as Lichess asks) and `GET /chess/puzzles/daily`,
in `apps/edge/src/chess/puzzles.ts`. The phone can't reach lichess.org (its connect-src), so the brain fetches them.
`agent.ts` gains one route line and its import; the commit says why.

## How to try it on your phone
1. Open the **GYM**, then the **chess** card. Scroll to **PUZZLES**.
2. On Wi-Fi, tap **GET PUZZLES · ABOUT 12 KB**. The line says how many are waiting.
3. Tap **SOLVE** and find the move. Tap **NEXT PUZZLE** for another.
4. Tap **PUZZLE RUSH**: solve as many as you can in three minutes.
5. Tap **TODAY'S PUZZLE** for Lichess's puzzle of the day.

## Checks
- **Brain tests** (`tutor.test.mjs`, "chess puzzles"):
  - Lichess's answer is read into a puzzle;
  - the position is set up from the game's moves, and a move that doesn't fit sets up nothing;
  - right, wrong and another mate are judged;
  - the rating steps;
  - theme names are said plainly.
- **The `learnlane` spec, part CHESS PUZZLES** (278 checks, green):
  - nothing is fetched before the tap, and the key says the size;
  - the pack is kept;
  - SOLVE starts with the puzzle nearest his rating, and the reply is played;
  - after solving, the line reads "Solved. Your puzzle rating is about 15xx.";
  - a miss is said, and SHOW ME plays the answer;
  - a rush is solved and stopped, with the best kept;
  - today's puzzle is set up first.
- **Other specs:**
  - `gym` and `restb` (rated chess): green.
  - `learnpass` and `learn` on the merged tree: green.
- **Full brain suite:** 2,364 of 2,364. **Ratchet, look, knowledge and catalogue:** green. The web and brain typechecks are clean.

## What is left (from `docs/build-plan/apps/learn.md`)
- **Chess:**
  - a full game review with accuracy, best moves, blunder/mistake/inaccuracy marks and retry from a mistake (the after-game
    CHECK already names the big losses);
  - an analysis board with an eval bar and Stockfish's top lines;
  - playing as Black, clocks from bullet to classical, Chess960, and bots with personalities;
  - an openings explorer from public master statistics, and a repertoire trainer with spaced review;
  - lessons and endgame drills;
  - setting up a position from the Lens;
  - PGN import and export, and a library of his games;
  - the puzzle of the day in the Brief;
  - adopting the App Kit (`ui/appkit.ts`). It landed at 14:07, after this panel was built inside the GYM.
- **The rest of section 2:** Courses, Flashcards, Words, the Library and the others, against their leaders.
- **Section 3:** the new apps (Language Path, Dictionary, Maths Solver and the others).
