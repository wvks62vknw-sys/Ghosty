# GYM part 3: he carries on by himself (AUTO-ADVANCE in WATCH, TRAIN ALL, KEEP AWAKE)

Read BRIEF-W0.md in this folder first (the shared rules; one change: the target phone is now the **iPhone 18 Pro
Max, 440 × 956 points**, not the iPhone 13), then MAP.md's GYM entry (search for "the GYM tab"). Work ONLY in:
`apps/web/src/features/gym/*`, `apps/web/src/gym/session.ts` (and `gym/meta.ts` if you must), `tests/gym.spec.mjs`,
the edge gym tests (`apps/edge/test/gym.test.mjs` or `gym2.test.mjs`, which are run through `offline.test.mjs`),
MAP.md's GYM entry, and `apps/web/styles.css` only inside one clearly marked `/* GYM part 3 */` block. Never touch
protected files (MAP.md, "Protected kernel"). Another builder is working on the Library tab and `library/study.ts`
at the same time: stay out of those files.

The owner, in his words: "when I'm watching Ghosty and a level is completed, it should go on to the next level by
itself so I keep watching. I shouldn't have to do it." He is not technical. Plain words, UPPERCASE button labels,
44 px targets, one main button per screen, nothing sticks out sideways at 440 px, the worker is never blocked, reduced
motion honoured.

## Build

1. **AUTO-ADVANCE in WATCH.** When the learner passes the real mastery bar at a level while WATCH is on, the next level
   is generated and training + watching carry on with no tap. One short toast per level ("Level 4 passed · on to
   level 5"); several level-ups within a few seconds become ONE toast ("Levels 4–6 passed"). Stopping points: level 10
   mastered (toast "Mastered every level", card shows MASTERED), the owner taps STOP or PAUSE, or the tab is hidden
   (today's pause). A small switch CONTINUE BY HIMSELF (default on, remembered in the gym store) in the game view.
   Mastery is still measured against ground truth exactly as today; never advance on self-reported progress.
2. **TRAIN ALL** (one button on the GYM tab): trains every game in turn, least-mastered first, each until mastered or
   until a per-game budget (20 minutes) runs out, then the next; round-robin until every game is mastered or he taps
   STOP. Status line, honest and live: "Training all · Sudoku level 6 · 3 of 22 games mastered · 1 h 12 min". Progress
   is saved as today, and a reload shows where it got to.
3. **KEEP AWAKE** (a switch beside TRAIN ALL): requests a screen wake lock (`navigator.wakeLock.request('screen')`),
   re-requests it on `visibilitychange` when the page is shown again, releases it on STOP. Copy: "Keeps the screen on
   while he trains (plug the phone in)". If the browser has no wake lock, the switch is disabled and says so plainly.
4. **Toast pile-up fix** (a known rough spot from the redesign): level-up toasts coalesce (see 1) during ordinary TRAIN
   too. Never more than one GYM toast on screen.

## Tests (each must FAIL on the old code)

- Edge: the pure decision logic (a `Session` or helper with auto-advance on: pass → the next level starts; a session
  that only measures never levels up; TRAIN ALL's order (least-mastered first) and budgets as a pure function; toast
  coalescing as a pure function).
- Browser (`tests/gym.spec.mjs`, viewport 440 × 956 for the new checks): WATCH + a fast game (tic-tac-toe or maze at
  level 1) reaches level 2 by itself and shows ONE toast; TRAIN ALL starts and the status line names a game; KEEP AWAKE:
  mock `navigator.wakeLock` with `page.addInitScript` and check it is requested, re-requested after a hide/show, and
  released on STOP; nothing sticks out sideways at 440 px.

## How to run things here

- One-time, in your worktree: `cd apps/edge && npm install --no-audit --no-fund` (also builds the interface, ~3 min);
  then at the worktree root `npm install --no-audit --no-fund --no-save playwright@1.56.1` (Chromium is preinstalled;
  never run `playwright install`).
- The brain bundle the preview server needs: in `apps/edge`,
  `npx esbuild src/index.ts --bundle --format=esm --platform=neutral --external:cloudflare:sockets --outfile=test/.build/brain.mjs --log-level=warning`.
- Preview server: from the worktree root `node tests/preview-server.mjs 8801 &` (YOUR port is 8801; kill only your own:
  `ps -eo pid,args | awk '/preview-server.mjs 8801/ && !/awk/ {print $1}' | xargs -r kill`). Specs:
  `BASE=http://localhost:8801 node tests/gym.spec.mjs /tmp/gym3-shots`.
- While working run only the tests you touch. The full `apps/edge` `npm test` takes about 14 minutes on this machine:
  run it ONCE at the end, with `npx tsc --noEmit -p tsconfig.json` in `apps/edge` and `npm run check` in `apps/web`.
  Machine: 4 cores shared with other runs; do not run the whole browser suite.

## Finish

Commit on your worktree branch with clear messages (do not push, do not merge). Update MAP.md's GYM entry for what
you added. Final report: files changed; tests added and proof they fail on the old code; every check you ran and its
exact result; anything not done and why. Be exact; never claim a check you did not run.
