# BRIEF-PACKS-3 — the outside, home and learning packs on the set pattern (batch ④ part 3, 1 Nov 2026)

Worktree from the LOCAL tip of claude/ghosty-ai-training-idwhp9 (at or after the commit that adds this brief; never reset to
FETCH_HEAD or origin, only to the local branch). Your preview port: 8700. Read first: BRIEF-PACKS-1 (the pattern, in full)
and BRIEF-PACKS-2 (the second three on the pattern), OWNER-ISSUES 92 ④ and 105 (the plumbing as built), ROADMAP row ④ ("out
and about (which carriage, parking, a route that avoids the dodgy bit at night), home admin (bills by photo, warranties and
manuals, family cars' renewals, bin days, planning applications near home). Learning skills (an instrument heard by the
mic, languages, drawing, typing) joins here"), 99 (the catalogue rules). The code of the pattern: `packages/shared/src/
packs.ts` (PACKS, six names), `apps/edge/src/packs/index.ts` (PACK_ACTIONS, the Brief lines), `apps/edge/src/tools/people.ts`
+ `features/people/sheet.ts` + `catalogue/packs2.ts` as the worked example of one pack end to end, `apps/edge/src/tools/
index.ts` (the groups with `short`), `apps/edge/src/prompt.ts` (the off-state line per pack and the trims' comments), `apps/
edge/test/prompt.test.mjs` (the gate: ≥ 12 actions a pack, every action named in the about line, the packs list), the
catalogue test. What already exists and must be REUSED, never rebuilt: `apps/edge/src/tools/travel.ts` (OSRM routes),
`guardian.ts` (street crime near his places from data.police.uk, flood and weather warnings), `places.ts` (his saved places),
`cars.ts` + the car batch (`apps/web/src/car/`, the MOT and tax dates DVSA/DVLA give; the speak job's MOT-month line),
`walk.ts` (WALK ME HOME), the Overpass host already allowed in `apps/edge/src/index.ts`, `apps/edge/src/photo.ts` and the
money pack's statement reading (a photo → text → facts), `features/learn/` (the LEARN tab: courses with a mastery ring; your
languages, drawing and typing become its kind of thing or sit beside it, never a second tutor), the instrument coach being
built in parallel under `coach/` (your learning pack points at it by name, builds nothing of its own for instruments).
Other builders run in parallel: touch nothing under `coach/`, `demo/`, `build/`, `house/`, `lens/`, `hands/`, `tv/`,
`arcade/`, `social/`, `wiki/`, `morse/`. Yours: `apps/edge/src/tools/{outside,home,learning}.ts`, `packages/shared/src/
{outside,home,learning}.ts`, `apps/web/src/features/{outside,homeadmin,learning}/sheet.ts` (the directory for the home pack
is `homeadmin` because `features/home*` names are taken), `packages/shared/src/catalogue/packs3.ts` (joined where packs2
is), your lines in the files the pattern touches (packs.ts, packs/index.ts, tools/index.ts, prompt.ts, llm/mock.ts,
abilities.ts, protocol.ts, cards.ts, assistant/{phrases,local,packs}.ts, commands/builtin.ts, api/brain.ts), `apps/edge/
test/{outside,home,learning}.test.mjs`, `tests/packs3.spec.mjs`, the smoke loop's list (`packs3` after `packs2`), `apps/
edge/package.json`'s test list (after `creative.test.mjs`), a CSS block at the END of styles.css.

## The three packs (twelve to twenty real abilities each; the names in the prompt are "outside pack", "home pack", "learning pack")

OUTSIDE (out and about). Real things for a day out in the West Midlands and anywhere: WHICH CARRIAGE (his own notes first:
"at New Street the front carriages are nearest the exit I use" — he tells it once, it answers every time; where National
Rail's open data gives a formation length it is said as a length, nothing invented), PARKING (free and cheap car parks near
a place from Overpass — amenity=parking with fee and capacity tags where present — and his saved notes, with the honest
line that prices and rules are the sign's, not ours), A SAFER WALK AT NIGHT (the OSRM walking route scored against
data.police.uk street crime of the last three months near the path; the route re-asked with the dodgy stretch avoided
where OSRM's alternatives allow; said as "fewer reports", never "safe"), LAST TRAIN/BUS HOME (the transit tools), WHAT'S
OPEN NOW NEAR ME (Overpass opening_hours parsed in code), TOILETS NEAR ME (Overpass), CASH MACHINE / FREE WATER REFILL (Overpass:
amenity=atm, amenity=drinking_water), A RAIN PLAN (the weather already in the shared mind: "take a coat" with the hour),
SPLIT THE FARE (a plain split with who owes whom), MEET HALFWAY (a midpoint by travel time between two saved places),
PACK MY BAG (a list by the day's plan and the weather), WHERE DID I PARK (he says "I parked here" → the saved place with the
time; "where's the car?" answers; the street's restrictions as a note he adds), I'M LOST (the nearest saved place and the
way, the nearest station), QUEUE OR GO (a gentle estimate from his own past notes only). Where OSRM or Overpass is down, the
plain "I can't reach the map right now" and nothing made up. Reads allowed for scheduled jobs: the rain plan, last train,
what's open; writes (notes, where I parked) wait for him.

HOME (home admin). BILLS BY PHOTO (a photo of a bill → supplier, amount, due date, period, kept as a bill; the next due dates
in the Brief; "how much was the gas this year?"), WARRANTIES (a receipt or a product photo → the item, the date, the
warranty length from his words or a plain default of 12 months said as a default, a reminder a month before it ends),
MANUALS (a model number from a photo or his words → the maker's own manual page found with a citation when he asks, saved
as a link; never a scraped PDF), FAMILY CARS' RENEWALS (the plates he has given the car batch → MOT due, tax due, and
insurance renewal dates he tells it once; reminders at a month and a week; all from the car batch's facts, nothing
re-fetched), BIN DAYS (he tells it once — "bins are Tuesday, recycling every other Tuesday" — or pastes his council's page;
the night-before line in the Brief; the pattern handles alternating weeks and bank-holiday shifts he tells it), PLANNING
APPLICATIONS NEAR HOME (planning.data.gov.uk's open API where it covers his area, else his council's own portal link said
plainly; new applications within a radius he sets, told once each), METER READINGS (a photo of the meter → the reading, kept
with the date, usage between readings), THE RENTAL OR MORTGAGE DATE (one line he gives; the reminder), SUBSCRIPTIONS (what
repeats on his statements, from the money pack's facts; "what am I paying for monthly?"), HOME INVENTORY (a photo per room →
items he confirms, for insurance; export as CSV), THE ADDRESS BOOK OF THE HOUSE (the plumber, the landlord, the council's
number — his entries), WHO'S ON THE ELECTORAL ROLL and the council tax band from the public GOV.UK band lookup (the band is
public; nothing about people), SMOKE ALARM / BOILER SERVICE dates (his entries, yearly reminders). Reads allowed for jobs:
the due lines, bin night, renewals; writes wait for him.

LEARNING (learning skills). Beside the LEARN tab's courses, the practical skills: LANGUAGES (a daily ten words in the
language he picks with the phone's own voice saying them, a spaced-repetition deck kept on the brain, a conversation turn
in the language with his reply corrected gently, a phrase for the situation he names; the eight languages the phone's
voices cover, said), DRAWING (a daily prompt — the creative pack's prompt is a word; yours is a lesson: a shape, a step, a
thing to copy, drawn by code as a guide on a canvas he draws over with his finger; his drawing compared to the guide by
simple overlap and said kindly), TYPING (a typing test in the chat's own box: words a minute and accuracy on a passage from
his own library's text, a daily line, the streak), HANDWRITING (a photo of his handwriting → the phone's OCR reads it back;
legibility as the share it could read), READ FASTER (a passage shown word by word at a speed he sets; comprehension by three
questions the brain writes), MEMORY (a number, a list, a face-name drill with names he gives), MENTAL MATHS (a daily
five-minute drill by level), SPELLING (the words he gets wrong in his own messages, kept and drilled), AN INSTRUMENT (points
at the coach by name: "the instrument coach hears you play — it's in MAKE"), FIRST AID (the NHS's own steps as a drill, with
the honest line "call 999 for a real one"), A SKILL PLAN (any skill he names → a four-week plan of ten minutes a day, the
daily line in the Brief), HOW AM I DOING (every skill's streak and best on one sheet). Reads allowed for jobs: the daily lines;
writes wait for him.

## The prompt

The plain prompt is at exactly 5,500 on its worst dial (telegramVoice). Three packs add three off-state lines ("outside
pack", "home pack", "learning pack" with their line breaks). Find trims of EXACTLY that many characters elsewhere in the
prompt, one meaning kept per trim, listed in the comment above the template the way the earlier trims are, and checked by
the prompt test; never raise the guard; never cut a rule's meaning. The packs list in the prompt test gains your three.

## The lines that hold

Only his own data and public sources; nothing about any person (planning applications are about places; the electoral roll
line is about HIS registration only; the council tax band is the property's public band); nothing bills (planning.data.gov.uk,
data.police.uk, Overpass and OSRM are free; Overpass and OSRM are shared public servers: one request per ask, cached for the
day, and the plain line when they refuse); the brain never gets live GPS (saved places only; "I parked here" saves the place
he names or the phone's one-time location with his tap); every estimate said as one; no test skipped or weakened; the guard
job untouched; no model names anywhere; every action has its `act:<pack>:<action>` catalogue entry and every sheet, panel and
phrase its entry.

## Tests

One node test file a pack (each action's shape and the honest lines; the safer-walk scorer on a fixture of crime points and
a route; the bin pattern with alternating weeks; the bill reader on a fixture photo's text; the spaced-repetition schedule;
the typing scorer). `tests/packs3.spec.mjs` on your preview at 440 × 956 plus the 390 × 844 sweep of every sheet (nothing
sideways, every control named for VoiceOver): one flow per pack through the chat and the sheet.

## Working lean

Ranged reads; `tail -30`; the brain suite once at the end under `nice -n 10`; no narration. Validation: brain typecheck +
suite; web typecheck + build; on one fresh preview: websites, apps, abilities, packs, packs2, packs3, deck, brief.

## The report (one message)

Base SHA, HEAD SHA, the worktree branch; commits; files; the count per pack and which actions jobs may read; the prompt's
four dials and every trim; validation numbers; LIMITS; DESIGN PICKS THE OWNER MAY CHANGE; NEEDS HIS PHONE OR HIS WORDS;
WHAT THE MERGE MUST KNOW.
