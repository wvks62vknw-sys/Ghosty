> WITHDRAWN by the owner on 4 Nov (OWNER-ISSUES 130): "get rid of the abilities page for every ability because the way i wanna redesign it you'll be able to navigate and find everything". Not to be built. The redesign (STARS 160) carries the requirement that every ability is reachable and runnable in two taps within the new navigation. Kept for reference only.

# BRIEF: EVERY ABILITY A PAGE — the 147 brain tools, each with a place to tap, split across the six areas

The owner, 2 Nov (after EVERY FEATURE A TAB landed, PR #53): "i want tabs for these 147 abilities too like they should
have a screen too" and then, on where: "with whatever features are left that haven't been given their own tabs etc we
should split them across the current bottom ones we have or create a new one and add them all there", and on how: "i
want it to be like how it already is but just with the things that haven't been added". Decided: split across the six
areas (Ask, See, Make, Learn, Plan, Life); no seventh area (the bar at 390 cannot hold a seventh label, and every tool
already belongs to an area); and THE SAME WAY AS NOW — a full hub card each, like every screen has, not a list of rows. This is the first build after the weekly reset (Friday 7 Nov); the week before it
ran out at 94% on 2 Nov, so nothing of this starts before then.

Read first: docs/build-plan/STANDARD.md (the bar), STARS.md, PLAN-STARS.md, OWNER-ISSUES 92 ① and 121 (his words on
findability), HANDOFF (the TABS entry: how a sheet became a screen), MAP.md. Start from the tip of
`claude/ghosty-ai-training-idwhp9` (`git log -1` first; `git reset --hard <tip>` if the worktree was made from main).

## What exists (do not rebuild it)

- ABILITIES (`apps/web/src/features/abilities/index.ts`, screen:abilities): every single thing he can do, from the
  catalogue joined with the registries the code runs on (`apps/web/src/abilities/registry.ts`); search ("can you…?"),
  the eight CATS as chips, the SCENES as panels, a tap opens a sheet with the explanation, SAY IT LIKE THIS, TRY IT,
  WHAT IT NEEDS, WHERE IT LIVES. It stays as the all-in-one list; the pages below are what its rows open.
- The brain's tools (`apps/edge/src/tools/*.ts`, 56 files, 147 tools; the shape in `apps/edge/src/tools/types.ts`
  `Tool`): `name`, `description`, `parameters` (a JSON schema), `risk` ('confirm' pauses for his approval), `side`
  ('client' tools run on the phone), `pure` (read-only), `run`, `approval` (what exactly he is approving).
- The brain already runs one pure tool with no model in the loop (`agent.ts` `direct(plan)`, direct.ts) and renders a
  tool's result as live cards (`packages/shared/src/cards.ts` `cardsFromTool`); the approval flow (`approval` events,
  `followApproval` in session.ts) and the guarded set (house.ts: locks, the garage door) exist and must be reused as is.
- The hubs: `shell/areas.ts` `areaTools()` feeds the hub cards and the switcher's arc; `shell/hubcards.ts` `CARDS`; a
  hub scrolls and its last card clears the bar (TABS). `ui/sheetpage.ts` draws a sheet's pages as a screen.
- The catalogue (`packages/shared/src/catalogue/*.ts`, `apps/edge/test/catalogue.test.mjs`) holds every registry to the
  catalogue both ways: 147 `tool:` entries, 44 `screen:`, 135 `panel:`, 120 `deck:`, 48 `section:`. A missing entry fails
  CI before any browser test.

## The shape

1. **A page per tool, generated.** One generator (`apps/web/src/abilities/pages.ts`, drawn through `ui/sheetpage.ts` or
   `ui/page.ts` like the fourteen TABS screens) makes a page for every brain tool from its own definition: the title as a
   person says it (`narrate.ts` TOOLS has the working lines; the catalogue has the plain names), what he does in his own
   voice (the description rewritten to him, never the model-facing text verbatim), the inputs as fields from the JSON
   schema (string → a text field; number → a number field with the unit when the schema says it; boolean → a switch;
   enum → chips; array → a list with ADD; required marked; the description of each property as its help line), his
   defaults already filled in where the schema names something he has (a place → Home; a registration → his car; a date
   → today; a language → his), one RUN button, and under it "or just say: …" with one example prompt (the catalogue's
   SAY IT LIKE THIS). A `risk: 'confirm'` tool's RUN opens the same approval card the chat shows, with `approval()`'s
   exact question; a `side: 'client'` tool runs on the phone as it does from the chat.
2. **The result on the page.** RUN calls the brain's new route `POST /api/run/<tool>` with the args (owner-signed like the
   rest of /api; the tool's own guards and approval unchanged; `pure` tools run as `direct()` does, the others through
   `runOne` with the same ToolContext, no model called). The reply carries the tool's text and `cardsFromTool` cards; the
   page shows the cards first, then the text as a person would read it; it also lands in the chat as the same entry a
   chat turn makes (so WHY, "what did you do today" and the day log list it). An error is a sentence on the page with
   TRY AGAIN, never a raw stack.
