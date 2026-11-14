# THE APPS ROUND: MEMORY: Journal

The flagship this round is **JOURNAL**: his own journal, of the Day One and Apple Journal kind. MEMORY is Ghosty's diary about
him; JOURNAL is where he writes his own. It sits inside Memory (a row there, like Security inside Settings). Everything is kept
on the phone and in the encrypted backup. An entry leaves the phone only when he taps ASK GHOSTY ABOUT IT on that entry.

It's proved by `tests/journal.spec.mjs` at 440 × 956, 390 × 844 and BODY 21, and in all seven looks at 390 (about 70 s). Its word
`journal` is at the end of check.yml's `all=`. The unit tests are `apps/edge/test/journal.test.mjs`, reached from
`context.test.mjs`.

## What I built

### JOURNAL (Me → Memory → JOURNAL, or say "new journal entry")
- **Entries.** Each entry has:
  - his words, saved as he types (half a second after he stops);
  - a prompt when the page is blank (GIVE ME A PROMPT, from 20 classic journalling questions), or THREE GOOD THINGS for gratitude;
  - SAY IT, which writes what he says into the entry through the phone's own recogniser, the same one the keyboard's microphone uses;
  - photos, made smaller on the phone. A canvas copy keeps only the pixels, so the camera's location data is never kept. Full
    pictures live in IndexedDB, and a small copy sits in the entry so the backup brings the look back;
  - a voice note, recorded on the phone;
  - a mood (Awful to Great), a day, and which journal it belongs to;
  - a place: one of his saved places, or words he types;
  - the weather at his home town (Settings' home, never a live position), filled in for an entry about today.
- **A photo's own place.** When a photo carries GPS in its own data, it is read on the phone and only names the nearest SAVED
  place within 300 m. The position itself is never kept or sent. An entry has no field for a position.
- **Earlier wordings.** A wording becomes a version once it has stood for ten minutes. The last ten are listed in the entry, and
  PUT BACK restores one in a tap (the wording it replaces is kept in turn).
- **DELETE has UNDO**, and RECENTLY DELETED keeps entries for 30 days (RESTORE, or DELETE NOW).
- **Several journals** (Personal first; NEW JOURNAL adds Travel, Kids and so on), each with its own colour from the world's
  tokens. A chip row filters by journal.
- **Views:**
  - ENTRIES: newest first under month headings, with search by his words. When his words find nothing, it searches by meaning
    through the phone's own index, but only while the journal is unlocked.
  - CALENDAR: a dot on each day written; tap a day for its entries.
  - ON THIS DAY: a week ago, a month ago, and every year before.
  - PLACES: entries grouped by place, and SHOW ON A MAP, which pins his saved places that have entries (drawn only on his tap).
- **The streak** ("3 days in a row") heads the page. It isn't lost before tonight's entry.
- **The lock.** LOCK WITH FACE ID makes a passkey on this phone (a platform authenticator with user verification). The journal
  locks again when he leaves it or Ghosty goes to the background. While it is locked, nothing shows, and its words are never
  copied into the phone's recall index.
- **The nudge.** NUDGE ME DAILY at a time he picks is one daily reminder on the brain. It holds only "A line in your journal?",
  never his words.
- **The book.** EXPORT THIS YEAR AS A BOOK opens a clean, print-ready page of the year (words, prompts, places, moods, weather,
  photos), ready for Print → Save as PDF.
- **The first run** shows three example entries and a three-step tour. CLEAR SAMPLES takes them away and leaves the empty
  state.
- **Chat:** "new journal entry", "add to my journal: …", "dear diary, …", "open my journal". Everyday names are in
  meanings.ts.
- **The App Kit:** Memory's JOURNAL row is the kit's Home card (icon, name and one line: entries and streak).

### KEEP IN TOUCH (Life → People → Keep in touch), new
- He adds the people he wants to stay close to and how often (from every week to every 6 months).
- The list puts whoever is most overdue first ("6 days over", "Due today", "In 14 days").
- Tap a name when you've caught up, and ✕ takes someone off. Both have UNDO.
- The nudge is one reminder on the brain, at 10 on the due day (tomorrow for someone just added). It holds only "Time to catch
  up with Jo?".
- Kept in `ghosty.touch`, in the backup. Built from the App Kit's listRow and stateCard.

### GIFTS (Life → People → Gifts), new
- Every gift for everyone: an idea, then bought, wrapped and given (one tap a step, with UNDO).
- A budget per occasion, said in amber when spent goes over it. Ideas don't count as spent yet.
- I WAS GIVEN THIS keeps a gift he received, with its thank-you owed, listed first until it's marked sent.
- Prices are what he types: nothing is looked up, bought or sent. Kept in `ghosty.gifts`, in the backup.

### Your people and Your word (existing apps, gaps closed)
- **vCard import and export (YOUR PEOPLE).** IMPORT CONTACTS reads a .vcf on the phone (folded lines, N or FN, phones, emails,
  address, a birthday with or without a year). It keeps each card on the brain through the people pack's own actions (note,
  contact, birthday). EXPORT ALL writes everyone as one vCard 3.0 file, through the Share sheet where the phone has one.
