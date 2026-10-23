# One look: route C becomes the only design; themes are colour variants of it

The owner (OWNER-ISSUES 28): "I want the new look to be the only look, with just different themes like colours."
Do this AFTER route C part 2 (every screen) has merged. Read BRIEF-DESIGN-BUILD-1.md and -2.md, the route C layer in
`apps/web/styles.css`, `apps/web/src/state/theme.ts` and `state/app.ts` (looks and themes today), `state/lookonce.ts`
(the one-time switch, now moot), `tests/nav.mjs` (its classic-look branches), MAP.md's interface map. Keep the theme
names the owner knows (Graphite, Reactor) as the first two colour variants.

## Build

1. **Remove the classic looks**: the `data-look` switch collapses to the one design (no `pro` branch: it is the only
   one); the classic looks' CSS (everything that only applied without `[data-look="pro"]`) is deleted; the route C
   layer's `[data-look="pro"]` prefixes go; `lookonce.ts` goes (every phone is on the one look); Settings → Look
   becomes Settings → Theme. `tests/nav.mjs` loses its classic branches; every spec still passes.
2. **Themes as colour variants** (`state/theme.ts`, the tokens): a theme is the accent and a few derived tokens on top
   of the one design: Reactor cyan (default), Graphite (cooler, quieter accent), and the ones the owner picked from the
   brainstorm (OWNER-ISSUES 28); a theme never changes layout, type or spacing. Mind's constellation and pulses take
   the accent (`features/core/mind.ts` reads the token). Settings → Theme shows live swatches and applies at once.
3. **Optional extras only if the owner picked them** (OWNER-ISSUES 28): the warm-paper daytime theme with sunrise /
   sunset switching (Europe/London; manual override), backdrops (hex grid / stars / plain), the sound set per theme
   through the existing sound hooks, the living accent (time of day / weather) as a switch, default off.
4. **Every screen still ≥ 9**: the critic pass after the removal (nothing lost its styling), screenshots at 440 × 956.

## Tests

Every browser spec in `.github/workflows/check.yml`'s loop still passes (run them all once, on your port, batched);
`tests/routec.spec.mjs` checks each theme applies its accent and that no element still carries a classic-look class;
`npm run check`. Report the stylesheet's size before and after (lines and bytes).

## Finish

Commit on your worktree branch per step (do not push, do not merge). Final report: what was removed, the themes and
their tokens, the specs run with results, screenshots, the before/after size, anything not done and why.
