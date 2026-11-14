# THE APPS ROUND: LEARN: Chess

Read `docs/build-plan/APPS-ROUND.md` first. This file is your work, in order.

## 1. Your flagship: build it whole, at the level of the market leader

### Chess
The groundwork is done: Stockfish runs on the phone and Glicko ratings exist. Lichess's free CC0 puzzles and puzzle rush, a full game review with accuracy and blunder marks, an analysis board with an eval bar, an openings explorer with a repertoire trainer, playing as Black, and clocks would quickly make it Chess.com-class.

- **What it is:** A complete chess app: puzzles, lessons, full game reviews, openings and clocks, with Stockfish running right on your phone.
- **Match or beat:** Chess.com and Lichess, with Chessable for openings
- **Builds on:** Rated chess (vendored Stockfish, Glicko-2 ratings, the review), the Gym's chess board and Ghosty's own evaluator, the Lens camera, and the Brief
- **Effort:** L
- **Must-haves:**
  - Puzzles by rating from Lichess's open CC0 database, a timed rush mode, and a puzzle of the day in the Brief
  - Game review: accuracy, best moves, blunder/mistake/inaccuracy marks, key moments and retry from a mistake
  - An analysis board with an evaluation bar and the engine's top lines
  - Either colour, clocks from bullet to classical, Chess960, and bots with personalities
  - An openings explorer from public master statistics, and a repertoire trainer with spaced review
  - Lessons and endgame drills
  - Point the Lens at a real board or a book diagram to set up the position
  - PGN import and export, and a library of your games
- **His rules here:** Uses only open puzzle and opening data; never looks up a player or an account, and predicts nothing about anyone.

## 2. Then your existing apps, against their leaders (most important gap first)

- **Rated chess and The Gym:** Rated puzzles from Lichess's CC0 database, and puzzle rush; A full game review with accuracy, blunder marks and retry from a mistake; An analysis board with an eval bar and the engine's top lines; Playing Black, and clocks from bullet to classical; Letting him play the Gym's puzzles and guessing games himself, plus a 'why did you play that?' view
- **Courses:** Hands-on lessons with sliders and live simulations; Answer types beyond multiple choice, checked on the phone; A Socratic tutor at each step that gives hints, not answers; Diagrams and worked examples animated step by step; A ready catalogue from OpenStax that works offline
- **Flashcards:** One deck browser for every card, wherever it came from; Making his own cards with pictures, audio, maths and cloze; Anki .apkg and CSV import and export; The FSRS scheduler with a retention he chooses; Learn, Test and Match modes, and typed answers
- **Words in eight languages:** A full course path with a placement test; Speaking and listening exercises; Sentence building with forgiving marking, and a grammar tip per unit; Stories and dialogues read aloud; Urdu first, then more languages
- **Library and the reader (and Reading list):** Highlights and notes, with export; Tap a word for its meaning, kept as vocabulary cards; Apple Books typography and themes; One tap from Safari's Share sheet into a clean, offline 'to read' queue; A listen queue, with each sentence highlighted as it is read
- **Nature diary and species finder:** Bird ID by song on the phone; An offline species pack, fetched on Wi-Fi with the size said; A real map of sightings and a life list with photos; Species pages from GBIF and iNaturalist; Challenges and badges
- **First aid and first aid drills:** An emergency mode: 999 first, then big step cards read aloud; A CPR metronome at 100 to 120 a minute, with counts; A picture or animation for every step; The nearest defibrillators from OpenStreetMap; Topic quizzes and badges
- **Typing:** Adaptive drills built from his weakest keys; A touch-typing course with finger guides; Test modes by time, word count, quotes and code; Live per-letter feedback and a key heatmap; Charts and personal bests
- **Drills and Fast reading:** A daily workout picked from his weakest skills; More game types, with difficulty that adapts during a session; Per-skill charts from his own scores only; Speed reading any Library book, with a guided pacer; Speed against comprehension over the weeks
- **Rehearse:** Live pace and filler-word feedback; Camera rehearsal kept on the phone; A scored rubric with a better version of his weakest answer; A scenario library; Practising with his own deck
- **School and Quiz night:** Sitting papers himself, timed and marked against the public mark scheme; Past questions by topic, and grade boundaries; Open Trivia Database questions by category; A Kahoot-style countdown and scoreboard; On-screen buzzers and teams
- **The Lab:** A card on the LEARN or MAKE tab; New experiments from a question; A catalogue of public datasets; Interactive line, map and scatter charts; Scheduled re-runs with a push
- **Wikipedia offline:** Full-text search; An Explore feed when online; Reading lists and history; Live Wikipedia in any language; Link previews and a contents list
- **Board games, Poker and Words:** A move-by-move review marking good moves, mistakes and blunders; Pass-and-play; The backgammon cube and match play; 6-max and 9-max poker tables with a hand replayer; Blank tiles and definitions in Words
- **Go 9×9:** 13×13 and 19×19 boards; A score estimate and territory overlay; A game review; Tsumego problems; SGF import and export
- **Rights, law and manuals:** Step-by-step checkers that end in a plain answer; Letters filled straight into Documents; His nation's rules chosen once; Sources and dates linked to legislation.gov.uk; Deadlines offered to his agenda
- **Morse:** A screen of its own on the LEARN tab; Farnsworth timing; Copy practice scored like the other drills; Decoding light and sound; A speed chart

## 3. Then new apps from your family, as many as stay whole and green

- **Language Path** (XL, like Duolingo, Babbel): A full course in any of thirty languages, Urdu included, with speaking, listening, stories and grammar, a few minutes a day.
- **Dictionary** (L, like Oxford Dictionary of English (Apple Dictionary), Merriam-Webster, Wiktionary): A proper dictionary everywhere in Ghosty: hold any word for meaning, sound, origin and translations, offline after one download.
- **Maths Solver** (L, like Wolfram Alpha, Symbolab, NumWorks): An algebra and scientific calculator that solves, simplifies, differentiates and integrates, explaining every step in plain words.
- **Graphing Calculator** (L, like Desmos, GeoGebra Graphing): Type any equation and see it graphed instantly, with sliders, tables, regressions and 3-D surfaces you can spin.
- **How Things Work** (L, like Animagraffs-style explainers, Engineering Explained): Engines, gearboxes, locks and turbines in 3-D you can take apart, slow down and have explained piece by piece.
- **Offline Libraries** (M, like Kiwix): Whole reference libraries on your phone with no signal: Wiktionary, Wikivoyage, iFixit guides, Stack Exchange, textbooks and more.
- **Card Maker** (M, like Quizlet Magic Notes, RemNote, Wisdolia): Turn anything into flashcards in one tap: a photo of notes, a chapter, a PDF, a lecture or your highlights.
