# NEXT ROUND, MEMORY LANE: a memory that keeps your word (14 Nov 2026)

Built by the mid tier on `claude/new-session-4erjve-lane-memory`, merged into `claude/new-session-4erjve-next`.

## What I built

### 1. The next round's two picks

**Promise keeper (`memory.s3`).** When you say you'll do something, Ghosty keeps it.
- It works in the app and on Telegram, for things like "I'll send Jo the photos tomorrow", "I need to call the dentist on Friday" or
  "I promised mum I'd fix her printer this weekend".
- On the day you gave, it reminds you once at 9 am (6 pm for "tonight"). With no day given, it reminds you two days later.
- The reminder comes through the brain, so it reaches a locked phone.
- Saying "I sent Jo the photos" ticks it off.
- Questions ("what should I cook tonight?"), requests to set a reminder ("remind me to…") and "I need to know…" are never taken as
  promises.

**Your week in review, Sundays (`memory.u5`).** At 6 pm every Sunday, a card comes to your phone with:
- what you asked about most;
- what you finished (promises done, things built);
- what is still open (promises and chases);
- the questions that never got a real answer.

Ask "how was my week?" any time. It is also at the bottom of Memory → YOUR WORD.

### 2. They meet as one thing: MEMORY → YOUR WORD (the new pill after Chat)

- **You said you'd:** each open promise has DONE, LATER (tomorrow) and LET GO, each with UNDO. Done ones fold underneath, with REOPEN.
- **Where things are:** "the spare key is in the blue tin", "I put my passport in the top drawer". Say the thing again somewhere new
  and the newest place wins. Each has FORGET with UNDO.
- **Why you chose:** "I picked the canal flat because it's quieter". Each has FORGET with UNDO.
- **Your week:** the Sunday card's lines.

The phone keeps its own copy, so "where's the spare key?" answers with no signal. Something you tell it with no signal waits on the
phone and reaches the brain when the signal is back.

### 3. Half-done, finished

- **Meaning search on the phone.** Once downloaded, the meaning model is woken while the phone sits idle, on charge or above half
  battery. Until it's ready, an answer says "(By words only: meaning search is still waking up.)"

### 4. Soon: all built

- **One search across everything (`memory.s2`, with `memory.u10` and `plan.u5`).** Find now covers:
  - your library;
  - the links the chat gave you;
  - your to-dos;
  - documents, pages, decks, sheets and chats.

  Three words in the "Go to, or ask" bar also show "Your things".
- **Ask by date (`memory.u8`).** These all work: "what did I ask last March about the car?", "what did I ask in October?", "…last
  week about trains?".
- **Remember where you put things (`memory.s5`).** As above, with answers that work offline.
- **Chases in your morning Brief (`memory.c2`).** This went into the PLAN lane's Brief, small and additive.
  - Each email that needs an answer gets a CHASE key, after DRAFT. One tap holds it for two working days and looks that morning.
  - A "Chasing today: …" line shows the chases due today.

### 5. Later: built

- **Chases that try again (`memory.u4`).** Say "…and again Monday if still nothing". If the first morning finds nothing, the chase
  holds and looks once more.
- **Questions you never got answered (`memory.u6`).** Ask "what did I never get an answer to?". The list has an ASK AGAIN key for each.
- **The whole exchange in recall (`memory.u7`).** Tap a recall result and a card shows what you said and what Ghosty answered, without
  leaving where you are. It has OPEN IN CHAT and PIN.
- **Pin a chat to keep it (`memory.u11`).** A pinned chat stays in recall past the 30 days, on the phone and on the brain.
- **Chase any wait (`memory.s4`, in its reshaped form).** "Remind me if the parcel hasn't come by Friday": that morning Ghosty looks in
  your own email for a delivery. There is no paid tracking service and no new key.
- **What was I doing on the 3rd? (`memory.s7`).** Ghosty rebuilds the day from your own chats and what you told it that day. It never
  uses where you were.
