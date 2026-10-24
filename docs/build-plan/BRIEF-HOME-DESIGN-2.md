# Design a home from plain words, part 2: the SPACE button and the hand-off to the planner and 3-D (OWNER-ISSUES 7)

Part 1 (merged) is `apps/edge/src/tools/homeplan.ts`: `design_home` turns a description into a `Layout` the SPACE
planner imports (`apps/web/src/space/roomjson.ts`) and the 3-D studio draws (`apps/web/src/studio/room.ts`), with a
plain summary and the assumptions. Its reply today tells the owner to save JSON as a file and use SPACE → IMPORT,
because only ~280 characters of a tool result reach the interface. Part 2 makes it one tap. Read BRIEF-W0.md, MAP.md,
BRIEF-HOME-DESIGN.md, `tools/homeplan.ts` (the reply shape), how a tool already hands something to the interface
(`show_link` in `tools/sites.ts` and the `client` events the chat handles in `apps/web/src/features/core/index.ts`
and `assistant/session.ts`; `open_space` in `tools/ui.ts`), `apps/web/src/features/space/index.ts` (the planner tab),
`features/core/ytcard.ts` (a reply card from a tool's text), `apps/edge/src/llm/mock.ts` (scripted phrases for specs).

## Build
1. **The hand-off**: `design_home` also emits the plan as a client event (the way the chat's existing client events
   work; the whole Layout, every storey, never cut), so the interface receives it in full while the chat shows the
   summary. The interface keeps the last plan (`space/plan` state) and the SPACE tab shows it at once when it is open
   or next opened: the rooms drawn, a line "Drawn from your words · 6 rooms · 55.8 m²", the assumptions as a quiet
   list, SEE IN 3-D (the existing export), and for a two-storey home a storey switch.
2. **The reply card** (`features/core/homecard.ts`, like `ytcard.ts`): the chat reply shows "Your plan: 6 rooms,
   55.8 m²" with OPEN IN SPACE and SEE IN 3-D buttons; a storey count when there are two.
3. **SPACE → DESIGN MY HOME**: a card at the top of the SPACE tab (route C, no app-icon tiles): a text area
   "Describe your home in plain words: the rooms, their sizes in feet or metres, what's where…", three example chips
   that fill it (a flat, a 3-bed semi, one L-shaped room), the unit from Settings shown, and DESIGN. DESIGN sends the
   words to the chat as the owner's message (`session.send`, so the brain's own tool runs and the hand-off comes
   back) and switches to the chat while it thinks, or stays on SPACE and shows "Drawing…" until the plan event
   arrives (pick the calmer of the two and say why). Offline: the button says the brain is needed for this.
4. **Honesty**: the plan line always says it was drawn from words with assumptions; the assumptions are one tap away;
   nothing claims building rules are met.

## Tests
`apps/edge/test/homeplan.test.mjs` gains: the tool's result carries the client event with the whole Layout for a
one-storey and a two-storey home (the text stays within budget, the event does not cut). A scripted phrase in
`llm/mock.ts` ("design my home …" → `design_home` with the words) so the browser spec runs without a model. New
`tests/homeplan.spec.mjs` at 440 × 956: SPACE → DESIGN MY HOME, an example chip, DESIGN; the plan arrives; the rooms
drawn and the line shown; the reply card's OPEN IN SPACE; SEE IN 3-D builds the rooms in the studio (reuse the
space spec's studio check); a two-storey description shows the storey switch. Then `npm run check` in apps/web, the
edge tsc, the space and studio specs, and the full edge `npm test` once (about 18 minutes; the machine is shared).
Say the CI-loop line for `homeplan` (protected).

## Finish
Commit on the worktree branch (do not push, do not merge into any other branch), messages ending with the two
attribution lines. Final report: files; how the hand-off works; every check's exact result; screenshots of the SPACE
card, the plan drawn, the reply card and the 3-D; anything not done and why.
