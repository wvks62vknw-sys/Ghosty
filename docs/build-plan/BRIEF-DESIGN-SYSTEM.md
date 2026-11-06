# BRIEF: THE DESIGN SYSTEM from his pick, W1 THE SCAN, with the ten themes as its token sets (STATUS item 1b and 1c)

His pick (6 Nov, OWNER-ISSUES 139): "i like 1 tbh, but i don't like how dark it looks but maybe it just looks like that rn … do 1
but still i feel like we're missing couple crucial 'the machine' feeling benchmarks but apart from that it's good, remember we
want it to be very easily navigated and i don't want nothing clunky or hard to read etc or just like things in places where
you'll never find them". The reference (137): "iron man jarvis vibes but more like person of interest 'The Machine' vibes …
make it actually feel like that … modern and clean not like AI slop". The bar: STANDARD.md. The floor: this file (133).

Read first, in this order: STANDARD.md; OWNER-ISSUES 136–139; STARS 160 and 164; docs/build-plan/mockups/directions-2/w1/
(README.md, tokens.css, style.css, room.js, the PNGs: this is the world you are turning into a system) and
directions-2/lib/ (the shared Mind-as-eye and the Machine's marks stylesheet); BRIEF-THEMES.md (the ten themes, exactly as
listed); apps/web/src/state/theme.ts (what a theme is today and how the 3-D engine takes the accent); apps/web/styles.css lines
1–20, 1140–1160, 2295–2320 (today's tokens and their aliases: --c, --cr, --ink*, --hair*, --rc*, --sf, --sfd, --t1..--t5);
apps/web/src/ui/components.ts (today's components); apps/web/src/features/eye/machine.ts and its CSS (the Machine view the
language grows from); apps/web/src/features/settings/index.ts (Settings → Theme today); the catalogue test
(apps/edge/test/catalogue.test.mjs: a new screen or section needs its entry); MAP.md's "Interface map" rows for settings, ui
and styles.css. Start from the tip of `claude/new-session-4erjve` (`git log -1` first; reset your worktree to it); branch
`builder/design-system`. Symlink the three node_modules from the main checkout (apps/edge, apps/web, the root) rather than
installing; the preview brain is `node tests/preview-server.mjs <port>` over `apps/edge/test/.build/brain.mjs` (built by the
first half of apps/edge's test script with `apps/edge/node_modules/.bin` on PATH); specs take `BASE=http://localhost:<port>`;
use a port of your own (8795).

## What this PR is, and is not

It is the foundation every screen from here is built on: the tokens, the type, the grid, the motion, the Machine's marks as
components, Mind as the Machine's eye, the ten themes, one screen that shows all of it, and a test that holds it. It is NOT the
shell (the bar, the hubs, the deck, Home's room, the Stage: STATUS item 4) and it does not restyle the existing screens: they
keep today's look until their passes migrate them (the queue's rule: nothing user-facing is built in the old look after day
one, and no screen is built twice). The first real screen in the system is the reader (item 2), right after this.

## Deliver

1. **`apps/web/src/design/tokens.css`** (imported first by styles.css): W1's tokens grown into the whole system, every token with
   its one-line job. NOT AS DARK: the canvas is not true black — a graphite with the scan's light in it (around #0b0d10 to
   #111419, your eye decides) and the plates a step up from it, so the room reads lit rather than night; prove it by re-rendering
   W1's Home and Learn mocks with the new values (a PNG each in the PR, beside the old, so he can see the lift). Colour: canvas,
   plate, plate-strong; bone ink at four strengths; line and line-faint; the accent block (the ONLY block a theme swaps);
   amber, red, ok for meaning only. Type: the phone's own faces (SF Pro for words, SF Mono / Menlo for the Machine's tags and
   readings, New York for the reader's text) with the stand-ins the web has; a scale with size, line height, weight and tracking,
   numerals tabular; a READABILITY FLOOR held by the test — body 17 pt, a reading 15, a tag or caption 13, nothing below 12,
   contrast of every ink on every surface at least 4.5:1 and every line at least 3:1 in every theme. The 8-point grid, the
   gutter, the safe areas, radii (the Machine draws square: 2 pt on keys, 0 on reticles; the orb is the only circle), elevation
   (a plate over the scan, a brought-forward page), motion (three durations, two curves, named, Reduce Motion honoured), icon
   size and stroke, the 44 pt target. Today's aliases (--c, --cr, --ink, --hair, --rc*, --t1..--t5, --sf, --sfd and the rest)
   keep their current VALUES in this PR (they are redefined onto the new tokens by the shell pass), so no existing screen changes.
2. **The Machine's marks as components** (`apps/web/src/ui/machine.ts`, with their CSS in the system's own section of
   styles.css, all values from tokens, no raw colour): the reticle (one hairline box with corner marks, the accent when
   attended), the tag (mono caps above a thing), the truth line (one mono line below it), the plate, the key (a square button,
   44 pt), the stamp line (the Machine's point of view at the top of a screen: date · time · place · what it is watching and
   looking at, from real state: the clock, his saved home or the last place, the count of feeds watched, the thing in focus), the
   line of sight (a thin line drawn from the orb to the attended thing), the typed-out line (text that arrives as the brain writes
   it, with a block cursor, for the narration and the status line), and the moment of recognition (the box snapping onto a thing
   with one short tone from the sound set, honouring his sound setting). These are THE MACHINE FEELING BENCHMARKS he says are
   missing; each is shown on the system screen with its name and the rule for when it is used. If you see a hallmark of that
   reference the list lacks, add it and say so.
3. **Mind as the Machine's eye**: the orb redrawn as the mock draws it (a sphere of points with the constellation inside, no
   glow halo, its core the accent, breathing when listening), as the one shared shader the current orb already is
   (apps/web/src/engine and the hero): if it fits this PR's day it goes live on Home now (the first thing he sees of the pick), and
   the hero, the switcher and the boot take it; if it does not fit, it lives on the system screen only and the PR says so, and it
   goes live with the shell. Reduce Motion: still, not breathing.
