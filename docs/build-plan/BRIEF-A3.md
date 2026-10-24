# A3: the browser checks run at the owner's screen size (iPhone 18 Pro Max, 440 × 956) in the UK

The owner's phone is an iPhone 18 Pro Max: 440 × 956 CSS points, en-GB, Europe/London. 39 specs in `tests/` still
hardcode the old 390 × 844 phone, and only `tests/agenda.spec.mjs` sets a time zone. Every browser check should see
what he sees. Read BRIEF-W0.md (standing rules), MAP.md's "tests/" rows and `tests/nav.mjs`.

## Build

1. `tests/nav.mjs` exports two shared values: `export const PHONE = { width: 440, height: 956 };` and
   `export const UK = { locale: 'en-GB', timezoneId: 'Europe/London' };` (plus `DESKTOP = { width: 1440, height: 900 }`
   where specs use a desktop size), with a one-line comment each saying why.
2. Every spec's phone context uses them: `viewport: PHONE` (or `{ ...PHONE }`) and `...UK` spread into `newContext`,
   including the specs that already use 440 × 956 and the ones with a `run(name, viewport)` helper. A spec that
   deliberately checks a second size (e.g. 390 to prove narrow phones still fit, or 1440 for desktop) keeps that size
   too: the 18 Pro Max becomes the MAIN size, it does not remove other sizes a spec checks on purpose. Keep the diff
   mechanical: no other changes to the specs.
3. Run EVERY spec in the loop in `.github/workflows/check.yml` (the `for s in ...` line) except `scroll` and `safari`
   (WebKit, absent here), one at a time, against your own preview server: `npm run check` in apps/web first, then from
   the worktree root `node tests/preview-server.mjs 8840 &` and `BASE=http://localhost:8840 node tests/<name>.spec.mjs
   <shots dir>`. The machine is shared (4 cores): never two specs at once.
4. A check that fails at 440 × 956 but passed at 390 × 844 is FIRST a possible real problem at the owner's own screen
   size (something off-screen, cut, overlapping, mis-sized), not a check to loosen. For each: look at the screenshot,
   decide which it is, and (a) if the interface is wrong at 440, fix the interface (CSS or the feature's file; never a
   protected file) with the smallest change and say what was wrong; (b) only if the check itself encoded 390-specific
   geometry (a hardcoded x position, a row count that depends on the height), update the check to the new size with
   the same intent. Report every case either way, with the screenshot path.
5. A date or time shown in a screenshot is now UK-formatted (24/10/2026, 24-hour clock): if a check parsed the US form,
   fix the check.

## Finish

Commit on your worktree branch (do not push, do not merge), each commit message ending with the two lines:
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PxJsFpBagxwsDNyyZqF76o
Final report: the files changed; every spec's exact result; each 440-specific failure and what you did about it (a real
interface fix, or a check updated, with why); anything not done and why.
