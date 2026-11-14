# THE NEXT ROUND: MONEY AND PEOPLE (14 November)

Branch `claude/new-session-4erjve-money-next`, merged into `claude/new-session-4erjve-next`. Nobody was watching to answer questions,
so each decision is written down here with its reason.

This round the money lane led **Money and papers handled for you**: your statements, bills, receipts, warranties and household papers
now meet as one money picture, with one honest number at the top. Everything is plain sums from your own records. Nothing forecasts,
nothing reaches a bank, nothing pays or sends, and no new key was needed.

## What I made

### MONEY (Life → MONEY), six pills
- **Safe to spend until payday** stands at the top of **Month**. Tell it your payday ("the 28th", "the last Friday") and it shows what
  is safe to spend until then: the newest balance your statement printed (or, with no balance, what came in less what went out since
  your last payday), less every bill and subscription still due before payday, less what your savings goals need set aside. It shows
  what that is a day, lists every payment still due, and says how it was worked out. If your newest statement line is a few days old it
  says so, because anything you paid since is not in the number.
- **Your sorting rules** (a key on Month): every rule like "every TESCO is groceries", with how many payments it files. Change where
  one goes, or take it away.
- **Split a payment**: tap a payment on Month and split it across two categories to the penny (a supermarket shop that was half
  household). If you add the same statement again it is not counted twice, and you can put it back whole.
- **Budgets** now holds **Savings goals**: "Holiday, £800, by June" with its bar, what it needs a month, money put in or taken out.
  What you put in is your word: nothing moves in your bank.
- **Bills** now holds **Shared bills** (who owes whom from household bills, equal shares to the penny, "Mark all settled" on a tap,
  nobody messaged) and **Your car's money** (fuel, charging, parking, insurance, tax, servicing and tolls from your statements, a month,
  marked as a first estimate, with the MOT, tax and insurance dates the home pack knows). Each subscription has **How to cancel**: the
  company's own public cancel page and the plain steps. It never signs in or cancels for you.
- **Calendar**: the month as a grid with every bill, subscription and payday on its day. Heavy days are ringed, payday is filled, and a
  tap on a day says what falls on it.
- **Trends** now holds **Your year in money** (totals, the dearest and cheapest months, where it went, the places you paid most, the
  subscriptions you started and stopped; it prints) and **Price watches** (each watch with its price, how it moved since you started,
  its lowest and highest, when it last read the page, and why a read failed).
- **Statement**: "Remind me on the 2nd" turns on a reminder each month to add last month's statement. It is off until you turn it on.
  It comes through the brain's Web Push, so it arrives with the phone locked.

### HOUSEHOLD (Life → HOUSEHOLD)
- **Bills keeps the paid ones** (the half-done item from last round). The brain now sends paid bills too, so they stay under PAID with
  what each supplier cost you this year and last, and each has Forget.
- **Papers** (a new pill): each warranty with its end date and a photo of the receipt, kept only on this phone, with a 9am reminder a
  month before it ends. Household papers (tenancy, home and car insurance, council tax, TV licence, passport, driving licence, boiler
  cover, contracts, mortgage deal) with their renewal dates and reminders a month and a week before.
- **Meter** now shows your use between readings as bars, and, once you type your tariff (pence a unit and a day), a first estimate of
  what each span cost. It is marked as an estimate, not your bill.

### WORK (Life → WORK)
- **Document is now your library** (the other half-done item). Every CV, cover letter, email and summary I show you is kept on this
  phone as it is shown, with a new version when its words change. Open it, edit it in DOCUMENTS, see its older versions, search them,
  or forget one (it asks first).
- **Jobs** (a new pill): each job you applied for, with the day, where it stands (applied, interview, offer, turned down, withdrawn)
  and a reminder to follow up on the day you pick.

- **Meetings** (a new pill): add a meeting with its agenda, open it to type notes as it goes (kept on this phone as you type), then
  **Sum it up** turns the agenda and notes into the decisions, the actions and who has them. The summary is kept with the meeting and
  in your documents library, and your own actions go to your to-do list in one tap. Nothing is sent to anyone.

### PEOPLE (Life → PEOPLE)
- Each thing you told me about someone can be changed or taken away, and the Memory line follows.
- Your own photo of someone you introduced, kept only on this phone. It is never sent and never used to recognise anyone.
- A gift list per person: ideas with prices, marked bought, what you spent on them this year, and what you gave them last year so a
  present is never repeated. Forgetting someone takes their list too.
- **Group plan** runs several plans at once: pick one from the row at the top, answer for each person, call one off and the others
  stay. Nobody is messaged.
- **Coming up**: each birthday has **Draft a message**, written in your voice, with Copy, Share and Another. You send it yourself;
  Ghosty never sends it.

### Words
"safe to spend", "money calendar", "savings goals" and "my year in money" open the right page with no model. The catalogue line in
Abilities says so.

