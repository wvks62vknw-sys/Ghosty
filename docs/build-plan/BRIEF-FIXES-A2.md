# Fixes A2: what the baseline audit and the owner's list found broken (behaviour, not the redesign)

Read BRIEF-W0.md first (shared rules; the target phone is the **iPhone 18 Pro Max, 440 × 956 points**; the specs
still use 390 × 844 until chunk A3 switches them, so make sure nothing breaks at either width). The design language is
being redone separately (the owner picks a route from mock-ups first), so do NOT restyle anything: fix behaviour and
layout bugs only, with the smallest change that is right, in the current look. Work ONLY in:
`apps/web/src/ui/components.ts` (the toast), `apps/web/src/features/system/index.ts`, `apps/web/src/features/eye/index.ts`
(or wherever the God's Eye chip lives; say where), `apps/web/src/shell/*` if a bug is there, `apps/web/styles.css` only
inside one marked `/* fixes A2 */` block, and the specs `tests/ui.spec.mjs`, `tests/layout.spec.mjs`, `tests/notifications.spec.mjs`,
`tests/app.spec.mjs`. Other builders are working in `features/gym`, `gym/`, `features/library`, `library/study.ts`,
`selftrain/*`, `training/kaggle/*` and `docs/build-plan/mockups/*`: stay out of those. No protected files.

## The bugs (each with a test that fails on the old code)

1. **Grouped-list rows cut their value off into nonsense.** On System (phone width) the row values read "Unsupport",
   "Needs 2 key", and the row label "Offline brain report…" is cut too; the Status card's "Self-edit · Off — add a GitHub
   key to turn it on" wraps badly. A value that does not fit must wrap onto its own line under the label (or use a short
   value with the rest as a note), never be cut mid-word. Apply the fix to the shared grouped-list row style so every
   grouped list (Settings, System, Links) benefits. Test: at 390 and 440 widths, no `.pn[data-row]` value's text is
   clipped (compare `scrollWidth` to `clientWidth`, or check the rendered text ends with a whole word).
2. **Toasts pile up and cover the screen.** Two long project notifications ("✦ weekend site … done: All 3 steps are
   done …", about 10 lines each) sat over the GYM cards at once. Rules: at most two toasts on screen (the oldest goes
   when a third arrives); a toast's text is clamped to three lines with an ellipsis; a long one is tappable and opens
   where the full text lives (the notifications list / Workshop history, whichever the app already has: find it); toasts
   never cover the bottom bar or the chat composer; the same message twice within a minute shows once. Keep
   `aria-live`. Test in `tests/notifications.spec.mjs` or `tests/ui.spec.mjs`: fire four long toasts, at most two
   are visible, each ≤ 3 lines tall, the composer stays clickable.
3. **System: the Status card sits after the Brain group.** Put Status (Online / Ghosty connected / self-edit / this
   phone / version) first, then Brain. Test: the first `.pn` on the System page is Status.
4. **The God's Eye chip starts off-screen** (a known rough spot from the redesign round 5: on first open the THIS SPOT ·
   VIEW chip or the mode chip row begins outside the viewport until scrolled). Find it, fix it, and test it: on opening
   the Eye tab at 390 and 440, the chip's bounding box is inside the viewport.
5. While you are in `components.ts`: any other grouped-list or toast behaviour that is plainly wrong at 440 × 956
   (check the ui, layout and app specs' screenshots at both widths), fixed the same minimal way and listed in your report.

## How to run things here

As BRIEF-GYM3.md says (install in `apps/edge`, `playwright@1.56.1` at the worktree root, the brain bundle with
`esbuild`); YOUR preview port is **8804**. Run the four specs above on your port (`BASE=http://localhost:8804 node tests/ui.spec.mjs /tmp/a2-shots`
and so on), `npm run check` in `apps/web`, and `npx tsc --noEmit -p tsconfig.json` in `apps/edge`; the full edge
`npm test` is not needed unless you touched the brain. Never the whole browser suite.

## Finish

Commit on your worktree branch (do not push, do not merge). Final report: each bug with what you changed (file:line),
the test and the proof it fails on the old code, every check run with its exact result, screenshots at 390 and 440
(paths), anything not done and why.
