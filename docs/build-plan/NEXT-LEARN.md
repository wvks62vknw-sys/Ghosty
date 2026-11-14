# NEXT ROUND · THE LEARN LANE (14 November)

I lead the big move **Learning that adapts and talks back**: courses aim at the questions you got wrong, the shelf fills with
free classics, and lessons can be heard, quizzed and argued with out loud. Everything is checked by the `learnlane` spec, at
440 × 956 and 390 × 844, and by brain tests.

## What I built

### 1 · The next round
- **Courses that pick up your mistakes** (`learn.u2`).
  - Every answer now keeps how sure you were.
  - Each course's map has a **TODAY** card. It names the lesson your recent answers say to look at again, and says why. For
    example: "Lesson 2 again: 1 answer you were sure of but missed in your last answers there."
  - Your misses are weighted:

    | Kind of answer | Weight |
    | --- | --- |
    | A miss you were **sure** of | 3 |
    | A miss you **thought** right | 2 |
    | A miss you guessed, or one with no confidence marked | 1 |
    | A lucky guess (right, but guessed) | 1 |

  - **LESSON n AGAIN** opens that lesson. **QUIZ ME ON MY MISSES** quizzes you on just the lessons you missed, most needed
    first.
  - With nothing missed, the card says so. With every lesson read and nothing missed, it points you to the exam.
  - It is worked out on the phone, so it works with no signal.

### 2 · Moved back by a skeptic, built in its safe form
- **The free classics shop** (`learn.u6`). In the Library, under ADD, a new **CLASSICS** panel offers:
  - Project Gutenberg's most read books, and a search by title or author. These come through Gutendex, which is free and needs
    no key.
  - **NEW FROM STANDARD EBOOKS**: their 15 newest books, from their open feed. Each shows its free Gutenberg edition where there
    is one, and a link to read it on Standard Ebooks' own site.

  Standard Ebooks' paid catalogue is never used. Nothing is listed until you tap **SHOW THE FREE CLASSICS**. Tapping a book
  looks up its size first, and the key says it, for example **ADD TO MY SHELF · 772 KB**. The book comes on Wi-Fi. On mobile
  data, or on a phone that can't tell which it is on, a second tap within 20 seconds is your yes. Ghosty reads the book in a
  part at a time, and it lands on your shelf.

### 3 · What was half done
- **School: official papers and question banks.** Key Stage 3 to university no longer wait for their question banks to finish.
  Once a subject has 12 or more checked questions, it gets a shorter **practice paper** drawn from them. It is marked like any
  other paper, but it is never counted as top grades, so it can't pass a stage. Every line says so.
- **School: reading shelf and borrow.** The reading check is now sat online by Ghosty's own model, in full working, when there
  is signal. Borrowing no longer waits for the brain on your phone. The phone's brain sits it only with no signal.
- **School on the free GPU.** It already says plainly that it needs your Kaggle key and Hugging Face token in SYSTEM → KEYS, so
  I left it as it is.
- **Walk.** My earlier map got this one wrong: I called it "a walking route". It is actually **walk me through it**, the guided
  tour of any screen, and it is already whole. So there was nothing half done to finish. The map file now says what it really
  is.

### 4 · Soon
- **Bedtime listening** (`learn.u5`). In the reader's Reading panel, a new **LISTENING** section has:
  - **Speed:** the phone's voice at 0.8×, 1×, 1.25× or 1.5×.
  - **Sleep timer:** off, 15 or 30 minutes. It stops at the sentence it's on and says where it got to, so your place is kept.
  - **A voice for each book:** chosen from the phone's English voices, and kept per book.
- **Speaking practice in another language** (`learn.s2`). In Rehearse, **THE LANGUAGE** picks English or one of eleven others:
  Spanish, French, German, Italian, Portuguese, Dutch, Polish, Arabic, Chinese, Japanese and Hindi.
  - The other side speaks only that language, simply, at a learner's level.
  - It is said aloud in the phone's own voice for that language, and it hears you in it.
  - After the third round you get gentle notes in English: what came across, and up to three phrases to say next time.
- **Quiz night** (`learn.s10`). **QUIZ NIGHT** under COURSES lets Ghosty host a quiz at the table, for two to six players.
  - The questions come from your own courses, so it works with no signal.
  - Each question is shown big and read aloud. Tap whoever got it right first, or NOBODY, and the answer is shown.
  - The scoreboard keeps count, and at the end it names the winner or a draw.
- **Scan a book to add it** (`learn.c1`, with `lens.s11`). A book's barcode in the Lens now offers **ON MY SHELF**:
  - The book goes on your reading list in the Library: its details only, nothing downloaded.
  - The free classics are searched for a free copy, which you add the usual way.

### 5 · Later (built)
- **Worked answers you can study** (`learn.u1`). Every paper has **STUDY THE WORKED ANSWERS**:
  - One question at a time. Then, when you tap, Ghosty's own working (in full when it was sat online), the right answer and the
    mark scheme.
  - Mark each one **GOT IT** or **STILL LEARNING**. The ones still to learn come first next time.
  - Booklets are kept on this phone only and listed under RESULTS.
- **Your speaking, week by week** (`learn.u12`). Each one-minute talk in Rehearse now keeps only its numbers on this phone: pace
  and filler words, never what you said. A chart shows the last eight weeks, with one line on the change since your first week.

