# BRIEF: AWARENESS, PR A — every screen says what is open and what is selected; the turn carries it in his message

STATUS item 3 (STARS 153; IDEAS-ROUND-1 item 3; the owner's 5 Nov decision in OWNER-ISSUES 131: "the context line rides in his
message to the brain, never in the system prompt, so the prompt guard is untouched and nothing is trimmed"). Read STANDARD.md
first, then FACTS-AWARENESS.md beside this brief (the code facts this stands on, with file:line), then MAP.md. The mid tier.
Awareness is three PRs: this one (the protocol, the five screens, the brain's side); PR B ONE LENS (STARS 151–152, its own
brief after this lands); PR C HIS VOICE KNOWN (STARS 154–155, its own brief after B). Build only PR A here.

## What is true today (from FACTS-AWARENESS.md; check each before you change it)

- The phone sends a turn as `brain.chat(text, context(), …)` (apps/web/src/assistant/session.ts:789, :934; the second copy of
  `context()` in apps/web/src/vision/ask.ts:42). `context()` is an untyped record: now, tz, tab, name, location, screen (the
  tab's `describe()`, one line), voice.
- The brain's `systemPrompt` (apps/edge/src/prompt.ts:98–118 `contextLines`) ALREADY puts `Open tab:` and `On screen:` (≤400
  chars) INTO THE SYSTEM PROMPT. His rule says that is where it must not be. The user message is assembled in
  apps/edge/src/agent.ts:737 (`withSeen(text, seen, scan)`; agent.ts is PROTECTED: you may not edit it, so the hook is the
  context already passed in; see "The brain's side" below for how to do it without touching agent.ts). The prompt guard is
  apps/edge/test/prompt.test.mjs (5,500 chars on every dial and channel; 14,000 for a coding turn) and never rises.
- `TabInstance.describe?(): string` (apps/web/src/shell/tabs.ts:17–24) is the only publishing today; the deck is an overlay
  with no describe; the car and the shed are panes inside STUDIO whose describe names neither; the room plan's selection is a
  closure variable mirrored into `spaceState.selected`; God's Eye already publishes its selected thing; the reader publishes
  its book and place.
- There is no `Context` or `Show` type in packages/shared. Show today is `ChatEvent {t:'client'; name; args}` with
  `CLIENT_COMMANDS` (packages/shared/src/protocol.ts) and `{t:'cards'}`.

## The shape (PR A)

1. THE PROTOCOL, in packages/shared/src/awareness.ts (new; exported from the package's index the way protocol.ts is):
   - `ScreenContext { screen: string; title: string; line: string; selected?: Selected; at: number }` — `line` is one sentence
     of what is open (≤160 chars, no secrets, never who is in a picture); `Selected { kind: string; id: string; label: string;
     detail?: string }` (kind from a closed list: `item | wall | opening | room | part | fault | group | book | passage | card |
     thing`), `detail` ≤80 chars (a wall's length, a part's state, a page).
   - `contextWords(c: ScreenContext): string` — the ONE LINE that rides in his message, ≤220 chars, deterministic, in Ghosty's
     plain register: `On screen: the room plan, bedroom 3.2 × 4.1 m, 6 items; selected: the north wall (3.2 m).` Nothing
     else goes in it (not the time, not the place: those stay where they are).
   - `Show` — the typed form of what the brain can ask the phone to show: `{ t: 'client'; name: ClientCommand; args }` |
     `{ t: 'cards'; cards: Card[] }` | `{ t: 'stage'; renderer: string; payload: unknown }` (the Stage variant is DEFINED
     here and left for item 5 SHOW ME to implement; say so in its doc comment). `ChatEvent`'s `client` and `cards` members
     become these types (no behaviour change; the phone's `run()` dispatch and the brain's `emit` typed by it).
   - `ClientContext` moves here from apps/edge/src/prompt.ts (the brain imports it from shared; the phone's two `context()`
     become one function returning it, typed, with `screen: ScreenContext` instead of a string).
2. EVERY SCREEN PUBLISHES: `TabInstance` gains `context?(): ScreenContext` (describe stays for anything else that reads it;
   where a screen has both, `line` is its describe). The five the brief names, each publishing its selection:
   - THE ROOM PLAN (features/space): `selected` as it is today (item id, `room:`, `wall:<room>:<edge>`, `op:`) becomes a
     `Selected` with its label and detail (the wall's length, the item's size and wall, the opening's type and width).
   - THE CAR (car pane inside STUDIO): the spec's title, the view, the picked part (`scene.state().picked`) and the lit
     suspects; the fault's symptom when one is open. STUDIO's `context()` composes the car pane's and the build pane's
     contexts with its own (whichever pane is showing is the `line`; the other is not mentioned).
   - THE SHED (DESIGN A BUILD, apps/web/src/build): the kind, its size words, the side (plan/bill/build) and the lit group.
   - THE READER: the book, his place in words, the lit passage while LISTEN reads (`reading.lit`), the open section.
   - THE DECK (the Every-screen overlay): while it is open it publishes on top of the tab underneath (`line` = "the deck of
     every screen, searching for 'x'" / `selected` = the expanded card by id and title); closed, the tab's own context.
   God's Eye and the Lens keep what they publish (the Lens says counts and never who; keep that line of code and its comment).
3. THE TURN CARRIES IT: `context()` on the phone sends `screen: ScreenContext` (and `screenLine: contextWords(...)` for the
   brain to paste). THE BRAIN'S SIDE WITHOUT TOUCHING agent.ts: agent.ts calls `withSeen(text, seen, scan)` (agent.ts:184,
   unprotected helper? CHECK: if `withSeen` lives in agent.ts it is protected; then use the ONE unprotected seam the turn
   already passes through: `systemPrompt(client, …)` in prompt.ts receives `client` and `contextLines` builds the CONTEXT
   block; and the user turn passes through apps/edge/src/llm/content.ts / context.ts (`trimContext`, `compact`, `noteHeard`)
   which are NOT protected: add `withScreen(ctx, client)` in apps/edge/src/context.ts that appends the context line, wrapped
   with `asData("what the phone has on screen", line)`, to the LAST user message of `ctx` right where `noteHeard` already
   edits the previous assistant turn; call it from the same unprotected place `noteHeard` is called. If that call site is in
   agent.ts (protected), STOP and write in your report exactly which one line agent.ts would need, with the diff, and build
   everything else; the orchestrator takes it to the owner (OWNER-ISSUES 131 allows a kernel edit only with his word).
   `Open tab:` and `On screen:` LEAVE the system prompt (prompt.ts `contextLines`): the bytes come back to the guard's
   headroom (measure and print the old and new worst case; the ceilings in prompt.test.mjs do not change; the assertion in
   apps/edge/test/mind.test.mjs:138–149 that pins `On screen:` in the prompt is changed deliberately with a dated comment
   naming this brief). Telegram keeps its one TELEGRAM line. The wrapped line is DATA, so it never steers tool-group
   selection on its own (`ownerWords` strips it): the owner's words do. The history (`addTurn`) stores his words alone, as now.
4. "THAT ONE" RESOLVES: (a) with no model, on the phone, where the act is local: the room plan's own words ("make that wall
   longer", "add a wardrobe there", "a door in that wall") act on `selected` through the plan's existing actions (the wall's
   real-length sheet, add item at the selection, add door/window on the selected wall), via the LOCAL_ASKS table in
   assistant/phrases.ts and a handler in assistant/local.ts, in the same order as today (a table entry without a handler fails
   typecheck); the car's "find me a replacement" with a picked part opens the part's replacement act (car/parts, whatever
   exists today for a part: say what); the Shelf's and the reader's "read that one" on a lit row or passage reads it
   (readingTurn with the selection); the deck's "open that one" opens the expanded card. Each says in one line what it did
   with the selection ("The north wall: 3.2 m, how long?"). (b) with the model: the context line in his message is what the
   model resolves on; the tools it calls take ids (design_changes, home_plan, the car and reader tools as they are): no new
   tool unless a resolution has no tool today; if one is needed it goes in apps/edge/src/tools/extra.ts with ≤220-char about.
5. SEEN ON THE PHONE: the stamp line's LOOKING AT (ui/machine.ts `stampLine().look(thing)`) is fed from the SAME published
   context, so THE LOOK's and the reader's stamp say what awareness says, one source. The deck's Core card line gains
   "Looking at: <line>" under its reply time (the WORKING / DEGRADED mark STANDARD asks for: WORKING when the last turn
   carried a context, "No screen context (screen x publishes none)" otherwise). Every screen that is a tab publishes at least
   `{screen, title, line}` (a generic one from TabDef for the sheet-built screens), so the mark is never red on a tab.

## What must not change

- The prompt guard (5,500 / 14,000) and the CI guard job; check.yml gains the one word `awareness` in the `all=` list after
  `reader` and nothing else. agent.ts, index.ts, tools/{index,types,repo}.ts and the rest of PROTECTED_PATHS untouched (if
  one line is truly needed, the report says which, with the diff, and the build does not include it).
- The boundary: the context line never names a person seen by the Lens (PEOPLE publishes "the Lens on PEOPLE" only), never
  carries a password, key, address of a stranger, or anything from the house's guarded set; nothing leaves the phone that was
  not already in `describe()` plus the selection's label and detail.
- No model name anywhere; no packages; nothing from the network; no new keys; never live GPS in the line (the saved place is
  already in the prompt's Location line and stays there).
- Specs that read `describe()` or the context today keep passing (grep the specs for `describe` and `screen:` first; the
  reader, space, car, studio, deck, lens and eye specs, the brain's prompt/mind/context tests).

## Tests (each fails on the old code; run them against the old code once and say so)

- apps/edge/test/awareness.test.mjs (imported from an existing test file at its end, as prompt.test.mjs imports mind.test.mjs;
  the test list in apps/edge/package.json is protected): `contextWords` for each of the five screens' shapes (length ≤220,
  the selection in it, nothing else in it), the system prompt WITHOUT `On screen:`/`Open tab:` on every dial and channel with
  the worst case printed, the turn's last user message WITH the wrapped line and `ownerWords` stripping it, the Show union
  covering every CLIENT_COMMAND, the Telegram line kept.
- tests/awareness.spec.mjs: on the preview with the scripted brain, open each of the five, select a thing, say the words
  with no model ("make that wall longer" → the wall's length sheet opens for the selected wall; "read that one" → the reader
  reads the lit row; "open that one" on the deck), then one turn to the brain and the request body's `screen` has the
  selection and `screenLine` ≤220; the stamp's LOOKING AT equals the published line; the Core card's "Looking at" mark;
  nothing sideways, every control 44 pt, at 440 and 390; a speed budget: publishing a context costs under 2 ms per change
  (measured in the spec by timing 200 selections), the turn's first words no later than before (talk.spec's number).
- Each existing spec that opens a screen you changed is run (deck, reader, space, car, studio, eye, lens, talk, routec, tabs).

## Validation before the PR (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; results to the scratchpad file as they land)

web typecheck, web build, the brain bundle (the first half of apps/edge package.json's test script before the final
`&& node --import`, with apps/edge/node_modules/.bin on PATH), the brain tests awareness/prompt/mind/context/brain/catalogue,
then the specs awareness, deck, reader, space, car, studio, eye, lens, talk (talk ALONE, never beside another spec), routec,
tabs; look at the screenshots. Never commit apps/edge/package-lock.json.

## The owner's phone check (write it into OWNER-ISSUES with the build record, with context in every line)

(1) open the room plan, tap a wall, say "make that wall longer": the length sheet opens for that wall and the stamp says it;
(2) in the Studio's car, tap a part, say "find me a replacement": the part's replacement comes up, named; (3) in the Shelf,
tap a book row, say "read that one": it reads; (4) open the deck, type a word, say "open that one": the expanded card opens;
(5) ask Ghosty anything with the plan open: the reply knows what is on screen without being told; (6) Settings → Every screen →
the Core card says "Looking at: …" matching the screen; (7) the Lens on PEOPLE: ask "what's on screen?": it says the Lens is on
PEOPLE and never who.

## Size

A day on the mid tier; one PR. Questions for the owner with their context in the question itself, recommendation first.
