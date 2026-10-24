# Courses (OWNER-ISSUES 6): "full, proper courses to study from Ghosty, way better than now"

What exists: the tutor (`apps/edge/src/tutor.ts`: "teach me X" plans 5–12 lessons from the library and Wikipedia, each
lesson written on first open with an explanation, a worked example and a check question from cited passages; quizzes;
wrong answers become SM-2 flashcards; one cheap model call per plan, lesson, quiz or graded answer; outline-only with
no model), the `tutor` tool (`tools/learn.ts`, `open_learn`), the shared types (`packages/shared/src/learn.ts`,
`sm2.ts`), the LEARN tab (`apps/web/src/features/learn/index.ts`, mirrored offline in `store.ts`: courses with a
progress ring, a course as a map of stops, lesson, quiz, revise) and `tests/learn.spec.mjs`. Read BRIEF-W0.md, MAP.md,
all of those, and PLAN.md's "Courses" line. The owner is non-technical; everything free; every number honest.

## Build: what "way better" means here
1. **A real course plan**: "teach me X" (or START A COURSE) makes a syllabus of UNITS (2–5) each with LESSONS (up to 20
   in all), prerequisites in order, the level (the existing levels), and pacing from minutes a day ("3 lessons a week,
   done by 14 November"); the plan is one cheap call as today, or outline-only offline. Big topics get the units; a
   small topic stays one unit.
2. **Lessons with structure**: WHY IT MATTERS (one line), THE IDEA, TWO WORKED EXAMPLES (step by step), COMMON
   MISTAKES (two lines), TRY IT (the check question), IN ONE LINE (the summary that becomes a card); still one call per
   lesson, still cited [n] from passages, still kept so it is never paid for twice; read aloud as today.
3. **The course map with mastery**: each stop shows its state (not started / read / quiz passed / mastered: quiz ≥ 80 %
   and its cards not due), the unit headers, the course's mastery % in the ring, the next stop lit, and a REVISE 10
   button when cards are due. Mastery is computed in a pure shared function with tests.
4. **Exam mode**: per course, EXAM: 10–20 questions drawn from every lesson's quiz pool (marked exactly where possible,
   the rest as today), a visible timer (the course's level sets it), no feedback until the end, then the grade (the
   percent bands from `packages/shared/src/school.ts`), the weak lessons named with a REVISE link, and the result kept
   on the map. The timer never cheats: a left exam resumes with its time.
5. **A confidence meter**: before each quiz and exam answer is revealed, SURE / THINK SO / GUESSING (three taps, 44 pt);
   the course map's CALIBRATION line says how often "sure" was right ("Sure and right 8 of 10"); a confident wrong
   answer makes a card due sooner (SM-2 quality 1), a guessed right answer still makes a card.
6. **Cards from every lesson**: IN ONE LINE becomes a card when a lesson is read (not only wrong answers); REVISE 10 on
   the map and the daily due count stay as today.
7. **Offline and honest**: everything mirrored on the phone as today; with no model free, the plan is the outline, a
   lesson the passages, the exam the check questions; the words always say which.

## Tests (each must fail on the old code)
Edge: the syllabus builder (units, order, pacing dates in Europe/London), the exam pool draw (every lesson represented,
no repeats, the timer by level), mastery and calibration (pure), the lesson structure parsed from a model reply and the
outline fallback, SM-2 with the confidence qualities. Browser: `tests/learn.spec.mjs` extended at 440 × 956: a course
with units on the map, a lesson's six parts, the confidence taps on a quiz, EXAM with a faked clock (start, leave,
resume with the same time, finish, the grade and weak lessons), REVISE 10. Then `npm run check`, the edge tsc, the full
edge `npm test` once (about 18 minutes), the learn and deck specs.

## Finish
Commit per step on the worktree branch (do not push, do not merge). Report: files, the syllabus for "teach me the stock
market" and "teach me algebra" as made, screenshots of the map, a lesson, the exam and its result, every check's
exact result, anything not done and why.
