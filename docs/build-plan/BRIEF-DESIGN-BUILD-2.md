# DESIGN BUILD, part 2: every other screen in route C, every state, and the polish of part 1

Part 1 (BRIEF-DESIGN-BUILD-1.md, merged) put route C on Home, Chat, the God's Eye bar, GYM and the Me sheet with
Settings, System and Links. Read that brief, the mock-ups (`docs/build-plan/mockups/c/`, especially `language.png`
and `style.css`), part 1's layer in `apps/web/styles.css` (`/* route C */ … /* end route C */`) and its components
(`ui/components.ts`, `ui/statusdials.ts`, `features/core/home.ts`), BRIEF-W0.md (the phone is 440 × 956, 120 Hz),
MAP.md's interface map and `tests/nav.mjs`. The owner's bar: "very very very good UI everywhere, every small detail",
every screen, every state (empty, loading, error, offline), every word. Keep every theme and feature name he knows.

Other builders are editing `features/school/index.ts` (the READING section), `features/core/sitecard.ts`,
`assistant/session.ts` and the brain. So: restyle SCHOOL and the site card through CSS classes only (no edits to
those two files); everything else below is yours. Work in `apps/web/src/features/**` (except `core/sitecard.ts` and
`school/index.ts`), `apps/web/src/shell/*`, `apps/web/src/ui/*`, `apps/web/styles.css` (inside the route C layer or a
new `/* route C part 2 */` block), the specs you touch, MAP.md. No protected files.

## Build (commit after each screen; screenshots at 440 × 956 to
`/tmp/claude-0/-home-user-Ghosty/6a05925c-6839-5546-8e68-c6df376dadfa/scratchpad/design-build-2/`)

1. **Polish of part 1**: GYM's LEVELS BY GAME card with nothing trained shows an honest empty state (faint placeholder
   bars and "No levels yet · TRAIN ALL starts with the maze"), not a blank area; WHAT'S NEW styled as a route C card
   with a GOT IT pill; Settings' profile avatar in the route C style; the Home ask bar's chat icon as a neutral glass
   button. Anything else from part 1's report scored under 9.
2. **Library**: the shelf (rows with kind tile, title, count, chevron), the reader (large title, comfortable 17 pt
   reading, the passage chips), SELF-STUDY (the queue line, progress bar, STUDY ALL switch, the field picker as a
   grouped list, LEARNED TODAY), FRESH TODAY, the import panel (drop zone and fields as route C inputs).
3. **Memory**: TIMELINE (entries as glass rows with source chips, EDIT/FORGET/LOCK as a quiet action row), ME (the
   profile lines with add and ✕), DIARY, PATTERNS, Lessons learned.
4. **Workshop**: changes with their preview links and SHIP IT as the primary pill, VERSIONS, PROJECTS (progress rings
   and step lists), UPGRADE IDEAS (BUILD / DISMISS / THINK NOW), Widgets, the kernel lock, WHAT'S NEW.
5. **Agenda** (inbox and events, the day header, countdowns), **Brief** (the day in one look: sections as cards),
   **Markets**, **Radio** (now playing as a hero card, station list), **Threats** (the feeds and the RECON form and
   report in route C), **Lens** (the mode bar and sheets over the camera: glass, legible, 44 px), **Learn** (courses as
   cards with a course map, lesson reader, quiz, revise), **3D STUDIO**, **SPACE**, **Reverse**, the inner panels of
   System (Keys, AI models, AI room, Offline brain report card and training) and Links (Email, Spotify, Telegram,
   Phone, Live traffic), and **SCHOOL** through CSS (the ladder, stage card, results, official papers).
6. **Every state**: for each screen, the empty, loading, error and offline states designed with one sentence that
   says what to do next; every list has an honest empty state; every long action a progress line; UNDO where
   something changes.
7. **The "Every screen" deck** in route C: a grid of tinted-glass tiles with the names the owner knows, grouped as today.
8. **Motion**: spring micro-animations for pushes and sheets, the breathing hero only on Home, 120 Hz-ready
   (transform and opacity only), everything honouring reduce-motion.

## Tests and checks

The existing specs for each screen you touch (library, memory, agenda, media, intel, westmidlands, lens, learn,
studio, space, projects, upgrades, backup, notifications, telegram, voice, character, selftrain, thinkharder,
websites, school) at 440 × 956 on your port **8810**; `tests/routec.spec.mjs` extended with one check per screen
(opens through `tests/nav.mjs`, nothing sticks out sideways, the empty state shows the sentence); `npm run check` in
`apps/web`. Your own Apple-style score per screen; fix anything under 9.

## Finish

Commit on your worktree branch after each screen (do not push, do not merge). Final report: each screen's score,
what changed, the specs run with their results, the screenshot paths, anything not done and why.
