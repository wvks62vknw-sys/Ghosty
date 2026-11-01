# BRIEF-PACKS-1 — the MONEY, BODY and KITCHEN packs (batch ④ part 1, 1 Nov 2026)

Worktree from the branch tip AFTER batch ① is merged (the catalogue `packages/shared/src/catalogue.ts` and its completeness
test exist: every new tool, screen, panel and phrase you add needs its entry, in the owner's voice, or the test fails and
names it). Your preview port: 8822. Read first: ROADMAP.md row ④; OWNER-ISSUES 91 (c), 92 ④, 95, 96; HANDOFF from
"- 1 Nov 01:30" to the next "## "; `apps/edge/src/tools/index.ts` lines 57–130 and 300–340 (how groups are offered);
`apps/edge/test/prompt.test.mjs` (the 5,500-character guard on the plain prompt, every dial); `apps/edge/src/abilities.ts`.
Other builders run in parallel (the chat's cards and shell, the arcade, the offline brain): touch none of `features/core`,
`shell/*`, `features/arcade`, `apps/web/src/arcade`, `offline/*`, `school/*`, `features/settings/offline.ts`.

## The owner's words

"money is good / the body one is good / kitchen is good". From the plan he agreed: money (a budget from statements, price
watching, fuel near his dad), body (reps by camera, a running coach from on-phone GPS, Health export, water, breathing),
kitchen (dinner from a fridge photo, voice timers, a shopping list). Twelve to twenty REAL abilities a pack: quality before
count, each tested, each with its catalogue entry; say the count per pack in the report.

## The one hard constraint: the plain prompt is full

The plain prompt stands at 5,490 of 5,500 characters, and today the prompt names EVERY tool of every group even when the
group is off. A pack cannot add twenty names. So: (1) each pack is ONE tool with an `action` enum (`money`, `body`,
`kitchen`), described in full only when its group's `when` matches ("budget", "spent", "fuel", "petrol", "price" …;
"reps", "run", "water", "breathe", "health" …; "dinner", "fridge", "recipe", "timer", "shopping" …); (2) the off-state line
for a pack names the pack in two words, not its actions — change the off-state listing so a group may declare `short:
'money pack'` and the prompt uses it; (3) if the total still exceeds 5,500 on any dial, TRIM existing prompt lines by
exactly what is needed and no more, and list every trimmed line in the report with before and after; the test at 5,500
stays as it is. The prompt test is the gate: run it after every prompt change.

## What to build (a commit per pack, the prompt plumbing first)

0. The pack plumbing: `short` on ToolGroup, the off-state listing, one test in prompt.test.mjs that a pack group's off-state
   is its short name and its on-state describes the actions.
1. MONEY (`apps/edge/src/tools/money.ts` + phone cards in `apps/web/src/features/money/` if a screen is needed, else cards in
   the existing Agenda/Brief panels): a BUDGET from a statement he pastes or shares (CSV or the text of a PDF; parsed in code,
   categorised by a rule table, never sent anywhere but his own brain; the month's picture as a card with the top five
   categories and what changed); SPENT THIS WEEK from what he tells Ghosty ("spent 12 on lunch") kept in memory; FUEL NEAR
   DAD from the UK fuel-price open data the retailers publish as public JSON (the CMA scheme: Asda, Tesco, Sainsbury's,
   Morrisons, BP, Shell, Esso and the others — fixed list of feed URLs, no key, nearest to a SAVED place only, never live
   GPS), cheapest three with distance; a PRICE WATCH on a page he names (the existing web fetch and the `follow` schedule:
   the number found on the page, told when it drops, with UNDO); SUBSCRIPTIONS he lists with their renewal dates and the
   monthly total; a SPLIT (a bill between names he gives); ROUND UP savings suggestion from the budget; the month's PAYDAY
   line in the Brief when he sets it; a plain WHAT IF ("if I save 50 a week") computed in code; the WARRANTY of a thing he
   bought (date + months → the reminder). Nothing touches a bank; nothing bills; no account linking.
