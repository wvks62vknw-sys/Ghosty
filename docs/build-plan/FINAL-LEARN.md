# FINAL ROUND · THE LEARN LANE (13 November)

The lane covers courses (learn), learning, the library and its reader, SCHOOL (and its brain), the GYM, the arcade, the coach,
rehearse, the lab, the interpreter and further. Its spec is `learnlane`, the last word of check.yml's `all=`.

## What was wrong

**SCHOOL's brain.** You said: "the school still uses the smallest brain which answers in like multiple choice or something i
think". You were right. SCHOOL was built as "the offline brain goes to school", so every paper was sat by the small model on
the phone. A bigger brain was given shorter answers, and multiple-choice questions said "Answer with the letter". Nothing
better ever sat a paper, even with signal.

**The other screens.** Three read-throughs of every screen in the lane found about 60 problems, the worst first:
- A book or a game could download on mobile data on your iPhone. The phone's browser cannot tell Wi-Fi from mobile data, and
  the code took "can't tell" to mean "Wi-Fi".
- Some keys did nothing:
  - REMOVE FROM LIBRARY did nothing when the reader was opened by voice or a link.
  - The arcade's PAUSE did nothing while a game was starting, so a slow start trapped you.
  - The maths drill's SKIP and STOP did nothing before START.
  - Rated chess's − and + stopped working after a game.
  - HOLD TO SPEAK showed in browsers that cannot hear.
- Some lines were not true:
  - The GYM said "nothing learns here" on a screen about learning.
  - A failed move said to tap PLAY AGAIN when the key reads NEW GAME.
  - The reader promised "tell me what happened and I'll say it here", which nothing does.
  - The names drill said "kept on this phone only, and sent to your brain".
  - The plan said "ten minutes a day" next to a minutes box.
  - The bird diary said "where you were stays on this phone" beside a map link.
  - The quiz said "the misses are now flashcards" even when the answers never arrived.
- Some errors showed raw text: the GYM's worker error, the library's study error and the mind map's error. Many failures also
  said "I could not open that" whatever had failed. SCHOOL showed HTTP numbers.
- Some keys were 40 pt instead of 44: the reader, rehearse, the lab and the interpreter.
- At the biggest text, the GYM's card names were cut off with "…".
- The library used three hard-coded colours.
- The interpreter showed only the last four lines. A translation that arrived after you left was still said aloud.
- With service workers blocked, the push setup crashed the page.

## What I made

**SCHOOL now uses the best brain.**
- With signal, each question goes to the brain's own model. That is the one it picks for its best work, the same choice as
  your chat.
- Every answer is written out in full working: each step, then one last line, "Answer: …".
- A multiple-choice question is still answered with its letter, because the paper itself is multiple choice, but only after
  the working.
- The working shows live on the screen as it is written. It is kept with the paper and marked the same way: exact answers by
  the code, written ones by the marker against the mark scheme.
- The result says it was sat "online, in full working" and names the model that sat it.
- The phone's brain sits a paper only when there is no signal, or when no online model answers in time. It carries on the
  same paper from the question it reached.
- The screen says in one line who sits the papers, and who would with no signal. The line updates as signal comes and goes.
- Full working that runs long never loses its answer line, so the code can still mark it.
- The chat's `sit_exam` tool, the tooltips and the "not on this phone" lines all say the same thing.

**Every other screen in the lane:**
- **Downloads.** On a phone that cannot tell Wi-Fi from mobile data, the first tap on a book or a game says so, with its size.
  A second tap is your yes.
- **Interpreter.** The whole conversation stays on screen. A translated line is a key that says it again for the other person.
  A browser that can't hear opens the typing line instead of showing a dead key. "One moment: still translating" is said. A
  failure is shown on the half it came from.
- **GYM.** It says "Reading what I've learned…" while your records load, so they never look wiped. KEEP AWAKE says when the
  phone refuses. It no longer contradicts itself and no longer shows raw worker text. An empty secret is said beside the box. The
  rated chess keys work after a game, and RATE ME says when it fails. Card names wrap at the biggest text.
- **Arcade.** PAUSE gets you out of a slow start. A failed start shows the way back. A failed delete and an unreadable MY GAMES
  are said.
- **Library.**
  - REMOVE works from any way in.
  - No raw study error, and its colours are tokens.
  - EXPORT and READ MY OWN CODE name what failed.
  - FRESH TODAY says you're offline instead of telling you to tap a key that is switched off.
  - The self-study switch keeps the panel when it fails.
  - The reader's screen-lock line keeps no promise it can't keep.
- **Learning.** The first photo read says its download (about 6 MB, from Ghosty's own site) and, on mobile data, asks for a second tap. Speed reading can't run two passages at once. The reading quiz scores once. SKIP and STOP show only during a drill. DONE says why it waits. The privacy line
  and the plan line now say what they do.
- **Courses.** The course list says ON THIS PHONE when it is offline. The quiz no longer claims flashcards it couldn't make. When another course's exam is open, RESUME THAT EXAM
  takes you to it.
- **Rehearse and the coach.** They name what failed ("hear you", "play the other side"). The coach's tuner page no longer
  offers "typing test".
- **Mind map.** A half-read memory is said, with TRY AGAIN, instead of "I don't know anything about you yet".
- **Every key in the lane is 44 pt.**

**Proof.**
- Four new brain tests in `school.test.mjs` cover:
  - the best tier and the full-working prompt;
  - the answer being kept and the result recorded online, by name;
  - a multiple-choice question worked out before its letter;
  - the answer line kept through a trim;
  - "no model answered in time" handing over to the phone;
  - the phone's online loop.
- The full brain suite passes: 2157 tests.
- `learnlane.spec` checks, at 440 × 956 and 390 × 844:
  - SCHOOL sits a paper online: the line says who sits it, the working shows live, the phone's brain is never loaded, and
    every answer is kept in full working, marked and recorded online by name;
  - with no signal, the phone brain's line is back;
  - every screen in the lane has nothing sideways, 44 pt keys and no raw text;
  - nothing is cut at BODY 21;
  - SCHOOL works in all seven looks.
- The specs that test the phone's own sitting now run with no signal to the online model: sit, school, bigbrain and learnpass.
  They check exactly what they did before.

## How to try it on your phone
1. Open SCHOOL with signal. Under THIS STAGE it says: "I sit papers on my own online model, every answer in full working.
   With no signal, on … on this phone."
2. Press SIT next to a subject. The box under the progress bar shows each answer as it is written: the working, then
   "Answer: …".
3. When it is handed in, open RESULTS and press SEE THE PAPER. It says "sat … online, in full working" and names the model.
   Every answer has its working.
4. Turn on aeroplane mode and open SCHOOL again. The line now names the brain on the phone.
5. In the library, on your iPhone, tap KEEP ON THIS PHONE for a book. It tells you it can't tell Wi-Fi from mobile data and
   gives the size. Tap again to fetch it.
6. In the interpreter, tap a line the other person missed, and it is said again.

## What is left
- The GYM's TIME IT line says "Training on the graphics chip". The timing does run there, but the long training runs on the
  processor. That line is locked by the phone-hardware spec, so I left it.
- These were found and not done:
  - Rehearse keeps your rehearsals but has no list to reread them.
  - The interpreter has no copy key.
- Making each screen into a full rival of the best dedicated app was more than one afternoon. This round made every screen
  keep its word. A deeper rebuild of each one is the next step.
