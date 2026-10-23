# DESIGN BUILD, part 1: route C in the real app (tokens, components, Home, Chat, God's Eye bar, GYM, Me)

The owner picked route C (23 Oct). The mock-ups are the specification: `docs/build-plan/mockups/c/*.png` (what it
must look like), `docs/build-plan/mockups/c/style.css` (the tokens and component styles to port), `c/build.py` (the
structure of each screen) and `c/language.png` (palette, type scale, components). C2's extras are NOT wanted. The
centrepiece on Home (the reactor) is being chosen separately (BRIEF-DESIGN-HERO.md): keep today's reactor in place,
sized and positioned as C's Home shows, with C's four gauges around it; the new hero drops into
`features/core/reactor.ts` later.

Read BRIEF-W0.md (shared rules; the phone is the iPhone 18 Pro Max, 440 × 956 points, ProMotion 120 Hz, Dynamic
Island), MAP.md's interface map and the calm looks (`data-look`, themes Graphite and Reactor, `shell/*`,
`ui/components.ts`, `features/core/*`, `shell/launcher.ts` and the Me sheet, `features/settings`, `features/system`),
and `tests/nav.mjs`. Keep every theme name and feature name the owner knows (Graphite, Reactor, God's eye, Threats,
Reverse, Workshop, "Boss"); route C becomes what the calm looks render, Graphite the default.

## Build, in this order (commit after each step; each step leaves the app working and the specs green)

0. **Bring the calm looks' tokens back to life.** In `apps/web/styles.css` the header comment "THE CALM LOOKS — Graphite
   and Reactor" (around line 1218, just before `[data-look="pro"] {` with `--sf`, `--sfd`, `--fg`, `--thin`, `--acc` …)
   lost its opening `/* =====` line in commit e1181b8, so the browser parses that prose as a broken selector and DROPS
   the whole token block: no rule defines `--sf`, every `font: … var(--sf)` in the calm looks is ignored, and the owner
   has only ever seen the redesign without its fonts, weights and colours. Restore the opener (one line), then re-run
   every spec in this brief at 390 and 440: things that silently relied on the missing tokens will change (sizes,
   weights, the 44 px targets); fix each one the route C way. Say in your report what visibly changed.

1. **Tokens and components** (`apps/web/styles.css` in one marked `/* route C */ … /* end route C */` layer for the
   calm looks; `apps/web/src/ui/components.ts` for new components): the palette (graphite-black canvas with one soft
   radial glow behind the hero, reactor cyan as the one accent for live/active, amber only for warnings, neutral glass
   for icons and tiles), the type scale (large title 34/41 −0.4, title 22, body 17, caption 13, tabular figures for live
   numbers, small-caps tracked labels), the 8 pt grid, glass cards (20 pt radius, 1 px white-8 % hairline, soft shadow),
   the five floating tabs in a glass pill with the active one lit, dials with tick marks, progress rings and sparklines,
   pills (ONLINE), the reply card and source chips, grouped lists. Spring micro-animations and the breathing hero at
   120 Hz; everything honours `prefers-reduced-motion`; 44 px targets everywhere.
2. **Home** (`features/core/index.ts`): the date line, the greeting, the weather line, the hero with the four gauges
   (free AI left today from the quota engine's status, library size and studied count from the library summary, the
   school stage from `/school` when it exists else that gauge hidden, uplink from the measured round trip), the ONLINE
   pill, the Today card, the Roads near you and Gym tiles, the three quick-action chips, the ask bar with the mic.
   Every value from the app's own state, every state designed (no agenda, no incident, offline, loading).
3. **Chat** (`features/core/*`): the pushed Chat screen (back, title, avatar), day marker, bubbles, the reply card with
   the model line, CITED badge, numbered sources with chips, the claims line, the tool-steps line ("3 steps · Web search,
   weather, 2 pages read"), the rating row and Think harder, the composer with +, CITED toggle and mic.
4. **God's Eye bar** (`features/eye/*`): the search field, layer chips (Aircraft · Incidents · Radar), the readout line,
   the THIS SPOT glass bar (Map, 3D, Street View, Traffic, Go, Road ahead) and the VIEW row (Look, Home, North, Tilt),
   zoom controls. The globe itself is untouched.
5. **GYM** (`features/gym/*`): the LEVELS BY GAME bars card with TRAIN ALL and KEEP AWAKE (already built in part 3:
   restyle only), the Games grid cards with level ring, mastery line, sparkline and the PAUSED / MASTERED pill.
6. **Me sheet, Settings, System, Links** (`shell/launcher.ts`, `features/settings`, `features/system`, `features/links`):
   the sheet header (avatar, name, theme · units), the Status card first with the three dials (free AI today, database
   today, offline brain), the grouped list rows (icon tile, title, one-line blurb, chevron), the build line.
7. **Existing phones get the look once** (chunk A4): devices on a classic look switch to Graphite once, with Settings →
   Look offering the way back; say so in a toast.
8. **WHAT'S NEW** (chunk A0): a short list of this week's merges in `apps/web/src/state/build.ts` (or `whatsnew.ts`),
   shown once per build in Workshop.

## Tests and checks

Specs at 440 × 956 (Chromium; WebKit where installed): `tests/ui.spec.mjs`, `tests/layout.spec.mjs`, `tests/app.spec.mjs`,
`tests/gym.spec.mjs`, `tests/library.spec.mjs`, `tests/map.spec.mjs` (they open screens through `tests/nav.mjs`), plus a
new `tests/routec.spec.mjs`: the Home gauges show real values from the mock brain; the Today card and tiles show the
mock agenda and incident; every tab reaches its screen through the pill; the Me sheet shows Status first; nothing
sticks out sideways; reduce-motion stops the breathing. `npm run check` in `apps/web`; `npx tsc --noEmit -p tsconfig.json`
in `apps/edge` if you touched shared types. Screenshots of every screen after its first pass to
`/tmp/claude-0/-home-user-Ghosty/6a05925c-6839-5546-8e68-c6df376dadfa/scratchpad/design-build-1/` (the owner sees
them); the orchestrator runs an independent critic: iterate until ≥ 9 on every screen.

## Finish

Commit on your worktree branch after each step (do not push, do not merge). Final report: what each screen holds and
where its values come from; the specs and their results; the screenshot paths; what is not done and why.
