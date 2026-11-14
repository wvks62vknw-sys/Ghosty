# THE APPS ROUND: MONEY, EFFORTLESS (14 November)

Branch `claude/new-session-4erjve-money-next`, merged into `claude/new-session-4erjve-apps`. With no bank feed, getting money in decides
everything else, so this round went into the front door of MONEY: getting your statements in, every kind, many at once.

## What I made

### Many statements at once, in every shape
- **MONEY → Statement → Pick files** takes as many statements as you like in one go. You can also drop them on the page on an iPad or a
  computer. It reads:
  - **CSV** from any big UK bank (as before);
  - **PDF**, with the text taken out on the phone;
  - **OFX**, the "Money / Quicken" download most UK banks offer (its closing balance is kept, so Safe to spend can count from it);
  - **QIF**, the older Quicken download, with day-first (UK) dates, and month-first dates when a file is American.
- Each file gets its own line: how many payments were kept, how many you already had, what kind of file it was, the bank when the file
  says, and the months it covers. A file that is not a statement says why in plain words, and the rest still go in.
- **Overlaps are kept once.** Two downloads that cover the same days (say an OFX and a QIF from the same account) keep each payment once:
  the same day, words and amount, counted, so two real coffees on one day still both stay.
- The page ends with the total: "5 payments kept from 3 of 4 statements; 1 I already had was left out."

### A page for each shop
- On **Month**, every shop under **Where it went most** has **Its page**. The page shows every payment there across all your
  statements, a bar for each month, the total and the average a month, and where every payment there is filed. Pick another category
  and every payment there follows, and the next statement remembers it.

### Several accounts, and moves between them never counted as spending
- On **Statement**, type which account the statements are for ("Current", "Savings", "Credit card"); an OFX file names its own
  ("Account ending 1234", never the whole number).
- **Month → Your accounts** (built from the App Kit's rows, states and loading skeleton) shows each account with its newest balance,
  its payments and last month's money in and out, and the total of every balance. Tap an account to rename it.
- Money out of one of your accounts and the same amount into another within three days is a **move between your own accounts**. It is
  left out of the month, budgets, trends, nudges and safe to spend's money in and out, and still listed, with **Count it** to put one
  back. A pair inside one account is a refund, so it is left alone.
- **Safe to spend** now adds up every account's newest balance.

## Decisions, and why
- **Read in code, never by a model.** OFX and QIF are read by plain rules (`packages/shared/src/statements.ts`), and statements added on
  this page are read by the rule table only, as before. Nothing reaches a bank.
- **No new prompt words.** The shop page is a phone-only action through POST /packs/do, like last round's keys.
- **At most 24 files a pick**, so a mistaken pick of a whole folder cannot stall the phone.

## How to try it on your phone
1. Download last month's statements from your banking app or website as OFX (or CSV, QIF or PDF), from more than one account if you like.
2. **Life → MONEY → Statement → Pick files**, and choose them all at once.
3. Read each file's line and the total. Add one of the same files again: it says you already had every payment.
4. **Month → Where it went most → Its page** on your biggest shop.

## Checks
- Brain tests (`apps/edge/test/money.test.mjs`): an OFX file with its closing balance, a QIF file, an empty QIF, two overlapping files
  keeping the shared payment once, and a shop's page with its months, total, average and rule.
- `tests/moneynext.spec.mjs` now picks four files at once (OFX, QIF, CSV and one that is not a statement) and checks each line, the
  overlap and the total, and opens a shop's page, at 440 × 956 and 390 × 844, with the 44 pt and nothing-sideways bar. It runs clean, as
  do moneylane and the full brain suite (2365, none failed).
- **Not mine, flagged:** lifepass's W9 ("a tick the brain did not take is put back") is red on the apps branch itself. The plan lane's one
  list now keeps a tick made without signal in an outbox and sends it later, which is the opposite of what W9 expects. The spec needs
  updating to the new behaviour by that lane.

## What is left (from apps/money.md)
- Shop logos; charts you tap into with any two periods compared; payday-to-payday months; a flow chart.
- Leftovers carried into the next month (started, left out unfinished), budgets for groups of categories, and a push when a budget
  runs hot.
- The rest of Money on the App Kit's frame (Your accounts uses its rows and states already); undo and a Recently deleted bin for imports.
- The rest of the money family's list (bills joined with HOUSEHOLD, the Garage, CV Studio, Receipts, Envelope Budget, Invoices and the
  others) is untouched this round.
