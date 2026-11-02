# BRIEF-TABS — every feature a tab: a LIFE area, fourteen sheets become screens, hubs that show everything (1 Nov 2026, night)

Worktree from the LOCAL tip of claude/ghosty-ai-training-idwhp9 (never reset to origin or main). Your preview port: 8666.
The owner's words tonight, after a day on the live code with eleven batches in it (OWNER-ISSUES 118, 119): "even with all
this new stuff added I still don't feel like there's more new things cuz they're just so hard to find … if I was to show
someone it'd be so hard to navigate and find every small feature because it's embedded somewhere random you have to go
through 100 hoops for … can't we add tabs for everything we have like all the tabs we already have". That is the brief.

## What exists

- Six AREAS on the dock (shell/areadefs.ts AREAS: ask, see, make, learn, plan, me), each with `tabs: [...]` of screen ids;
  the area's hub (shell/areas.ts hubTab) draws six instrument cards (shell/hubcards.ts CARDS, or the tab's own
  TabDef.status / instrument / readouts) and puts the rest in a More row of small instruments; areaTools() also feeds the
  switcher's arc. Make adds two sheets as tools by hand (convert, docs).
- Screens are TabDefs (shell/tabs.ts; registered in features/index.ts TABS): id, title, icon, scene, blurb, mount(root),
  optional hub-card hooks. The deck (shell/deckcopy.ts DECK_GROUPS, DECK) lists every screen with its words; the catalogue
  (packages/shared/src/catalogue/*.ts) has words for every screen (`screen:<id>`), hub card (`hub:<id>`), panel, phrase;
  apps/edge/test/catalogue.test.mjs holds the registries and the catalogue to each other both ways.
- Fourteen features are SHEETS with no screen of their own, reached only by chat phrases, the ABILITIES catalogue, a deck
  More row or a Shortcut: the nine packs (money, body, kitchen, people, work, creative: apps/web/src/features/<pack>/sheet.ts
  or assistant/packs.ts openers; outside: features/outside/sheet.ts; homeadmin: features/homeadmin/sheet.ts; learning:
  features/learning/sheet.ts), the coach (coach/sheet.ts), his social self (social/: the queue, the feeds, Father and the
  origin), convert (convert/sheet.ts), documents (docs/sheet.ts), the house (house/). Read each sheet's opener and pages first.

## Build

1. A SEVENTH AREA, `life`, on the dock between Plan and Me: title "Life", sub in the voice of the others ("Money, body,
   kitchen, people, work, creative, outside and home: the everyday, kept."), its own icon and tint, tabs
   `['money', 'body', 'kitchen', 'people', 'work', 'creative', 'outside', 'homeadmin']`. The dock must hold seven at 440
   and at 390 (labels stay readable; measure, do not guess) and in TV mode (tv/index.ts has its own nav: check it).
2. FOURTEEN NEW TABS, one per sheet, each a TabDef registered in features/index.ts TABS with: an id (the pack's group name;
   `coach`, `social`, `convert`, `docs`, `house`), a title in caps like the others, an icon, scene 'backdrop', a blurb, a
   mount(root) that draws the sheet's own pages as a page (ui/page with its tag, sub and section pills, exactly the content
   the sheet shows today: reuse the sheet's render functions, do not copy them), `now()`/status/readouts where the pack has a
   reading (bins due, bills due, streaks, the queue's waiting posts, documents kept). The sheets stay: the chat's doors and
   the phrases keep working and open the same content; the tab is the second door. Areas: learning and coach → learn;
   convert, docs, house → make; social → me; the eight life packs → life.
3. HUBS THAT SHOW EVERYTHING: shell/areas.ts draws every tool of the area as a full instrument card (HUB_MAX goes; the More
   row goes), the hub scrolls (the "one screen" rule is retired by the owner's word tonight: findability outranks it; the
   nav spec's "the hub no longer fits one screen" check is replaced by "every tool of the area has a card and the last
   card is reachable by a scroll"). Each new tab needs a CARDS entry (shell/hubcards.ts) with a real instrument and two
   readouts from the feature's own state (nothing invented; "Not yet"/"None yet" where empty), or TabDef hooks.
4. THE DECK: DECK_GROUPS gains a "Life" group and the new screens in their groups; DECK gets each screen's words
   (what it does for him, two example prompts, a did-you-know) in the deck's voice; deck pictures: the deck draws
   miniatures from apps/web/public/deck/<id>.png (tests/deckshots.spec.mjs makes them; ONLY=<ids> for the new ones) —
   make them, at the same size as the rest.
5. THE CATALOGUE: `screen:<id>` and `hub:<id>` words for every new tab (catalogue/tabs.ts, new), rules per catalogue.ts
   wordProblems; GROUP_WHY where a group is new. The jump bar (the palette, commands/builtin.ts `open_tab` and the
   catalogue search) finds each new screen by its plain words.
6. SHORTCUTS and deeplinks (features/settings/deeplinks.ts `open:<screen>`) accept the new ids; the ABILITIES sources
   (abilities/sources.ts) count the new screens and hub cards.

## Tests (extend; never weaken a rule the owner has not changed)

- tests/tabs.spec.mjs (new, in the smoke list after `engines`; BASE defaults to http://localhost:8788; assumes a used
  brain): the dock shows seven areas at 440 and 390; every area's hub lists every tool of its area as a card, the last
  reachable by a scroll; each of the fourteen new tabs opens from its card, from the deck and from the jump bar, shows its
  pages, nothing sideways at 390, every control named (aria-label or text) and 44 pt; the sheet door still works for three
  of them ("when are the bins?" opens the HOME content in the chat; "typing test" the coach's; "convert this" convert's).
- Update, by the new design: tests/hubcards.spec.mjs TOOLS (every area's full list; no slice(0, 6)); tests/nav.spec.mjs
  (the arcs, PLAIN subs, the hub check as above, the seventh area in the dock checks); tests/deck.spec.mjs ALL and groups;
  tests/abilities.spec.mjs counts if pinned; apps/edge/test/catalogue.test.mjs passes as it is (it is the rule).
- Run: both typechecks, the brain's catalogue + abilities tests, the web build, then on one preview (8666) in this order:
  ui, hubcards, nav, deck, abilities, tabs, packs, packs2, packs3, restb, social, reste, restd, arcade. Then the brain
  suite once under nice. At the end, the full smoke list from check.yml's `all=` string on one preview in order (hours; the
  machine otherwise quiet), and fix what it finds at cause.

## The lines that hold

No theme or cinematic change (HELD for the owner); nothing that bills; the plain prompt untouched (telegramVoice exactly
5,500); no test skipped or weakened (a rule the owner changed tonight is restated, with the comment saying so and when);
the guard job untouched; `tabs` added to the smoke list and nothing else in check.yml; no model names anywhere; the
packs' security lines (what jobs may read, what waits for him) unchanged by the move to tabs; the social tab posts nothing
without APPROVE as today.

## Working lean

Ranged reads; commit per step (area, tabs, hubs, deck, catalogue, tests); `tail -30`; no narration.

## The report (one message)

Base SHA, HEAD SHA, worktree branch; commits; files; the dock at 440/390/TV (measured); the fourteen tabs and their
areas; every spec's result with times; LIMITS; DESIGN PICKS THE OWNER MAY CHANGE; NEEDS HIS PHONE; WHAT THE MERGE MUST KNOW.
