# The Iron Man look, built (24 Oct, after the owner's "yeah i like this")

The pick: **A (Reactor HUD) with C's restraint** — the rings, the live readouts, the globe and viewfinder instruments,
the thin scan line and MIND's language carried into every card; no corner brackets on every card, no grid backdrop,
labels 11 px or more, calm spacing. If the owner names a letter, that wins. Mock-ups: `mockups/iron/{a,c}/`
(`build.mjs` there holds the hand-drawn SVG instruments and `tokens.css` the tokens: port, do not redraw).

His bar (OWNER-ISSUES 41, 43): "a massive iron man feel to it whilst being sleek and clean", "super powerful", "it
shouldn't feel like it's made by an AI … like i've made every single part of it". So: bespoke details, his own words
and data everywhere (his name, his city, his places, his school stage, his rating), no generic copy, no placeholder
patterns, every readout a real number Ghosty knows (honest), 120 Hz motion that is felt not noticed, 44 pt targets.

## The shared work (any pick needs it) — one builder, in this order, a commit each
1. `apps/web/src/ui/instruments.ts`: the instrument drawings from the mock-ups as `h()`-built SVG (the globe with live
   counts, the Lens viewfinder at rest, the rating ring, course segments, the School ring, the small MIND sphere, the
   mastery meter), each taking real state and drawing nothing it does not know.
2. Hub cards on every tab wired to real state: `shell/areas.ts` and `TabDef` in `shell/tabs.ts` gain an `instrument`
   and `readouts` per tool (about 20 tools), the wide card for two-tool hubs (See), the live dot and status words
   (LIVE, READY, TRAINING, OFF) from the same state the deck's `now()` lines use. Tappable as a whole, not app icons.
3. `features/gym/art.ts`: all 22 game pictures as holographic line-art (6 are drawn in the mock-up: finish the set in
   the same hand), the card's mastery meter with the pass-mark tick, rating and next level as readouts.
4. The reply card: the who-line with Ghosty's glyph, the claims readout ("3 of 3 claims found in the sources") from
   `cited.ts`'s real check, the sources and actions, in `features/core/index.ts`.
5. The floating tab bar: the lit tab, the live dot wired (GYM training, a run, a download), the badge, the touch state.
6. The A-with-C styling in `styles.css` (about 150–230 lines, inside the route C layer; Graphite gets the same shapes
   in its own colours).
7. `tests/hubcards.spec.mjs` at 440 × 956: every tab's hub shows its instruments with real numbers, nothing under the
   bar, every card 44 pt, no app icons (a check that fails on the old code), plus the existing routec, ui, layout, gym
   and deck specs clean.

## Rules
BRIEF-W0.md; route C's structure stays (five floating tabs, large titles, one back, one chat entry); themes are colours;
no new packages; no protected files; SVG by hand; `h()` + `textContent`; honest readouts only; `prefers-reduced-motion`
respected; nothing heavier than a few KB per instrument; the deck pick (OWNER-ISSUES 34) untouched.

## Finish
Commit per step (no push, no merge). Report: before/after screenshots at 440 × 956 of every tab's hub, the GYM, a
reply; every check's exact result; what is still a sample rather than a real number, and why.
