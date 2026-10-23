# DESIGN, chunk C1: mock-ups of routes A, B and C on the iPhone 18 Pro Max, for the owner to pick

The owner (one non-technical person, UK) says the current design is "terrible". He will pick ONE route from real
mock-ups before anything is rebuilt. His taste (HANDOFF.md, OWNER-ISSUES.md 1, 15, 16, 18): Iron Man / Jarvis in
character, but sleek, iPhone- and MacBook-like, calm, premium, never "hacker" (no neon walls, no scanlines, no
matrix green). He loves his arc reactor (keep it detailed; make it better, never flatten it). He wants "very very very
good UI/HUD everywhere, every small detail". He said: "something in the middle, but it could look a lot, lot better":
so **route C gets the most work**, A and B are real but lighter.

Phone: iPhone 18 Pro Max, **440 × 956 CSS points**, Dynamic Island (draw a 126 × 37 pt pill at the top centre, 11 pt
down), home indicator (139 × 5 pt, 8 pt up), safe areas top 62 pt / bottom 34 pt, 3× pixels, ProMotion 120 Hz, OLED.
Design in dark mode first (true black is free on OLED), light mode second for A.

## The three routes

- **A: the iPhone look, made miles better.** Apple's own grammar: large titles, grouped inset lists, tinted glass tab
  bar, SF-style type, system colours, hairlines. The reactor is a single tasteful live widget on Home. Nothing HUD.
- **B: something new, different from both.** One strong idea carried through, e.g. an instrument-and-editorial look:
  a deep ink canvas (or warm paper in light), a serif display face for titles with a sans for everything else,
  precise dials and gauges drawn as thin instruments, generous white space, the reactor as a blueprint line drawing.
  It must not read as Jarvis or as iOS.
- **C: the blend, done far better than either (most work here).** Apple-quality calm as the base: a graphite-black
  canvas with one soft radial glow from the reactor, translucent glass cards (20 pt radius, 1 px white-8% hairline,
  soft shadow), SF-style type (large title 34/41 bold −0.4, title 22, body 17, caption 13, tabular numbers for live
  figures), an 8 pt grid, five floating tabs in a glass pill. The Jarvis character comes only from instruments, never
  decoration: the reactor as the hero on Home (layered rings, live arcs for things that are true: free AI left today,
  library size, school stage), thin tick marks on gauges, a monospaced live readout here and there, hairline guides
  that fade, one accent (reactor cyan, used sparingly for live/active) and amber only for warnings. Motion notes: spring
  micro-animations and a breathing reactor at 120 Hz, "reduce motion" honoured.

## Deliverables (the owner will see only pictures)

For EACH route, the same five screens, rendered at 440 × 956 (device scale 2):
1. **Home**: "Good evening, Boss", the reactor, three live tiles (today's agenda, what's near him on the roads, school
   or gym progress), quick actions.
2. **Chat**: a reply card with source chips and a tool-steps line, the composer with mic and CITED.
3. **God's Eye**: a full-bleed globe (a static placeholder image or a CSS sphere is fine) with the THIS SPOT · VIEW glass
   bar and layer chips.
4. **GYM**: game cards with a progress ring and a sparkline, one TRAIN ALL hero button, an honest status line.
5. **Settings (the "Me" sheet)**: grouped lists, the Status card first.
Plus one **design-language card** per route (palette, type scale, the components) and a **contact sheet** per route
(the five screens side by side, labelled, 2× scale). Files: `docs/build-plan/mockups/<route>/<screen>.png`,
`docs/build-plan/mockups/<route>/contact.png`, `docs/build-plan/mockups/<route>/language.png`, and the HTML/CSS that
made them under the same folder. PNGs under 1.5 MB each.

## How

- Static HTML + CSS only (no frameworks). Use the real app's words and screens as the source of truth: read
  `apps/web/src/features/core/index.ts`, `features/eye/index.ts`, `features/gym/index.ts`, `features/settings/index.ts`
  and `apps/web/styles.css` to see what each screen actually holds, then design it; do not invent features.
- Fonts: the iPhone will use the system font (SF Pro) through `-apple-system`; on this Linux machine download **Inter**
  (SIL Open Font Licence) once into `docs/build-plan/mockups/fonts/` as the stand-in and load it with `@font-face`.
  For route B's serif, a free face such as Source Serif 4 or Fraunces (OFL). Note the licences in a README.md there.
- Render with Playwright (Chromium is preinstalled at `/opt/pw-browsers`; at the worktree root run
  `npm install --no-audit --no-fund --no-save playwright@1.56.1` once; never `playwright install`): viewport 440 × 956,
  `deviceScaleFactor: 2`, `colorScheme: 'dark'`. Build the contact sheet as its own HTML page that places the five
  PNGs side by side with labels, and screenshot it.
- Before you finish, critique your own work screen by screen as Apple's design review would ("would Apple ship this?",
  1–10) and fix anything under 9 in route C. Write the scores and what you changed in the report.
- Everything must be honest: every number or word on a screen must be something Ghosty really has.

## Finish

Commit on your worktree branch (do not push, do not merge; commit the PNGs, the HTML and the fonts). Final report:
the file paths of every PNG, your 1–10 scores per screen and route, the three or four design decisions you want the
orchestrator to check, and anything you could not do.