2. BODY (`tools/body.ts` and `apps/web/src/features/body/` for the camera and timers, phone-side): REPS BY CAMERA for
   squats, push-ups and star jumps (a pose model vendored under public/vendor, on-phone only, nothing leaves the phone; a
   count said aloud and a card at the end), a RUNNING COACH (the phone's own GPS while the screen is on, pace and distance
   spoken each kilometre, the run saved as a card; the brain gets the summary only after RUN SAVED, never positions),
   STEPS and SLEEP from an Apple Health export he shares (the XML parsed in code on the phone, a week's card), WATER
   (a tap a glass, a nudge under the cadence of batch ② if merged, else a Brief line), BREATHING (box breathing with the
   screen and haptics), a STRETCH SET with a timer, WEIGHT trend from what he tells Ghosty, a rest-day line, the hourly
   STAND UP under the same cadence. Health facts only from what he gives; no diagnosis ever (the line "not medical advice"
   where a number could be read as one).
3. KITCHEN (`tools/kitchen.ts` and `features/kitchen/` where a screen is needed): DINNER FROM THE FRIDGE (a photo through the
   Lens's ASK with the ingredients listed back and three dishes from a free recipe source with no key — TheMealDB's open
   tier or the owner-brain's own list — each with time and steps), WHAT CAN I MAKE WITH (ingredients typed), a SHOPPING LIST
   (add by voice, tick off, shared as text), VOICE TIMERS ("timer 8 minutes for the pasta", several at once, named, with
   haptics and sound, phone-side), a BARCODE on a packet (the Lens; Open Food Facts, free, no key: name, ingredients,
   allergens; nothing stored unless he asks), PORTIONS and unit CONVERSIONS in code, the week's MEAL PLAN as a card he edits,
   a USE-IT-UP list for things he says are going off, the OVEN line ("fan 180 is 200 conventional"), a LEFTOVERS reminder.

## The lines that hold

Only his own data and public, keyless sources; nothing that bills; no bank or account links; the brain never gets live GPS
(saved places only; the run's positions stay on the phone); health is never diagnosed; photos go only to his own brain
through the existing Lens path; every number computed in code says what it assumed; the plain prompt ≤ 5,500 on every dial;
no test skipped or weakened; the guard job untouched; no model names anywhere; every new thing has its catalogue entry.

## Tests

Node per pack (`apps/edge/test/money.test.mjs` etc.): each action with fixtures (a statement CSV, a fuel feed sample, a
Health export sample, a recipe response), the categoriser's rule table, the fuel distance from a saved place, the prompt
test extended for the three groups' on and off states. Spec `tests/packs.spec.mjs` on your preview: the money card from a
pasted statement, a timer set by text and ringing (clock stub), the shopping list ticked, the breathing screen, the reps
screen with the camera stubbed (a fixture video as the other Lens specs do), nothing sideways at 390 × 844, VoiceOver
labels. The catalogue test green with your entries. CI: add `packs` to the smoke loop's list after `abilities`.

## Working lean (credits are the constraint this week)

Ranged reads (`sed -n`, `grep -n`); test output through `tail -30`; the full brain suite once at the end under `nice -n 10`;
write each new file whole; no narration. Validation: brain typecheck + suite; web typecheck + build; on one fresh preview:
websites, apps, abilities, packs, deck, nav, brief, lens.

## The report (one message)

Base SHA, HEAD SHA, the worktree branch; commits; files; validation numbers; the count per pack and the list of abilities;
every prompt line trimmed (before/after) and the plain prompt's size on the worst dial; LIMITS; DESIGN PICKS THE OWNER MAY
CHANGE; NEEDS HIS PHONE (the camera reps, the run, a statement); WHAT THE MERGE MUST KNOW.
