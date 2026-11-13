# FINAL ROUND: MONEY AND PEOPLE (lane-money), 13 November

Branch `claude/new-session-4erjve-lane-money`, merged into `claude/new-session-4erjve-final`. Nobody was watching to answer questions,
so each decision is written down here with its reason.

## What was wrong

- **MONEY was one box, not an app.** The MONEY screen held only PASTE A STATEMENT. The month, the budgets, the subscriptions and the
  year were all real in the brain (`packages/shared/src/spending.ts`), but you could only see them on the Agenda's SPENDING card. There
  were no bills due, no trends past one year's bars, no way to search a payment, no pace, and no line saying how a number was worked out.
- **PEOPLE could not show what is coming up.** The brain already keeps birthdays and dates, works out "turning 40", and reminds you a week
  before and on the day. The screen never showed any of it in date order. You could not search your people, keep a birthday from the
  screen, or forget someone without typing it in the chat.
- **HOME's "A collection moved" made up a day.** Pressed with the box empty, it told the brain "bins moved to Wednesday this week", a day
  you never said. That broke a promise.
- **A contradiction, checked and left alone on purpose.** PASTE A STATEMENT says no model sees the statement, and that is true: it reads
  with `rulesOnly`. The Agenda's SPENDING card (the PLAN lane's) says shop names the rules cannot place go to a free AI, and that is also
  true, because its ADD STATEMENT is a different path. Both sentences match what their own code does, so neither was changed.

## What I made

### MONEY: a budgeting app of its own (`apps/web/src/features/money/app.ts`)
Five pills: **Month · Budgets · Bills · Trends · Statement**.

- **Month.** Money out, money in and what is left over, each with one line saying how it was worked out. The pace: "Day 13 of 30:
  £90.54 out so far, about £6.96 a day." Each category shows its amount, its share of the month and its change since last month, with
  a key to show only that category's payments. **Where it went most** lists the top five places you paid. **Every payment** has a
  search box ("Tesco", "rent", "12.99"); tap a payment to file it under another category, and the next statement remembers the rule.
  The ‹ › arrows move between months and say why one cannot be pressed.
- **Budgets.** Each budget has its bar, "£x of £y", and On track, Going faster than the month, or Over budget. Under it: what is left,
  what that comes to a day for the days left, and how much of the month has gone. You can set, change or take away a budget with a
  category and an amount, without typing a sentence. Categories with no budget are listed with what they cost this month.
- **Bills.** What is due next, in date order. It joins two things: the subscriptions found in your statements (the same amount to the
  same name every month or every year) and the bills you photographed or pasted on HOME. It totals the next 30 days, the subscriptions
  per month (yearly ones shared over twelve months) and per year. A price that went up shows both prices. A subscription whose
  statements stop before its date says to check it is still running.
- **Trends.** Your last six months side by side (out, in, left over), the monthly average, and the dearest and cheapest months. Pick
  any one category to see it across the months, with its own average.
- **Every state is said in your words.** Each page has "Nothing kept yet" with an **Add a statement** key that opens PASTE A STATEMENT,
  "Opening your money…", a failure in plain words with **Try again**, and "No signal". If the brain is away, the last copy kept on the
  phone is shown.
- **Decisions.** No forecast of what you will spend: the pace is a sum, never a guess (no prediction). No bank connection, no paid API,
  no new key. The bills page reads HOME's bills from your own brain; it never looks anything up.

### PEOPLE (`apps/web/src/features/people/sheet.ts`)
- **Coming up** (a new pill): every birthday (with "turning N" when you gave the year), date, plan and call you told me about, a year
  ahead and in date order. You can keep a birthday ("Mum", "14 March 1962") or a date ("our anniversary is 12 June") there. The brain
  sets the reminders, as it always did.
- **Your people** is now A–Z with a search box ("cousin", "fishing"). Each person's details hold **Keep birthday** and **Forget**, and
  Forget asks once more before it acts. It still covers only the people you told me about. Nobody is looked up, nobody is told, and
  nothing predicts or profiles anyone.