- **Why did I choose that? (`memory.s8`).** As above. If no reason was caught, it finds the chat where you said "because…".
- **Spoken recall (`memory.c5`, in its reshaped form).** There are many more wordings ("what was I asking about…", "did we talk
  about…", "what did we decide about…"). Asked aloud, the answer is one short line ("You asked me about trains three times, last on
  Tuesday").
- **On Telegram.** The brain's `recall` now answers about promises, places and reasons too. Its description wasn't lengthened, so the
  tool ceiling holds.
- **Recall by meaning on Telegram too (`memory.u1`).** When words find little, the brain compares your newest 150 chats by meaning.
  - It uses the same free embedding the library already uses, within the day's free allowance; there is nothing to pay.
  - Ask on Telegram about "the trip north" and it finds your "trains to Leeds" chat.
- **Find lands on the exact cell (`memory.u9`).** A spreadsheet match opens at its cell (sheet and cell set before it opens). A deck
  match opens at its slide.
- **Chases follow the exact email (`memory.u2`).** A chase made from a mail in the Brief counts only a reply from that sender with that
  subject, so a different email from the same person doesn't close it.
- **Bill questions next to the bill (`memory.c3`).** This went into the money lane's BILLS, small and additive. Under a bill:
  - "You asked me about this yesterday ›";
  - a tap shows that whole exchange.
- **Your past words while you write (`memory.c1`).** This went into the editors lane's Docs, small and additive.
  - FROM WHAT YOU SAID at the foot of a document: type "the hedge" and your own words come up.
  - PUT IT IN places them after your paragraph, for you to edit.
- **Find in photographed letters (`memory.s1`).** This is one additive line in the Lens's READ.
  - The words the Lens reads are kept on your phone only (the newest 60, a number plate never kept).
  - "Where's that parking fine letter?" or FIND "parking penalty" finds them, and a tap shows them whole.
  - The photo itself is never kept.
- **WHAT'S NEW:** six lines for the things you will notice.

## How to try it on your phone

1. Say "I'll send Jo the photos tomorrow". Tomorrow at 9 a reminder comes. Then say "I sent Jo the photos": it is ticked off in
   Memory → YOUR WORD.
2. Say "the spare key is in the blue tin". Turn on aeroplane mode and ask "where's the spare key?".
3. Say "I picked the canal flat because it's quieter", then later "why did I pick the canal flat?".
4. Ask "what did I say I'd do?". Tap DONE on one.
5. Ask "how was my week?". Sunday at 6 pm, the card comes by itself.
6. Ask "what did I never get an answer to?", "what did I do yesterday?" and "what did I ask last week about trains?".
7. Open the Brief: CHASE sits on an email that needs an answer.
8. Type three words in the "Go to, or ask" bar: your own things show under "Your things".
9. Tap a recall result: the whole exchange, with PIN.

## Checks

- **New brain test:** `apps/edge/test/keep.test.mjs`, reached from `context.test.mjs`. It covers:
  - promises caught, nudged once, and closed by your words;
  - where, with the newest place winning, and why;
  - the routes;
  - the Sunday card, sent once and only from 6 pm;
  - the date phrases;
  - the import guard.
- **recall test:** new cases for the second look, the parcel, the pin, and the new wordings.
- **New spec:** `tests/keepword.spec.mjs`. Its word `keepword` is at the end of check.yml's `all=`. It runs at 440, 390, and 390 with
  BODY 21: **"keepword spec: all good"**. It also proves:
  - CHASE on a Brief email;
  - a spreadsheet opening at its cell;
  - the bill's question line;
  - FROM WHAT YOU SAID in a letter;
  - a Lens-read letter found.
- **Other lanes' specs touched by the additive pieces, all passing:**
  - docs: ran clean;
  - reste: all good;
  - moneylane: ran clean;
  - lens2: clean.
- **No test of its own:** the chase's thread rule (`memory.u2`), because it runs against the real mail account; the spec tests stand in
  for that account.
- **Specs rerun, all passing:**
  - recall: all good;
  - memory: run clean;
  - lifeeasier, part h (the Brief's email line): all checks passed;
  - voicelane: run clean, 68 checks.
- **Fixed on the way:**
  - "show me my week" stays the diary's, and "where's my money gone" stays the money's, as the voice lane's wordings test asks.
  - A turn's answer is matched by its words as well as its time.
- **Prompt guard:** untouched. Nothing new goes into the prompt, and the `recall` tool's description is unchanged.

## The specialist sweep (Mem, Apple Notes, Day One, Readwise)

| They have | Ghosty now | Left |
| --- | --- | --- |
| Mem: everything found by one search | One search covers chats, documents, pages, decks, sheets, the library, links, to-dos and what the Lens read, also from the jump bar, landing on the paragraph, cell or slide | |
| Mem: things resurface when relevant | RECALL lines in replies; "like you said on Tuesday" | |
| Apple Notes: pinned notes | Pinned chats stay past 30 days | A "Pinned" filter in the timeline |
| Day One: on this day, a journal by date | "What was I doing on the 3rd?", recall by month | An "On this day last month" card |
| Day One: weekly digest | The Sunday card and "how was my week?" | |
| Readwise: daily review of highlights | — | A daily resurfacing of one pinned chat |
| Things/Todoist-like: promises with due days | YOUR WORD with DONE, LATER, LET GO | Promises in PLAN's one list (the PLAN lane's `plan.u1` reads them) |

## What is left (listed, not built)

- **Scanned pages:** the SCAN screen keeps its pages in memory only, so a page is found once it is saved as a document. What the Lens
  reads is found at once.
- **The exact email thread:** the chase follows the sender and the subject. A true thread id isn't used, because the Brief's mail lines
  don't carry one yet.
- **Promises as items in PLAN's one list (`plan.u1`):** for the PLAN lane to read from `/profile/keep`.
- **From the sweep:** a "Pinned" filter in the timeline, an "On this day last month" card, and a daily resurfacing of one pinned chat.
