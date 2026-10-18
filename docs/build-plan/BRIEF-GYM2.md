# GYM part 2: twelve more games on the Gym framework

Read BRIEF-W0.md (shared rules) and BRIEF-GYM1.md (the Gym's goals) in this folder first. Part 1 is merged into your
starting point: `apps/web/src/gym/` (core.ts interface, session.ts levels, worker.ts, meta.ts, the ten engines),
`apps/web/src/features/gym/` (the tab), `apps/edge/test/gym.test.mjs`, `tests/gym.spec.mjs`. Read them and follow the
same patterns exactly. Lessons from part 1's review, which apply to every new game:

- Mastery is measured against ground truth the learner never trains on (held-out sets, separate seeds or panels).
- An UNTRAINED learner must sit clearly below the bar at every level, and a Session that only measures must never level
  up. Extend the existing "untrained is below the bar" test to the new games.
- Every level must be reachable by a learner that genuinely improves: a seeded test shows it climbs (at least levels
  1–3 within seconds of test time), and report the levels you saw it pass.
- `check()` reads the final answer robustly (labels like "Answer:", words, symbols); tests include labelled right
  answers and realistic near-miss wrong answers, at levels 1/4/7/10.
- The page imports only light metadata/board helpers; engines and learners live only in the worker bundle (a test
  checks the imports). No measurement or test-set building may stall the worker for more than ~200 ms: pre-compute and
  store sets in a file, or build them in slices.
- Plain words for a non-technical owner; one sentence on what he is learning; honest status.

Your games are listed in your own message. For each: engine (`reset/actions/step/describe`, `generate/check`), a
learner, a ground truth, a 10-level ladder, a card, WATCH, and PLAY HIM where it makes sense (board games: yes).

Tests: extend gym.test.mjs (or add `gym2.test.mjs` imported the same way gym.test.mjs is, via offline.test.mjs: package.json is protected) and gym.spec.mjs
(PLAY HIM for each new board game, nothing sideways at 390 px, WebKit too). Run edge `npm test`, tsc, web `npm run
check`, and the gym, ui, layout, scroll and safari specs on YOUR port. Commit often (a container restart can happen;
uncommitted work survives on disk but commit anyway). Do not push. Final report as in BRIEF-W0.md, including the
mastery table (untrained → reached, per level you ran) and anything still weak.