3. **Where each page lives: a card in its area's hub, like everything else.** Each ability that is not yet reached from a
   screen's card gets its own full hub card (`shell/hubcards.ts` CARDS: kicker, title, an instrument, two readouts, a why
   line — generated: the readouts are honest and generic where nothing better exists, "Last used · 2 days ago" and
   "Needs · a place", the instrument a glyph by what the tool does), in the hub of the catalogue's scene for that tool (a
   tool with none goes to Ask); a tap opens the page. NOT YET ADDED means: a tool whose work a screen already carries (the
   catalogue's `same:` mappings and the deck's acts say which screen runs it — the journey screen carries plan_journey,
   next_departures and transit_now; the Lens carries the three vision tools; the agenda the reminders) gets NO second card:
   its page is reached from that screen and from ABILITIES. The modes that live inside a screen (God's Eye's Machine view,
   the Lens's People, Shapes and Name it) and Morse, still a chat sheet, get a card each that opens their screen in that
   mode. The builder writes the list of what gets a card and what does not into the catalogue, so it is checked, not
   remembered. A hub with thirty cards stays whole: nothing cut short at 390, every card 44 pt tappable, the last card
   clears the bar; the switcher's arc keeps the screens as now and gains a scrolling list for the rest past its tiers
   (measure it at 390 and 440; if an arc of thirty cannot be made right, say so and keep the arc to the screens).
4. **Found by words.** Every page is a catalogue entry (`page:<tool>`), so the jump bar and the Every screen deck find it
   by plain words ("weather" → the weather page, "mot" → the car check); the catalogue test holds every brain tool to a
   page and every page to a tool, so a new ability gets a page by itself or the build fails.
5. **Every state said.** A page with nothing to show says what to fill in first; while running, the narration's line
   for that tool ("checking the weather…"); offline, "This needs my brain, and I can't reach it right now"; refused
   (approval declined, a guarded house action), the refusal in a sentence.

## What must not change

- The security boundary (HANDOFF): the brain never gets live GPS (saved places only); nothing that can bill; no person
  searched or profiled; a guarded action never runs from a page without his confirm, exactly as from the chat; a 'confirm'
  tool's approval text is `approval()`'s, never a summary. The prompt guard (5,500; worst dial telegramVoice exactly
  5,500) is untouched: these pages call no model. The CI guard job is untouched. Never a model name in code, comments,
  tests, docs or PR text.
- The chat's own behaviour: `direct()`, `runOne`, the approval flow and `cardsFromTool` are reused, not copied.
- The existing hub cards, the arc's first tiers and the bar: unchanged in look; the new cards use the same card, not a new one.
- Downloads: a page for a tool that fetches (the arcade's packages, a library import) keeps the Wi-Fi-and-size rule.

## Tests (each fails on the old code)

- `tests/abilitypages.spec.mjs`, joining the smoke list after `talk`: every tool has a page reachable from a hub card (or
  from the screen that carries it) and from ABILITIES (count = the brain's tool list as `/api/status` or the registry gives it); the
  weather page at Home runs and shows the forecast card with no model call (the mock's call count stays); a reminder set
  from its page appears in the Agenda; a `risk: 'confirm'` tool's RUN shows the approval card and runs nothing until
  APPROVE (and nothing on DECLINE); a `side: 'client'` tool runs on the phone; a page's fields match its schema
  (required marked, enums as chips, his defaults filled); offline, the page says so; nothing in any page sticks out
  sideways at 390 and 440; every control has a name; the jump bar finds three pages by plain words.
- `apps/edge/test/catalogue.test.mjs` grows the `page:` kind both ways; `apps/edge/test/run-route.test.mjs`: the route
  refuses without the owner's key, runs a pure tool, pauses a 'confirm' tool for approval, never calls a model.
- The talk, tabs, hubcards, nav, deck and abilities specs still pass (the hubs grew a section; the deck gains nothing
  but entries).

## Validation before the PR

Both typechecks; the brain suite; the catalogue test; the new spec and the six above on one preview in CI's order
(`.github/workflows/check.yml` `all=`); the web build; a model-name scan of the diff. The PR body says what was measured.

## The owner's phone check (write it into OWNER-ISSUES with the build record)

(1) Plan hub, scroll: a card for the weather, the roads, the earthquakes… like the others; tap Weather: Home is already
filled, RUN shows the forecast card; (2) See hub → the car check's card: his registration already filled; (3) Make
hub → the house's lock from its page: the confirm card, nothing happens on DECLINE; (4) the jump bar: "weather" opens the
page; (5) ABILITIES → any row opens its page; (6) Wi-Fi off: a page says it needs the brain.

## Size

One the strong tier builder, about four to six hours (the generator and the route are the work; the rest is wiring and the spec),
then review and one checks run. Not before Friday's reset.