- **Promises on a person's card.** His open promises from YOUR WORD that name that person show under DETAILS.
- **The group plan into his Calendar.** ADD TO CALENDAR writes the plan as one .ics file: its day, its time (two hours, or all
  day), its place, and who's coming. Nobody is sent anything.
- **A decision log with a look-back date (YOUR WORD).** LOOK BACK on any reason he gave sets a reminder three months on, asking
  whether it worked out. NO LOOK BACK takes it off.
- **A chart for his week (YOUR WORD).** Under the week's lines, bars show what he asked about most, and finished against still
  open. The Sunday card itself was already on the brain.

## How to try it
- Me → Memory → JOURNAL. Write, take a prompt, add a photo, tap a mood, then look at Calendar, On this day and Places.
- Settings (in the journal) → LOCK WITH FACE ID, then leave and come back.
- Say "add to my journal: the boiler works again".
- Life → People → Keep in touch, Gifts, and Your people → IMPORT CONTACTS.

## Checked by
- `tests/journal.spec.mjs`:
  - (a) the first run's examples and tour;
  - (b) an entry with gratitude, a prompt, a mood, weather, a place and a photo; search, with its no-match words;
  - (c) the chat's entry;
  - (d) calendar, On this day, places and the map;
  - (e) DELETE and UNDO, RESTORE, ASK GHOSTY ABOUT IT, PUT BACK;
  - (f) the passkey lock on a virtual authenticator;
  - (h) KEEP IN TOUCH;
  - (i) GIFTS;
  - (j) vCard import and export;
  - (k) the plan's .ics;
  - (g) every key 44 pt, nothing sideways, no word cut, in all seven looks.
- `tests/keepword.spec.mjs`: (p) LOOK BACK and NO LOOK BACK; (q) the week's bars.
- `apps/edge/test/journal.test.mjs`:
  - streak, On this day and search;
  - the chat's asks, and Memory's own diary asks left alone;
  - a JPEG's GPS read, and only a saved place's name coming back;
  - KEEP IN TOUCH's due words and order;
  - GIFTS' steps and budgets;
  - vCards read and written;
  - the plan's .ics;
  - promises on a card;
  - nothing in the journal reads a position, its one way out is that key, and the nudge carries none of his words.
- The full brain suite is green. finding.test counts 57 screens, with journal inside Memory. The STATES ratchet lists
  people.touch and people.gifts.

## What's left
- Voice notes turned into text after recording. SAY IT writes live speech in instead; nothing transcribes a saved note.
- The journal itself is not an App Kit `app()`: it is a multi-view screen. It uses the kit's Home card, and its notices are toasts.
- Date polls and invite cards for the group plan.
- Groups and tags, and a dated timeline per person.
- His own lead time per person in COMING UP.
- The Letter studio: left to the editors lane, whose Documents already have letter templates.
- A heads-up, not mine: on the integration branch, the web typecheck has 6 errors in
  `packages/shared/src/applib/catalogue/{learn,world}.ts` (APPLIB CAT-C). @parent was told.
