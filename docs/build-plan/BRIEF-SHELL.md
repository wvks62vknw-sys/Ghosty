# BRIEF: THE SHELL — every feature findable, then the shell in the system, then every room

STATUS section 4 item 4 (STARS 160, 161, 163; PLAN-STARS 3b); the owner's words and decisions in OWNER-ISSUES 119, 121, 130,
131, 139, 142, 143, 147, 149, 150 (c) and (d). Read STANDARD.md first, then FACTS-SHELL.md beside this brief (the code facts
with file:line: 46 tabs, 7 hubs with 38 cards, a deck of 37 cards in five groups, 5,900 lines of old-look CSS with 506 hard-coded
colours, eight specs that pin the shell's structure by number, no test of the finding rule, no favourites, Home with no stamp
line, 38 screens with no sentence of their own, and an Abilities page that 143 says is not the way in), then MAP.md.

THE SHELL IS THREE PASSES, each its own PR and its own perfected thing (the queue's rule), in this order:

- PASS 1, THE FINDING RULE AND THE SHELL'S TRUTH (the mid tier, this launch): no visual redesign; the rule as a test; favourites;
  Home's stamp line; every screen's own sentence; the Abilities page withdrawn as a way in; one source for the stamp's facts.
- PASS 2, THE SHELL IN THE SYSTEM (the top tier: the one place the top tier is spent from here): mocks first on the real tokens
  (Home by the hour, the bar, one hub, the deck, the switcher and the jump bar, in W1 THE SCAN at 440 and 390, one sheet to the
  owner before code, as the boot's storyboard was), then the bar, the hubs, the deck, Home, the switcher and the jump bar
  redrawn in the tokens and the Machine's marks, Home following the hour (161), Paper and the worlds reaching Home, the hubs
  and the deck (147), the eight pinned specs RE-CUT IN PLACE, NOTHING LOOSENED.
- PASS 3 AND AFTER, EVERY ROOM (the mid tier, one hub's screens per PR): the 37 feature screens re-expressed in the system, a
  ratchet test on the old look (the count of hex colours, rgba calls and px radii outside THE SYSTEM section of styles.css only
  ever goes down; each PR writes the new number), until the old look is gone and Paper reaches every room.

## PASS 1 — what is fixed

1. THE FINDING RULE, HELD BY A TEST (143: "recents and favourites in two taps, everything else in three taps or one typed word,
   every screen reachable from a visible list, held by a test"). apps/edge/test/finding.test.mjs (imported from the end of
   catalogue.test.mjs, which already parses features/index.ts, shell/areadefs.ts and hubcards.ts CARDS): for EVERY `screen:`
   in the catalogue, the shortest path from Home by taps on visible things (an area button, a hub card, a Me sheet row, a row
   or pill inside a screen for the `inside` two, `cardTo`) is at most three taps and is printed; every screen is on a visible
   list (a hub, the Me sheet, or inside a screen that is); every screen is one typed word in the jump bar (the `tab_<id>`
   command's words from deckcopy); recents and favourites are two taps (the jump bar's recents and FAVOURITES rows: tap the
   search, tap the row). The test prints the table (screen → taps → path) and fails on any screen over the rule. A browser
   spec part (in tests/tabs.spec.mjs, re-pointed not loosened) walks a sample of eight screens from Home by real taps and
   counts them.
2. FAVOURITES (STARS 163): a long-press on a jump-bar recent, on a hub card or on a deck card pins it (the Machine's `key`
   "PIN" / "UNPIN" on the long-press sheet, 44 pt); FAVOURITES is the first row of the jump bar (above RECENTS, up to 6, his
   order, drag to reorder not required); kept in `ghosty.settings` (so the backup carries it) and said in the catalogue; the
   deck remembers where he was (163's last clause) by opening on the group he left.
3. HOME'S STAMP LINE (149): at the top of Home, the stamp line in the Machine's marks from `stampLine`/`stampWords` with the
   day, the time, his saved place, WATCHING n FEEDS and LOOKING AT HOME (from shell/awareness.ts `lookingAt`, PR A), the same
   component the reader and THE LOOK use; ONE SOURCE for the feeds' count (today written three ways: the look, the boot, the
   reader: one function in shell/awareness.ts or ui/machine.ts that all four read); the boot's own stamp hands over to Home's
   at the landing (the line stays rather than leaving: re-cut the boot spec's "the stamp leaves with the layer" assertion to
   "the stamp becomes Home's", never loosened; the 2,880 ms cut unchanged).
4. EVERY SCREEN'S OWN SENTENCE (150 d): the 38 screens that fall back to their name and old description get a `context()` of
   their own in Ghosty's voice: what is open and, where the screen has a selection, what is picked (the agenda's day or item,
   the markets' watched thing, the memory's entry, the radio's station, the links' page, the workshop's project, the gym's
   session, the school's lesson, the arcade's game, the threats' alert, the brief's section, Settings' section, the house's
   room, the body/money/kitchen/people/homeadmin/learning/outside/work/creative sheets' open item). ≤160 characters, no
   secret, no person seen by a camera, no plate, no key (the awareness test's rules).
5. THE ABILITIES PAGE WITHDRAWN AS A WAY IN (130, 143): the Abilities tab leaves the bar, the hubs, the deck and the catalogue's
   `screen:abilities`; "can you …?" by words, WHY and the offers in context STAY (they answer a question); the ABILITIES
   catalogue and GET /api/abilities stay for the brain and the tests; tests/abilities.spec.mjs re-pointed to the words path
   and the catalogue, never loosened (what it proved about the words, it still proves); the abilities tab's own code kept only
   where something else uses it (say what; delete what nothing uses).
6. NOTHING ELSE MOVES: the bar stays six areas and Me, the hubs and the deck keep their cards and groups (pass 2's call), the
   old look stays; the eight pinned specs pass unchanged except where 3 and 5 re-cut one assertion each (named in the report).

## What must not change (every pass)

The prompt guard and the CI guard job; check.yml gains at most one word per pass (`finding` after `awareness`) only if a
check truly has no home; agent.ts and every protected file untouched; no packages, nothing from the network, no new keys,
never a model name, never live GPS; the boundary; no test skipped or weakened; the finding rule itself (143) and Mind the
orb in the middle (131's clarification) are the owner's and not the shell's to change.

## Tests (each fails on the old code; run against the old code once and say so)

apps/edge/test/finding.test.mjs as in 1 (on the old code: no favourites row, so recents-and-favourites fails; the Abilities
screen listed); tests/tabs.spec.mjs's sample walk and the FAVOURITES row; tests/awareness.spec.mjs's five screens plus eight
of the 38 with their new sentences; tests/boot.spec.mjs's stamp hand-over; tests/routec.spec.mjs's Home stamp line present
with LOOKING AT HOME; tests/abilities.spec.mjs re-pointed.

## Validation before the PR (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; results to the scratchpad file; your own
bundle script in the scratchpad under your own name)

web typecheck and build, the brain bundle, the brain tests catalogue (finding inside it), awareness, abilities, look; then the
specs tabs, nav, hubcards, deck, routec, layout, hero, boot, awareness, abilities, settings, and talk ALONE last; look at the
screenshots.

## The owner's phone check (write it into OWNER-ISSUES with the build record, with context in every line)

(1) Home shows the stamp line at the top (the day, the time, your place, WATCHING n FEEDS, LOOKING AT HOME) and the boot's
line becomes it at the landing; (2) tap the search, long-press a recent: PIN; it sits in FAVOURITES at the top; two taps from
Home reach it; (3) the Abilities page is gone from See's hub and the deck; "can you read a barcode?" still answers;
(4) Every screen: the deck opens on the group you left; (5) ask "what's on screen?" on the Agenda, the Markets and a Life
sheet: each says its own sentence; (6) Settings → Every screen → the Core card's "Looking at" matches; (7) nothing looks
different otherwise (pass 1 is not the redesign).

## Size

Pass 1 a day on the mid tier; pass 2 two to three days on the top tier with its mocks first; pass 3 a day per hub on the mid
tier. Questions for the owner with their context in the question itself, recommendation first.