## Decisions, and why
- **No forecast.** Safe to spend is your balance less what is already due, never a guess about what you will spend. The energy page's
  "about £x for 30 days" is that span's own rate, and it is marked as a first estimate.
- **Not one prompt word added.** The new keys are phone-only actions run through POST /packs/do (`apps/edge/src/tools/moneyapp.ts`,
  joined in `packs/index.ts`). The money, home, work and people tools' action lists, and the prompt guard, are unchanged.
- **Photos stay on the phone.** Receipt photos and people's photos are kept in this phone's own storage, made smaller first, and never
  sent to the brain.
- **Six pills at most.** The pill row holds six (`ui/sections.ts`), so goals sit with Budgets, shared bills and the car with Bills, and
  the year and price watches with Trends.
- **The cancel helper keeps to the company's own site.** A stable cancel address is used where one is known (Netflix, Apple); otherwise
  a keyless web search, and only a result on the company's own site is shown.
- **Price history.** `watchers.ts` now keeps each price watch's moves (at most 60), which the price watches page reads.

## How to try it on your phone
1. **Life → MONEY → Month.** Type your payday ("the 28th") and tap Keep payday. Read Safe to spend and the payments still due.
2. Tap a payment, open "Split it across categories", type 25, pick two categories, tap Split it.
3. Tap **Your sorting rules** to see your rules and their counts.
4. **Budgets**: add "Holiday", 800, a date in June; tap Put in with 50.
5. **Bills**: add a shared bill ("Electric", 96, "you, Sam and Jo"); tap How to cancel under a subscription; read Your car's money.
6. **Calendar**: tap payday, then a ringed day.
7. **Trends**: scroll to Your year in money (Print it) and Price watches (paste a shop's page).
8. **HOUSEHOLD → Papers**: add your washing machine with its receipt photo, and your house insurance's renewal day.
9. **HOUSEHOLD → Bills**: mark a bill paid and see it stay under PAID with the year's total.
10. **WORK → Document**: ask me in the chat for a CV, then find it kept here. **WORK → Jobs**: add an application. **WORK → Meetings**:
    add one, type notes, tap Sum it up.
11. **PEOPLE**: open someone's details; change a note, add a gift idea, mark it bought.

## Checks
- New spec **`tests/moneynext.spec.mjs`** (its word is at the end of check.yml's `all=`): at 440 × 956 and 390 × 844, safe to spend to
  the penny against the brain's own sums, rules, a split, goals, shared bills, the car and the cancel page, the calendar, the year, price
  watches, HOME's paid bills, Papers with a receipt photo, energy, the documents library, jobs, meetings, people's notes, gifts and photo, a
  birthday message drafted from Coming up, every new
  page offline and failed in his words with TRY AGAIN, every key 44 pt, nothing sideways, BODY 21 and the seven looks. About 260 checks,
  under 90 s here.
- Brain tests in `apps/edge/test/money.test.mjs` cover every new sum and action (safe to spend, calendar, supplier years, goals, split,
  household shares, the year, meter spans, papers and their reminders, the statement nudge, notes, gifts, jobs, the cancel helper).
- `tests/tabs.spec.mjs` reads the new pills and pages. The states ratchet has rows for every new page.
- moneylane, lifepass and awareness ran clean against these changes.

## Specialist sweep: what the best apps have, and where Ghosty stands
| Their feature | Who has it | Ghosty now |
|---|---|---|
| Left to spend until payday | Monzo, Emma, Snoop | Built: Safe to spend |
| Bills calendar | Emma, Snoop, YNAB | Built: Calendar |
| Savings goals with a date | Monzo pots, YNAB targets | Built: Goals (your word, no money moves) |
| Split a transaction | YNAB, Emma | Built: two-way split |
| Editable categorisation rules | Emma, YNAB | Built: Your sorting rules |
| Year in review | Monzo, Emma | Built: Your year in money, printable |
| Cancel a subscription | Emma, Snoop | Built: the company's own cancel page (never cancels for you) |
| Group balances, settle up | Splitwise | Built: Shared bills (equal shares) |
| Receipts and warranties vault | Warranty Keeper-style apps | Built: Papers with receipt photos |
| Renewal reminders for household papers | Household admin apps | Built: Papers |
| Price tracking with history | Price-watch apps | Built: Price watches |
| Energy use from meter readings | Energy supplier apps | Built: on Meter, a first estimate |

## What is left (for the next pass)
- **Unequal shares** on Shared bills (Splitwise's "by amount" and "by percent"), and splitting a payment into more than two parts.
- **Moving-house checklist** (money.s6), **invites from a group plan** (money.s10) and **more drum sounds and
  your own loops** (money.s11) were not reached this round.
- Safe to spend could later count a budget's money still to spend as set aside, if you want it to.
- The cancel helper's list of stable cancel addresses is short on purpose; others come from a search kept to the company's own site.
