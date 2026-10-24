# Design a room or a home from plain words (OWNER-ISSUES 7), part 1: the brain side

The owner: "describe everything in plain words and Ghosty makes a full floor plan, and can turn it into 3D. That
means room sizes in feet, metres or cm (any unit), the furniture, the items, and other rooms (kitchen, bathroom
etc.)." Read BRIEF-W0.md, MAP.md's entries for SPACE (`apps/web/src/space/*`: `plan.ts`, `rooms.ts`, `roomjson.ts`
= the planner's JSON import/export), the shared design contract (`packages/shared/src/design.ts`: `Layout`,
`RoomShape`, `Opening`, `Rect`, `readLayout`, `polyProblem`, `openingProblem`), the 3D STUDIO's room builder
(`apps/web/src/studio/room.ts`: a Layout becomes walls, doors and windows in 3-D), and the existing tools
`design_review` (`tools/design.ts`), `find_furniture` (`tools/home.ts`, UK furniture sizes) and `make_3d`
(`tools/studio.ts`). The interface is being restyled by another builder: NO interface files in this part (the SPACE
tab's DESIGN MY HOME button and the 3-D hand-off come in part 2); the tool's reply must carry everything the planner's
existing JSON import can take, plus a plain-words summary.

Work ONLY in: new `apps/edge/src/tools/homeplan.ts` (registered the way `tools/design.ts` is: say the one line the
protected `tools/index.ts` needs, or add it to `tools/extra.ts` if the budgets allow), `packages/shared/src/design.ts`
(pure additions only), new `apps/edge/test/homeplan.test.mjs` run through an existing test file (say which, or give
the esbuild line), MAP.md. No protected files.

## Build

1. **Reading the words** (`homeplan.ts`, pure first): a parser for sizes in any unit (`12 by 10 feet`, `3.6 m × 4.2 m`,
   `360cm wide`, `10ft 6in`, `about four metres`), room names and kinds (living room, kitchen, bathroom, bedroom 1,
   hallway, en suite…), where rooms sit relative to each other ("the kitchen is off the living room to the right",
   "bathroom next to bedroom 2", "upstairs" → a second storey as another Layout), doors between named rooms and to
   the outside, windows with a wall and a size, ceiling height, and furniture and items with sizes or UK defaults
   (`find_furniture`'s catalogue) and placement words ("sofa against the long wall", "bed under the window").
2. **The plan** (pure): rooms laid out as rectangles (or L-shapes when said) on a grid in cm, placed by the words and
   otherwise packed sensibly (shared walls where rooms are "next to" each other; a hallway joining rooms that only
   connect through it), doors on the shared walls between connected rooms, windows on outside walls, furniture placed
   by the words with the planner's own rules (walkways ≥ 70 cm flagged, nothing through a door swing), every room's
   area in m² and ft². The result is a `Layout` the planner imports as is (`readLayout` accepts it) and the 3-D room
   builder can draw, plus a `summary` in plain words ("Living room 4.2 × 3.6 m with the sofa on the long wall…") and
   a list of what was assumed ("I made the bathroom 2.0 × 1.7 m: you didn't say") and what could not be done.
3. **The tool** `design_home { description, unit?: 'metric' | 'imperial' }` (one call does it all; the model is NOT
   used for the geometry: the parser and the planner are code; the model only answers in words): returns the summary,
   the assumptions, the Layout JSON and the hand-off lines the interface will use in part 2 ("Open SPACE → IMPORT and
   paste this plan" for now, and the JSON itself inline, within the tool's reply budget: cut the JSON's precision, not
   its rooms). When the description is a question about an existing plan, send it to `design_review` instead.
4. **Honesty**: never a guessed size without saying so; never claim planning permission or building rules; measurements
   kept exact in cm internally and shown in the owner's unit.

## Tests (each must fail on the old code)

The size parser on 30 phrases (feet and inches, metres, cm, mixed, approximate, ranges); room and adjacency reading on
8 descriptions (one room; two rooms side by side; a flat with kitchen, living room, bathroom, two bedrooms and a hall;
an upstairs); doors and windows placed on real walls (`openingProblem` null); furniture placed inside its room
(`rectInPoly`), walkways flagged; the Layout round-trips through `readLayout` with nothing dropped; the reply within
budget; the assumptions listed. Then tsc and the full edge `npm test` once (≈ 16 min on this shared machine).

## Finish

Commit on your worktree branch (do not push, do not merge). Final report: what the words can and cannot describe
yet; the registration line; tests and proof; every check's exact result; three example descriptions with their plans.