4. **The ten themes** of BRIEF-THEMES as accent blocks (`:root[data-theme="ember"]` and so on) in tokens.css, each exactly the
   values listed there, with the `text` variant where the accent fails as text; theme.ts reads them so the 3-D engine and the orb
   recolour too; Settings → Theme shows all twelve as live swatches with their tag lines, applies at once with the toast, keeps
   the pick, and the boot plays in the picked colour; a `theme:<key>` catalogue entry each; the deck's Settings card names the
   count. The contrast numbers per theme are printed by the test and held.
5. **One screen: Settings → THE LOOK** (`screen:look`, sections TOKENS · TYPE · MARKS · MIND · THEMES, each a catalogue entry):
   every token with its name, value and job; the type scale set in its own sizes; the marks live (a reticle you can tap to attend,
   a typed-out line typing, the recognition tone on a key); the eye breathing; the themes as swatches. Two taps from Settings.
   The top line in his voice ("This is how I draw everything from here. Tap a mark to see it work."). States: Reduce Motion on
   (said), sound off (said).
6. **Tests, each failing on the old code**: `apps/edge/test/look.test.mjs` (reads tokens.css: every required token present and
   commented; each theme block swaps only the accent set and has every accent token; the readability floor and the contrast
   numbers per theme; the type scale on the 4-point line grid; machine.ts and the system's CSS section use no raw colour) and
   `tests/look.spec.mjs` joining the smoke list after `settings` (THE LOOK opens in two taps; every section; the twelve swatches
   apply and the pick survives a reload; the boot colour; the recognition tone fires once; nothing sideways at 390 and 440; every
   control named; the SPEED BUDGET of STANDARD's two habits: the screen opens under 300 ms on the preview, measured and held).
   The settings, routec, hero and boot specs still pass.

## Rules

The boundary and the prompt guard untouched; the CI guard untouched; no packages; no model names anywhere; nothing paid. No
existing screen changes its look in this PR except Settings → Theme (its swatches) and, if it fits, the orb. Every state said in a
sentence; every control named; 44 pt everywhere; both widths. The brief is the floor (133): a better thing inside this scope
is done and said in the report; anything that changes what he said (the orb stays, ten themes, W1) is a question in the report.

## Validation before the report

Both typechecks; the brain suite; the catalogue test; the new spec and settings, routec, hero, boot on one preview in CI's order
(never talk or voice alongside); the web build; a model-name scan of the diff. The report: the checklist line by line, the
measured numbers (contrast per theme, the open time), the two brightness PNGs, what you did beyond the brief, questions, and the
owner's five-minute phone check as numbered steps.

## Size

The top tier, effort max, about a day (6–8 h). Report when done; do not open a PR (the orchestrator merges and opens it).
