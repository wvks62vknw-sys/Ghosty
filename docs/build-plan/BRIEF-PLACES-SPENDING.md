# Saved places, and spending sorted (PLAN Wave E and F)

Two small features, the same builder. Read BRIEF-W0.md, MAP.md, `tools/memory.ts` (facts the owner tells him),
`tools/journey.ts` and `tools/maps.ts` (journeys and directions), `features/agenda`, `tools/data.ts`, the library's
document upload (`features/library`, `library/extract.ts`: CSV and PDF text), and `tests/journey.spec.mjs`.

## A. Saved places
"Remember that home is 12 Acacia Avenue, B13", "work is the QE hospital", "take me home", "how long to work?",
"remind me when I'm near Tesco" (no: no location tracking; say so). A `places` memory (`remember_place`,
`places` listed in Memory → ME with EDIT and FORGET, home/work/school/gym/parents' as named places, any address
or postcode geocoded through the existing free geocoder with the result shown for a yes before it is kept), used
by journeys and directions ("take me home" → directions to the saved home), by the Brief (the commute from home to
work, when both are set, as one line with the live traffic), and by God's Eye (a saved place as a pin to fly to).
Honest privacy: places are kept in the brain's memory like other facts, shown in Memory, never sent anywhere else.

## B. Spending sorted into categories, budgets and subscriptions
No bank access, ever: the owner ADDs a statement export (CSV from any UK bank; the common column shapes read:
date, description, amount or debit/credit, balance) through the Library's ADD or a SPENDING card under Agenda (or
Me → Spending: say where and why); rows are categorised by rules first (a built-in list of UK merchants and words →
groceries, eating out, transport, bills, subscriptions, shopping, cash, income; editable: a tap re-files a row and
the rule is remembered) and by the cheap model only for the rest in one call per import; subscriptions found by
repeating amounts to the same name (monthly or yearly) with the yearly total; budgets per category set in plain
words ("£200 a month on eating out") with a bar and "£38 left this month"; the month's view, the year's view, and
"what changed since last month". All on the brain's storage within the free allowance (say the rows kept, capped);
a statement is never shared with any online model except the few rows the rules could not place, and the words say
so before the first import. Export as CSV.

## Tests (each must fail on the old code)
Edge: the CSV shapes (four fixtures from different banks), the rules, the subscription finder (monthly, yearly, price
changes), the budgets' maths, the places geocode-and-confirm flow, "take me home" routing to the saved place.
Specs: `tests/places.spec.mjs` and `tests/spending.spec.mjs` at 440 × 956 with the brain mocked. `npm run check`, the
edge tsc, the full edge `npm test` once, journey and memory specs. Say any protected-file lines (tool-group words).

## Finish
Commit per feature (do not push, do not merge). Report: files; screenshots; the CSV shapes handled; every check's
exact result; anything not done and why.
