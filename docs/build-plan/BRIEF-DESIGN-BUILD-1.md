# DESIGN BUILD, part 1: the C2 look in the real app (tokens, components, the reactor, Home, the systems ring, boot-up, listening)

The owner picked route C and approved C2 ("Tony Stark navigating Ghosty"). The mock-ups are the specification:
`docs/build-plan/mockups/c2/*.png` (what it must look like), `docs/build-plan/mockups/c2/c2.css` and
`docs/build-plan/mockups/c/style.css` (the tokens and component styles to port), `docs/build-plan/mockups/c2/build.py`
and `c/build.py` (the structure of each screen), `docs/build-plan/mockups/c2/language.png` (palette, type scale,
components, motion and sound rules, parallax). Read BRIEF-W0.md (shared rules; the phone is the iPhone 18 Pro Max,
440 × 956 points, ProMotion 120 Hz, Dynamic Island), MAP.md's interface map, "new tab" and the calm looks (`data-look`,
themes Graphite and Reactor, `shell/*`, `ui/components.ts`, `features/core/*`, `features/core/reactor.ts`, `shell/launcher.ts`,
`features/system/index.ts` the Me sheet), and `tests/nav.mjs`. Keep every theme name and feature name the owner knows
(Graphite, Reactor, God's eye, Threats, Reverse, Workshop, "Boss"); the C2 look becomes what the calm looks render.

## Build, in this order (commit after each step; each step leaves the app working and the specs green)

1. **Tokens and components** (`apps/web/styles.css` in one marked `/* C2 */ … /* end C2 */` layer for the calm looks;
   `apps/web/src/ui/components.ts` for new components): the palette (true black canvas, reactor cyan as the one accent,
   amber only for warnings, the grey scale), the type scale (large title 34/41 −0.4, title 22, body 17, caption 13,
   `ui-monospace` readouts with tabular figures, small-caps tracked labels), the 8 pt grid, holographic glass panels
   (hairline that brightens at the corners, soft inner glow, corner brackets as an opt-in class), the far hexagonal grid
   at 3–4 % that drifts with scroll, dials with turning tick rings, segmented arc gauges, the Jarvis line, holographic
   buttons (APPROVE / NOT NOW), the pill status chip (ONLINE / LISTENING). Every component honours
   `prefers-reduced-motion` (no turning, no breathing, plain fades) and the 44 px target rule.
2. **The reactor** (`features/core/reactor.ts`): keep every detail it has and add the slowly turning tick ring, the four
   gauges around it with real values (free AI left today from the quota engine's status, library size and studied count
   from the library summary, the school stage from `/school` once it exists, otherwise hide that gauge; uplink from the
   measured round trip to the brain), the breathing idle state, the brighter open core and waveform ring while
   listening (`assistant/voice.ts` state), the pulse while studying or training. Tap the reactor → the systems ring.
3. **Home** (`features/core/index.ts`): the greeting, the Jarvis line from real state (the next agenda item, the nearest
   road incident when there is one, else what he is doing: "Studying algebra: 212 of 480"), the Today card, Roads near
   you (with TRACKING brackets when an incident is live) and Gym tiles, the three quick actions, the ask bar with the
   mic. Nothing invented: every value from the app's own state, and every state designed (no agenda, no incident,
   offline, loading).
4. **The systems ring** (`shell/launcher.ts` or a new `shell/ring.ts`): replaces the "Every screen" deck in the calm
   looks: "Where to, Boss?", the reactor at the centre, the six areas on the inner ring, every tab on the outer ring (the
   same names, icons and order as `features/index.ts` and `shell/areas.ts`), tap to go, × to close, reduce-motion safe.
   `tests/nav.mjs` `openDeck` must still open every screen (update it to the ring).
5. **Boot-up and listening**: a one-second boot sequence on a cold open (reactor spins up, rings draw in, "Systems
   online · all good" with the real checklist: brain connected, free AI left, offline brain, library, school when it
   exists, uplink), skipped on reduce motion and on warm opens; the listening state wired to the real mic flow.
6. **Parallax**: layers shift gently with `DeviceMotion` on the phone (iOS needs a permission tap: ask once from a
   natural place, remember the answer, never nag), off under reduce motion, and never on desktop.
7. **Existing phones get the look once** (chunk A4): devices still on a classic look are switched to the calm default
   once, with Settings → Look offering the way back; say what you did in a toast.
8. **WHAT'S NEW** (chunk A0): a small card in Workshop reading `docs/build-plan/UPGRADES.md`'s newest lines is NOT
   possible (the file is not served): instead a short list in `apps/web/src/state/build.ts` or a `whatsnew.ts` with the
   headlines of this week's merges, shown once per build in Workshop.

## Tests and checks

Specs at 440 × 956 (Chromium; WebKit where installed): `tests/ui.spec.mjs`, `tests/layout.spec.mjs`, `tests/app.spec.mjs`,
`tests/safari.spec.mjs`/`scroll.spec.mjs` if WebKit is present, `tests/gym.spec.mjs` and `tests/library.spec.mjs` (they
open screens through `tests/nav.mjs`), plus a new `tests/stark.spec.mjs`: the Jarvis line shows the next agenda item;
the reactor's gauges show real values; tapping the reactor opens the ring with every tab and tapping a ring item opens
that tab; the boot-up appears once and not on reduce motion; the listening state shows while the mock mic runs;
nothing sticks out sideways. `npm run check` in `apps/web`; `npx tsc --noEmit -p tsconfig.json` in `apps/edge` if you
touched shared types. Screenshots of every screen after its first pass to
`/tmp/claude-0/-home-user-Ghosty/6a05925c-6839-5546-8e68-c6df376dadfa/scratchpad/design-build-1/` (the owner sees
them); then an independent critic's score (the orchestrator runs it): iterate until ≥ 9 on every screen.

## Finish

Commit on your worktree branch after each step (do not push, do not merge). Final report: what each screen holds
and where its values come from; the specs and their results; the screenshot paths; what is not done and why.
