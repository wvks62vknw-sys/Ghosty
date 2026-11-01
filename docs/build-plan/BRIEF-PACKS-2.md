# BRIEF-PACKS-2 — the PEOPLE, WORK and CREATIVE packs (batch ④ part 2, 1 Nov 2026)

Worktree from the LOCAL tip of claude/ghosty-ai-training-idwhp9 (at or after 0ea2e8d; never reset to FETCH_HEAD or origin,
only to the local branch). Your preview port: 8766. THE PATTERN IS SET: read BRIEF-PACKS-1.md and OWNER-ISSUES 105 (what was
built and how), then the money pack end to end as your template — `apps/edge/src/tools/money.ts`, `apps/edge/src/packs/
{base,index}.ts`, `packages/shared/src/{packs,money}.ts`, `catalogue/packs.ts`, `apps/web/src/features/money/sheet.ts`,
`apps/web/src/assistant/packs.ts`, `apps/edge/test/money.test.mjs` + `test/packs-kit.mjs`, `tests/packs.spec.mjs` — and copy
its shape exactly: one tool a pack with an `action` enum, `short: '<name> pack'` on the group, read actions allowed for
scheduled tasks and project steps and write actions not, a catalogue entry per action (`act:<pack>:<action>`), a sheet
over the current screen (not a tab), no-model phrases in `assistant/phrases.ts` pointing at the entries, fixtures from real
public responses. Other builders run in parallel (the arcade, three games, the car): touch nothing under `arcade/`,
`features/arcade/`, `car/`, `features/studio/`, `features/core/cards.ts`. Yours: `tools/{people,work,creative}.ts`,
`packages/shared/src/{people,work,creative}.ts`, `catalogue/packs2.ts` (joined where packs.ts is), `features/{people,work,
creative}/sheet.ts` (+ helpers), your phrases, `apps/edge/test/{people,work,creative}.test.mjs`, `tests/packs2.spec.mjs`,
the CI smoke loop's list (`packs2` after `packs`), `apps/edge/package.json`'s test list, a CSS block at the END of
styles.css, and the prompt trims below.

## The owner's words

"people is good / work is good / creative is good". Twelve to twenty REAL abilities a pack: quality before count, each
tested, each with its catalogue entry; say the count per pack in the report.

## The one hard constraint: the plain prompt is at EXACTLY 5,500 on the worst dial (telegramVoice)

Each pack's off-state line adds its two words (+"people pack" etc., about 11–13 characters each). TRIM EXACTLY what each
pack needs, at that pack's commit, nowhere else, and list every trimmed line before and after in the report. The prompt
test (`apps/edge/test/prompt.test.mjs`) is the gate; run it after every prompt change. Prefer trims that lose no meaning
(a doubled word, "in order to" → "to", a parenthesis the model does not need).

## PEOPLE (from what he tells Ghosty; nothing searched for, no social media, no private person profiled)

Birthdays and dates he gives (a reminder a week before and on the day, a gift idea from what he has said about them — kept
on the phone's memory line for that person), GIFT IDEAS from those notes with a rough price, a MESSAGE IN HIS VOICE for an
occasion (the model writes it from his own past messages' tone where he has shared them, else plain; always shown first,
never sent by itself), WHO'S WHO (the people he introduced: how he knows them, what he last said about them), "remind me
to call Dad Sunday" (a reminder with the person on it), a THANK-YOU note, a card's words, splitting a group's plans
(where, when, who said yes — from his words), a contact's details he gives (phone, address) kept and recalled, the
guardian's people shown with their cars (read-only, from ②). Twelve or more. Never anything about a person he did not
introduce; never a lookup of a person.

## WORK

A CV from what he tells and pastes (sections, plain and honest, as a document he can copy or share; never invented facts),
a COVER LETTER for a pasted job ad (his facts only; the gaps said), INTERVIEW PRACTICE (common questions for the role,
his answer timed by voice, a plain critique: length, specifics, filler words), a MEETING SUMMED UP from pasted notes or a
voice note (decisions, actions, who), a TO-DO from a long message, an EMAIL IN HIS VOICE (shown, never sent on its own),
a timesheet from his hours, PAY after tax (UK bands, said as a first estimate), a POMODORO with his timers, "what did I
say I'd do" from his own notes, a plain WORD COUNT and reading level for a pasted text, a SHIFT ROTA he types kept and
shown in the Brief. Twelve or more.

## CREATIVE

A SONG WITH A MELODY (lyrics by the model from his words; a melody and chord progression generated in code and played on
the phone's synth from the kitchen/arcade's audio pattern, with a key and tempo he can change; shared as a small
downloadable WAV or MIDI), a STORY IN HIS VOICE (from a prompt and his tone), a POEM, a POSTER (a laid-out page from his
words with a free font, exported as PNG), a COMIC STRIP (four panels: our own simple art in code — shapes and stick
figures with expressions — with his words as captions; said to be that), a BIRTHDAY CARD, a NAME GENERATOR (a band, a pet,
a team), a RHYME finder, a palette from a photo (the Lens's colours), a LOGO sketch in simple shapes, a DRAWING PROMPT a
day, a BEAT (a drum pattern he taps in, looped). Twelve or more. No copyrighted art, lyrics or music ever reproduced.

## The lines that hold

Only his own words and data and public keyless sources; nothing that bills; no message or email is ever sent by itself
(shown, then his tap); no person is ever looked up; the plain prompt ≤ 5,500 on every dial; no test skipped or weakened;
the guard job untouched; no model names anywhere; every new thing has its catalogue entry; the mock model is extended for
the specs where a pack line is needed (as the existing specs do), never the real one.

## Tests

Node per pack with fixtures (a pasted job ad, a pasted meeting note, a CV's facts, a birthday list; the melody generator's
determinism per seed; the pay bands; the poster's layout bounds), the prompt test for the three groups' on and off states.
`tests/packs2.spec.mjs` on your preview: a birthday kept and its reminder, a cover letter shown from a pasted ad (the mock
model's line), interview practice's timer and critique, a melody played (the audio context started by the tap; a WAV
offered), a poster exported as PNG, a comic strip drawn; nothing sideways at 390 × 844; VoiceOver labels. The catalogue
test green with your entries.

## Working lean

Ranged reads; `tail -30`; the full brain suite once at the end under `nice -n 10`; write each new file whole; no narration.
Validation: brain typecheck + suite; web typecheck + build; on one fresh preview: websites, apps, abilities, packs, packs2,
deck, nav, brief.

## The report (one message)

Base SHA, HEAD SHA, the worktree branch; commits; files; validation numbers; the count per pack and the list; every prompt
line trimmed (before/after) and the plain prompt's size on the worst dial; LIMITS; DESIGN PICKS THE OWNER MAY CHANGE; NEEDS
HIS PHONE OR HIS WORDS; WHAT THE MERGE MUST KNOW.