- **One map of everything you know** (`learn.u3`). **MY LEARNING MAP** on COURSES shows one picture, drawn from what the phone
  already keeps:
  - a bar for each course's mastery;
  - your reading (books read to the end, ones part way);
  - your speaking;
  - your revision booklets.

  It also names the one thing to try next: the lesson your misses point at, or the book you're furthest into.
- **Highlights and notes in your books** (`learn.u4`). Select a sentence in the reader and tap **HIGHLIGHT**, or **HIGHLIGHT AND
  NOTE** to add your own words. The words stay marked. ABOUT lists every highlight with where it is, and a tap takes you there.
  **EXPORT NOTES** gives them all as one Markdown file, and **COPY NOTES** copies them. They are kept on this phone.
- **Debate practice** (`learn.s8`). In Rehearse, choose **A DEBATE** under WHAT KIND and give your side. Ghosty argues the other
  side for three rounds, then gives your strongest point, your weakest, and one thing for next time.
- **Book club and spoken summaries** (`learn.s5`, `learn.s6`). The reader's CHAPTERS gains:
  - **BOOK CLUB ON THIS CHAPTER:** three questions from the chapter's own words, and a short talk about your answers.
  - **SUMMARY ALOUD:** about a minute's summary, shown and read out.
- **Revision days up to an exam** (`learn.s12`). Under Learning's PLAN, give the exam, its date, a time and a session length.
  - The sessions are listed first: every other day at first, every day in the last week, none on the day itself.
  - **ADD** puts them in your days, each with a reminder ten minutes before. It is the brain's own reminder, so it reaches a
    locked phone.
  - **TAKE THEM OUT** removes them.
- **Driving theory and trade courses** (`learn.s3`, `learn.s4`). START A COURSE has four ready starts: driving theory from the
  public Highway Code, car mechanics, home electrics and first aid. A lesson on mechanics, electrics or building says every
  figure is a first estimate, never certified, and to use a qualified person for anything dangerous.
- **Quiz me aloud, hands-free** (`learn.c6`). **QUIZ ME ALOUD** under COURSES asks your own course questions aloud and hears your
  answer: a letter, "the second one", or the answer's words. It says whether you were right, then moves on. A big STOP ends it.
  It runs with no signal, and nothing you say is kept.
- **Memory palace** (`learn.s7`). Under Learning's DRILLS, MEMORY has a **MEMORY PALACE**:
  - Put each thing to remember at a place on a walk through your home, and picture it there.
  - Then walk back and say what is at each place. It is scored and logged with your streak.
  - Your places stay on this phone.
- **The Gym's chip line tells the truth** (`learn.u10`). It now says: "TIME IT trains on the graphics chip (WebGPU); the long
  training runs on the processor."

## Fixed this round
- **The learn spec's lost quiz card.** It was a race: a sync already on its way brought back the brain's copy from before the
  third answer's card, and replaced the phone's cards with it. A card kept on the phone after that copy was asked for now stays.
  The spec also waits until both cards are kept, then checks them as strictly as before. It is proved by 5 runs in a row, and 2
  more with the CPU slowed 4× (`CPU_SLOW=4`).
- **learnpass C1.** The ready starts sit in their own group, so the START row holds only START.

## How to try it on your phone
1. **Courses.** Open a course you've quizzed in. Under the summary, the TODAY card names a lesson. Tap **QUIZ ME ON MY
   MISSES**.
2. **Classics.** Open LIBRARY, then **Add**, then **SHOW THE FREE CLASSICS**. Tap *Pride and Prejudice*: the key shows its
   size. Tap it on Wi-Fi and the book lands on your shelf.
3. **Practice papers.** In SCHOOL, pick Key Stage 3 under PLACEMENT. Subjects whose banks have 12 or more questions say "a
   practice paper from the … questions checked so far".
4. **Worked answers.** In SCHOOL, open RESULTS, open any paper, then tap **STUDY THE WORKED ANSWERS**.
5. **Bedtime listening.** Open a book, then the reading settings. Under **LISTENING**, pick 1.25× and 15 min, then LISTEN.
6. **Language practice.** In REHEARSE, set THE LANGUAGE to Spanish, type "ordering a coffee in a café", and press START.
7. **Quiz night.** In COURSES, tap **QUIZ NIGHT**, type two names, and press START THE QUIZ.
8. **Scan a book.** In the Lens, point at a book's barcode, then tap **ON MY SHELF**.

## What is left (listed, not built)
- **Puzzle of the day in the Brief** (`learn.s9`). The PLAN lane is building the Brief's one line per room this round. The
  puzzle joins it once that has landed, so the two don't collide.
- These were not reached this round:
  - `learn.u7` phrasebooks per country in Interpret, and kept conversations
  - `learn.u8` offline translation packs
  - `learn.u9` the Gym explaining its moves
  - `learn.u14` (done above, as the reading check sat online)
  - `learn.u15` weekly lab re-runs
  - `learn.s11` sign language
  - `learn.c3` games you make in the Gym
- **The specialist sweep against Duolingo, Khan Academy, Anki, Apple Books, Kindle, Lichess, Brilliant and Speak.**
  - Done this round:
    - Mistake-driven review (Anki, Duolingo)
    - A free-books shop (Apple Books, Kindle)
    - Sleep timer, speed and a voice per book (audiobook apps)
    - Speaking practice in another language (Speak)
    - Worked solutions (Khan Academy, Brilliant)
    - Progress charts (Speak)
    - Highlights and notes with export (Kindle)
    - A mastery map (Khan Academy)
  - Next:
    - Move explanations (Lichess)
    - Streak freezes and daily goals (Duolingo)
