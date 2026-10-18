# GYM part 1 — Ghosty's Gym tab and its first ten games

Goal: a new tab, GYM, where Ghosty teaches himself through self-play and reinforcement learning on the phone
(iPhone 13, Safari), in TypeScript. No Python, no new packages, no external scripts. The owner is not technical: each
game is a small app with one big TRAIN button, a live progress graph, a plain status line ("Learning… 4,200 games ·
wins 61% → 88%"), WATCH (see him play), PLAY HIM (you against Ghosty) where it makes sense, and RESET.

Architecture (later parts build on this, so get it right)
- `apps/web/src/gym/`: pure engines, unit-testable in node (edge tests can import web modules the way existing tests
  do, e.g. test/aim.test.mjs or test/design.test.mjs — copy that pattern).
- One interface every game implements: `reset(seed)`, legal actions, `step(action) -> { reward, done }`, and a plain
  text description of a state. Plus `generate(level, seed) -> problem` and `check(problem, answer) -> { correct, score }`
  so a later part can turn every game into checkable reasoning problems for training the language model. Implement both
  for every game here, with tests.
- Learners run in a Web Worker so the screen never freezes. Find how the app already builds and serves worker code
  under its strict CSP (the offline brain and the training runner use workers) and follow that; do not edit protected
  build files. Training pauses when the tab is hidden and saves what was learned plus stats to IndexedDB, so it carries
  on next time. Keep memory and CPU sensible for a phone.
- Levels: each game has a difficulty ladder (Level 1–10). When he passes the mastery bar at a level, the next level is
  generated automatically.
- Mastery is measured against ground truth (a solver, exhaustive search or a fixed benchmark), never self-reported.

Games in this part
1. MAZE: grid with walls, mud and gold; -1 per step, -10 into a wall, mud costs extra, +100 for gold. Tabular
   Q-learning. Show a value heat-map with arrows. Mastery: share of start cells where his greedy route equals the BFS
   shortest path. Levels grow the grid and obstacles.
2. CODE BREAKER (Mastermind): hidden code, feedback "right symbol right place / right symbol wrong place". He learns a
   guessing policy; a minimax solver is the yardstick (state the variant and its known optimum honestly). Mastery:
   average guesses vs the yardstick.
3. COLONY: Energy, Materials, Panels, Day. Actions MINE, BUILD PANEL, REST; panels produce energy; running out of
   energy ends the run. Learner of your choice (Q-learning on a discretised state, or a small policy with evolution).
   Mastery: days survived / final output vs a brute-force or DP optimum on small horizons. Show how his strategy shifts
   (e.g. share of actions by phase of the run).
4. TRUST TOURNAMENT: iterated prisoner's dilemma among a population of strategies (memory-1/2 strategies as genomes)
   evolved over generations, with noise. Show which strategies rise (Tit-for-Tat-like behaviour should emerge); name
   recognisable strategies when they appear. Mastery: score against a fixed panel of classic strategies.
5. TIC-TAC-TOE: self-play (tabular value learning or MCTS + learned values). Mastery: share of all reachable positions
   where his move is game-theoretically optimal (exhaustive minimax as ground truth); 100% is reachable — show it.
6. CONNECT 4: AlphaZero-style is the target but must fit a phone: MCTS guided by a small learned evaluator (tiny network
   in plain TypeScript, or n-tuple network learned by TD), trained by self-play. Mastery: agreement with a perfect
   solver on a fixed set of positions (implement a bounded solver for the test set; it is fine if the test positions
   are mid/late game so the solver is fast).
7. SLIDING TILES (8-puzzle, then 15-puzzle): learned heuristic + search; mastery: solution length vs optimal (A* with
   Manhattan/linear conflict as ground truth on 8-puzzle).
8. SUDOKU and LOGIC GRIDS: generator with unique-solution check; a learner that improves its choice of which deduction
   rule/cell to try (measured by steps/backtracks vs a baseline solver). Mastery: solve rate and steps.
9. COUNTDOWN / 24 GAME: reach a target from numbers with + − × ÷; exhaustive solver as ground truth; learner improves
   search ordering. Mastery: solve rate within a step budget.
10. WORD GUESS (Wordle-style) on a small built-in word list: information-gain yardstick; learned guessing policy;
   mastery: average guesses vs the yardstick.

UI
- GYM tab: a grid of game cards (name, level, mastery %, a sparkline, TRAINING / PAUSED / MASTERED). Tapping a card
  opens the game with TRAIN, WATCH, PLAY HIM, RESET, the graph and one sentence on what he is learning.
- Register the tab like the other tabs (features/index.ts, tab registry, icon, blurb, palette). The whole UI gets a new
  design in a later wave: keep styling to a few classes, match the current look, and respect the iPhone rules from
  Wave 0 (40 px buttons, 16 px inputs, scrolls as one page, works in WebKit).
- A short `gym` line in the brain's prompt is NOT needed in this part. A brain tool `open_gym` (opens the tab on a game)
  is welcome if it is cheap and stays within the prompt budget tests.

Tests
- Edge tests for each engine: rules, generate/check, the ground-truth measures, and that a short training run improves
  the mastery measure (a small, deterministic, seeded run that finishes in seconds).
- A browser spec `tests/gym.spec.mjs` (Chromium; WebKit too if practical): the tab opens, a card opens, TRAIN runs in
  the worker without freezing the page (a timer keeps ticking), progress is saved and survives a reload, PLAY HIM works
  for tic-tac-toe and Connect 4, nothing sticks out sideways at 390 px.
- Run apps/edge `npm test`, `npx tsc --noEmit -p tsconfig.json`, apps/web `npm run check`, and the ui, layout, safari,
  scroll and gym specs on your port.
