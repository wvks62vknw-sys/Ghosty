# THE APPS ROUND: VOICE: Translate (14 November 2026)

Lane VOICE. Branch: `claude/new-session-4erjve-lane-voice`. Spec word: `translatelane` (added at the end of check.yml's `all=`, before
`rest`). Brain tests: `apps/edge/test/translateapp.test.mjs` (run with the lane's meanings tests from intent.test.mjs).

## What I built

### Translate, a new app in SEE
Its own name, icon and card in the See room, beside Interpret, Lens and God's Eye. Say "open the translate app", "show my phrasebook"
or "my translations", or tap it from the room, the deck or the Jump bar. It has three views, one tap apart: TRANSLATE, PHRASEBOOK and
HISTORY.

**TRANSLATE**
- **As you type:** type or paste, and the answer comes a moment after you stop typing.
- **Finds the language:** FROM starts on "Find it for me", and the card says what it found ("From English (found it) · into Spanish").
  You can also pick the language yourself.
- **Other ways to say it:** up to three, under the answer. Tap one and it becomes the answer, and the old answer joins the list.
- **AS IT IS, FORMAL, CASUAL:** formal uses the polite "you" where the language has one, and casual the familiar one.
- **Speak:** the microphone fills the box from your voice, in the FROM language (English when it is still to be found).
- **LISTEN** says the answer aloud in its language. A phone with no voice for that language says how to add one.
- **COPY.**
- **Letters:** Russian, Ukrainian, Greek, Arabic, Urdu and Hindi can be shown in English letters ("Где вокзал?" is "Gde vokzal?"), and
  English letters in Cyrillic. Japanese, Chinese and Thai get no key, because there is no letter table for them yet.
- **SWAP** turns the pair round and puts the answer in the box.
- **CONVERSATION** opens Interpret in the same language. **CAMERA** opens the Lens on TRANSLATE, for signs and menus.
- **Every state is said:** empty (what to do), loading (a skeleton, never a jump), no signal (the phone's own rough translation, said as
  rough), and a failure in plain words with what to do.

**PHRASEBOOK**
- **The star** under a translation keeps it in the phrasebook, under the trip you name ("Spain in May"), or under "Any trip".
- **Sorted by trip:** this trip comes first.
- **Taking one out** has an undo.
- **EXPORT** shares the phrasebook as a CSV file (trip, what you said, the translation, the language) through the phone's Share sheet,
  or saves it on the phone.
- **A country's phrasebook:** pick one of 16 countries for about 20 lines a traveller needs first, in five groups (basics, getting
  around, eating, shopping, help). Tap a line and it is put into that country's language and said aloud, and you can star it under
  that country.

**HISTORY**
- **Kept on this phone:** every translation, newest first, a hundred at most. The same words into the same language move up rather
  than show twice.
- **Search** finds a translation by either side.
- **OPEN** brings one back into the box.
- **CLEAR HISTORY** has an undo.

**Settings and help** (folded under the note)
- **Say each answer aloud** (off at first).
- **Translate as I type** (on at first). Turned off, nothing is translated until you tap TRANSLATE IT or press Return, not even when you
  change the language.
- **Four lines of help:** finding the language, formal and casual, the phrasebook and EXPORT, and no signal.
- Kept on this phone.

**Built on the App Kit's parts**
- **The first run** shows a three-step tour, once.
- **History rows** are the kit's list rows: tap one to open it, delete one with an undo.
- **Empty, no match and errors** are the kit's state cards, each with what to do next ("Translate something", "Clear search",
  "Try again").
- **While it translates**, the kit's skeleton rows stand in.

### Interpret: AUTO, a conversation with no key to hold
- **One tap:** tap AUTO and I listen for whoever's turn it is, in their language. When they pause after speaking, I translate and say it
  aloud, then listen for the other person.
