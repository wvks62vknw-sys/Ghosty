# The GYM's next level: league play, self-invented puzzles, the search teaches the brain, one dashboard (PLAN ideas 1, 3, 4, 7)

Read BRIEF-W0.md, MAP.md, the GYM (`features/gym`, `apps/web/src/gym/*` learners and games, the checkers n-tuple,
the Go self-play, `tasks.mjs` for the notebook), the training records (`apps/edge/src/selftrain/*`, `factory.ts`), THINK
HARDER (`offline/think.ts`, `offline/harder.ts`), the report card (`features/system/reportcard.ts`, `offline/bench.ts`),
`tests/gym.spec.mjs`, `tests/thinkharder.spec.mjs`, `tests/selftrain.spec.mjs`, `apps/edge/test/selftrain.test.mjs`.
Everything measured; the GYM's checks stay fast (long climbs behind the full-run switch).

## Build
1. **League play against his past selves** (idea 1): every mastered learner version is frozen and kept on the phone
   (small: the weights are small; cap at the last eight per game, say the bytes); the current one plays each past
   self a fixed number of games per level-up; his strength is an Elo-style rating per game kept over time and shown
   on the GYM card and the game's page ("Rating 1,240 · up 35 this week"); a new version replaces the old only if it
   beats the league (rating up), else it is thrown away and said so. Pure rating maths with tests.
2. **He invents his own harder puzzles** (idea 3): for mazes, Sokoban and the logic games with exact checkers, a
   generator that makes puzzles at the edge of what he can do (target: he solves 40–60 % at that setting; measured
   from his last 20 tries) so practice stays where learning is fastest; shown as "level 7½: puzzles he only just
   fails"; the ladder's levels stay as the exam.
3. **The search teaches the brain** (idea 4): when THINK HARDER's search finds the right answer with a checked chain
   of reasoning, the question, the chain and the answer become a `star` training record (the existing kind; the
   factory already checks records) so next week's brain gets there without the search; the same for a GYM puzzle he
   solves: puzzle text, his move list, the checker's verdict → a record. Capped per day; never from an unchecked chain.
4. **One dashboard in the REPORT CARD** (idea 7): a LOOPS card listing every loop (GYM, drills, school practice,
   self-study, the weekly run, the voice) with what it practised this week, what improved (the numbers), what was
   rejected and why, and one-tap ROLLBACK where one exists (the weekly brain). Plain words, the real numbers.

## Tests (each must fail on the old code)
Edge: the rating maths, the league decision, the edge-of-ability generator's target (simulated player), the records
made from a checked chain and a solved puzzle (and none from an unchecked one), the LOOPS card's data. Specs: gym
(league rating shown, a puzzle at level 7½), thinkharder (a solved search leaves a record), the report card's LOOPS
card. `npm run check`, the edge tsc, the full edge `npm test` once. Say any protected-file line.

## Finish
Commit per part (do not push, do not merge). Report: files; the rating after a simulated week; screenshots; every
check's exact result; anything not done and why.