- **Group plan** can now be made on the screen ("pub on Friday at 8 at the Crown, asked Ali, Sam and Jo") and called off there. Before,
  the screen could only tell you to say it in the chat. Nobody is messaged.

### HOME (`apps/web/src/features/homeadmin/sheet.ts`)
- "A collection moved" with nothing typed now asks where the collection moved to, and keeps nothing.
- **Bills** shows the unpaid ones first, soonest due first, then the paid ones, with one line adding up what is still to pay.

### WORK (`apps/web/src/features/work/sheet.ts`)
- The **to-do list** is in the order a good to-do app keeps: Late, Today, Coming up, Any time, Done, each under its own heading (late
  jobs in the warning colour). A count line reads "3 to do · 1 late · 2 done".

### Voice and chat (no model needed)
- "my budgets", "show me my budgets", "my subscriptions", "direct debits", "spending trends", "spending by month", "my spending" and
  "spending this month" open MONEY on that page (`features/money/words.ts`). The match is narrow on purpose: "how much did I spend on
  fuel?" still goes to the brain.
- "birthdays coming", "upcoming birthdays" and "whose birthday is next" open PEOPLE's Coming up.
- The catalogue has the new ability ("Your money app"), so the abilities list and "can you…?" know it.

### Checks
- New spec **`tests/moneylane.spec.mjs`**, with its word at the end of check.yml's `all=`. At 440 × 956 and 390 × 844 it checks that
  every figure equals the brain's own sum to the penny, plus search, re-filing, the month arrows, setting and taking away a budget,
  bills in date order with the HOME bill and the price rise, the trends, and every state (empty, waiting, failed, offline). It also
  checks the chat words, Coming up, search, forget-asks-first and the bins fix, BODY 21 on every page, and the seven looks (scan, map,
  eye, orbit, grown, ink, glass). Every key is 44 pt and nothing goes sideways. It also covers the group plan form, the to-do order and the HOME bills total. It runs clean: 233 checks.
- `tests/lifepass.spec.mjs` and `tests/tabs.spec.mjs` now go through the new pills, which is as strict as before or stricter: BODY 21
  now covers all five money pages and Coming up.
- The states ratchet gained rows for money.month, money.budgets, money.bills, money.trends and people.coming, each pinned at all four
  states.
- Tokens only: the colour ratchet went down (no new hex, rgba or pixel radius).

## How to try it on your phone
1. Open **LIFE → MONEY**. With nothing kept, each page says so; tap **Add a statement** and paste your bank's CSV or pick its PDF.
2. **Month**: read your out, in and left over; type "tesco" in the search box; tap a payment to file it somewhere else.
3. **Budgets**: pick "Eating out", type 150, tap **Set budget**. Watch its bar and what that leaves a day.
4. **Bills**: see what is due next. Photograph a bill on **HOME → Bills** and it appears here too.
5. **Trends**: tap a category to see it across your months.
6. Say "my subscriptions" or "my budgets" to Ghosty.
7. **PEOPLE → Coming up**: keep "Mum, 14 March". Then on **Your people**, open her details and try **Forget** (it asks first).

## What is left
- **Not mine, reported:** `assistant/push.ts` reads `reg.pushManager` when no service worker registered (a blocked worker in a test
  browser), which throws a page error. It belongs to the SYSTEM AND SETTINGS lane; the fix is `reg?.pushManager`. My spec ignores only
  that one message.
- Creative had a lighter pass: I read every key on its pages and found none dead and no promise its code does not keep, so it was not changed. Work's interview and document pages were read the same way and not changed. A deeper specialist pass on those pages (for example, a CV builder or a song maker) is the next step. The comic belongs
  to the COMIC lane and was not touched.
- The Agenda's SPENDING card (the PLAN lane's) still draws its category bars with its own grandfathered colours. The MONEY screen uses
  tokens only.