- **Its own voice:** I wait until the phone has finished speaking, so its own voice is never taken for theirs.
- **It ends** after two quiet turns, on STOP AUTO, when either of you holds a key, or when you leave the screen.
- **Nothing kept:** as before, nothing of the other person is kept.

### The brain's side
- The translator route now takes a register (formal or casual) and asks for other ways to say it. A chat model does it when there is
  one, with your text kept as data to translate, never as instructions.
- With no chat model it falls back to the plain translation, never a made-up alternative.
- Every other caller (the Lens, Interpret, Documents) gets exactly what it got before.

### His rules here
- Nothing downloads here.
- Your history and phrasebook stay on this phone.
- Your words go to the brain only to be translated, and nothing of them is kept there.
- Nothing of anyone else is kept: conversation stays in Interpret, which keeps nothing.

## How to try it on your phone
1. **Type:** open SEE → TRANSLATE, set INTO to Spanish, and type "Where is the station?". The answer comes as you type, with other ways to
   say it. Tap FORMAL, then LISTEN.
2. **Phrasebook:** tap the star. Open PHRASEBOOK and name the trip "Spain in May"; it's there. Then pick France under "Going somewhere?"
   and tap "Thank you.".
3. **Letters:** set INTO to Russian, then tap IN ENGLISH LETTERS.
4. **History:** open HISTORY, search for a word, then tap OPEN.
5. **By words:** say "open the translate app" or "show my phrasebook".
6. **AUTO:** open SEE → INTERPRET, pick French for them, tap AUTO and just talk. Pause, and it says it in French, then listens for their
   answer.

## Checks
- **Typechecks:** web and edge, clean.
- **Brain tests:** `translateapp.test.mjs`, 4 tests:
  - letters in every script it changes;
  - the history (newest first, never twice, a hundred at most, searchable, read back safely);
  - the phrasebook by trip;
  - the register and alternatives from a faked model, with the text kept as data and the plain fallback.
- **Other brain tests:** meanings, catalogue, knowledge, ratchet, look and voiceknown.
- **Specs:**
  - `translatelane` is clean at 440 and 390 (80 checks), twice in a row: the first run's tour; EXPORT (the file read back); both settings; as you type; the language found; other ways; formal; LISTEN;
    star; the phrasebook and its undo; a country's phrasebook; letters; the history with search, no match, clear and undo, and opening a
    row; no signal said in plain words with TRY AGAIN; CONVERSATION; Interpret's AUTO both ways, with STOP and leaving; every key at least
    44 pt; and nothing off the side.
  - `further` (Interpret's own spec) is still clean.
  - `tabs`, `tabs2`, `hubcards`, `deck` and `nav` were updated to the new truth and are clean: SEE holds four. With PAINT (MAKE's lane),
    the plan numbers 48 things, and `finding.test` counts 59 screens.
  - The full brain suite ran once: 2,366 passed. Its one red, the plan's count, is now updated to the new truth.

## What is left
- **Offline packs (Mozilla's Bergamot):** not built.
  - They need the Bergamot translator (a WebAssembly engine) running in a worker, plus a pack manager (sizes, fetched only on his tap, on
    Wi-Fi, with the size said).
  - The app's `_headers` can only be tightened, never relaxed. So the engine and the packs would have to come through the brain (it
    fetches the public files and passes them on), never straight from Mozilla's servers.
  - That is a whole piece on its own. Without a signal, Translate uses the phone's own offline brain for now, roughly, and says so.
- **Camera translation drawn over the picture:** CAMERA opens the Lens's own TRANSLATE. Drawing each translation over the sign itself is left.
- **The App Kit's whole frame:** the kit's `app()` frame (its header, its single scroll area, the toolbar along the bottom) is made for
  apps that are lists of things. Translate uses the kit's parts (the tour, list rows, state cards, skeletons) inside its own screen, so
  it still has the shared page header rather than the kit's.
- **Your Song, The Coach, Drum Pads:** not started this round.
