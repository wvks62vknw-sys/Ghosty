# BRIEF-SIDEWAYS — everything lands in the conversation, he brings things up himself, Home is his wall (batch ②, 1 Nov 2026)

Worktree from the branch tip (claude/ghosty-ai-training-idwhp9 at or after b2c2dd2). Your preview port: 8866. Read first:
HANDOFF.md from "- 31 Oct 23:00 UK" to the next "## " heading, OWNER-ISSUES 91, 92, 93 (b), 94 (a), 95; ROADMAP.md rows ② and
the upwards table. Another builder works on batch ① at the same time (the Abilities tab, `packages/shared/src/catalogue.ts`,
`apps/web/src/abilities/*`, `apps/edge/src/abilities.ts`, the Workbench's layout, `tests/abilities.spec.mjs`): do not touch
those files; put all your CSS in one new block at the END of `apps/web/styles.css` so the merge is trivial.

## The owner's words

"i feel like that's all just there and i have to ask for it to be activated but i want it to be there". "we should be moving
SIDEWAYS with the things we have in place". "he can speak first idm". The pattern he agreed: SHOW ME, DON'T TELL ME.

## What to build, in this order (a commit each)

1. LIVE CARDS IN THE CHAT. A card kit in `apps/web/src/features/core/cards.ts` that any reply or feature renders inline in the
   conversation: MAP (a place or route, the existing map code, static tiles already used by God's Eye or the Brief), THREE-D
   (a Studio scene inline, small, tap → the Studio with that scene), PERSON (one of the people he introduced in GUARDIAN:
   their day as the guardian already knows it, nothing predicted), CAR (a plate he named: make, colour, MOT and tax due from
   the public vehicle facts the `vehicle` tool group already fetches; when the key is missing, the card says which key and
   where in one line), ESTIMATE (a Workbench number as a card: the value, the one assumption, "first estimate, not
   certified"), LENS (what the camera just read), BRIEF (a piece of the day: rain, diary, a reminder), PROGRESS (School or
   GYM), PLACE (Home or Work saved, or an offer to save). Each card: a title of ≤ 4 words, one plain line, a visual, at most
   two buttons (OPEN → the screen and panel; ASK → puts a question in the box), ≤ 180 pt tall, VoiceOver reads title then
   line. The brain's reply envelope gains `cards: Card[]` built BY CODE from tool results in `apps/edge/src/agent.ts` (or
   wherever the reply is assembled: read `apps/web/src/assistant/session.ts` for the protocol first) — a place result → MAP,
   a vehicle result → CAR, an estimate → ESTIMATE, a foresee result → its existing card, never a model-written field. The
   plain prompt gains nothing (the guard is at 5,500 with 10 to spare; cards are code).
2. HE BRINGS THINGS UP HIMSELF — THE TRIGGER TABLE, in code, no model, in `apps/web/src/assistant/triggers.ts`:
   (a) from what you type or say: a UK plate (the DVLA format, spaces or not) → a CAR card offer ("That's a plate. Want the
   car?" → one tap; a plate he already named shows the card at once); a postcode or a saved place's name → MAP; the name of
   a person he introduced → PERSON; "tomorrow", a weekday, a time → the diary piece for it; a YouTube link, a receipt
   photo, a worry word → the existing offers of batch 4 (fold them into this table; one place for all of them). (b) from
   the camera: a Lens result posts its card into the chat too (a plate seen → CAR; a label or bill → the reminder offer;
   a person → the name the guardian knows or nothing). (c) from the day: Brief pieces post as BRIEF cards at their minute
   (the morning greeting with rain and the diary; a reminder; the car's MOT month; a flood or rail warning for a saved
   place) — these are the UNPROMPTED lines. (d) the cars he names: "my dad's car is RX15 KNG" (any plate with "my", "dad",
   a known person's name) → stored as a car fact in his memory by the memory tools (whose, plate, nickname), shown under
   that person in GUARDIAN → PEOPLE and on their PERSON card; cars are only ever his or those of people he introduced;
   public vehicle facts by plate only, never anything about a keeper.
3. SPEAK FIRST — THE CADENCE, in `packages/shared/src/cadence.ts` (pure, tested): at most four unprompted cards a day
   across chat, push and Telegram together (the guardian's danger warnings do not count and are never held); never two
   within two hours unless danger; nothing between 23:00 and 07:00 unless danger; any stop word silences the rest of the
   day; a dial in SETTINGS → CHARACTER: QUIET (danger only) · SOME (the default, four) · CHATTY (eight). Every unprompted
   line is recorded so WHY and "what did you do today" list it with its reason.
4. HOME AS HIS WALL. The Home screen (`apps/web/src/shell/hubcards.ts`, `areas.ts`, `launcher.ts`: read them first) shows
   THE WALL above the deck: the live cards in order of what matters now, by a pure `wallOrder(cards, now)` (danger first,
   then what is due within two hours, then today's pieces, then the people's and cars' news, then progress), capped at six
   with MORE; the deck stays below and ALL SCREENS stays one tap. An empty wall says one line in his voice, not a grid of
   nothing. Nothing on the wall needs a model to draw.
5. TELEGRAM AND PUSH carry the same cards as text (title · line · the deep link), through the existing channels, under the
   same cadence.

## The lines that hold

No prediction about any person; a PERSON card shows only what the guardian already shows for people he introduced; no
private person searched for; a plate gives vehicle facts only (the DVLA/DVSA tools as they are; no new API, nothing that
bills); the brain never gets live GPS (saved places only); the plain prompt gains nothing; no test skipped or weakened;
`.github/workflows/check.yml` only gains your spec's name in the smoke loop after `brief`; no model names anywhere.

## Tests

Node: the trigger table (plates in every spacing, postcodes, names, times; and what must NOT trigger: a random word, a
stranger's name), the card mapping from tool results, `cadence` (the cap, the gap, the night, the stop word, the dial),
`wallOrder`. Spec `tests/cards.spec.mjs` on your preview: a plate typed → CAR card with the key line; "my dad's car is
RX15 KNG" → stored, the PERSON card for Dad shows it (if Dad is not an introduced person in the spec's fixture, introduce
one first the way `guardian.spec.mjs` does); a saved place's name → MAP; Home shows the wall in order; a BRIEF card posts
at its minute with the clock stub; the stop word silences the day; the dial changes the cap. Keep `hubcards`, `deck`,
`nav`, `brief`, `eye`, `guardian`, `lens` green.

## Working lean (credits are the constraint this week)

Read only the files named and what they import; `sed -n` ranges and `grep -n`, never whole-file cats of big files; test
output through `tail -30`; the full brain suite ONCE at the end (`nice -n 10`), per-file tests while you work; write each
new file whole in one go; no narration; one report. Validation: brain typecheck + suite; web typecheck + build; specs on one
fresh preview in this order: websites, apps, hubcards, cards, deck, nav, brief, eye, guardian, lens.

## The report (one message)

Base SHA, HEAD SHA, the worktree branch; commits in order; files changed; validation numbers; LIMITS; DESIGN PICKS THE OWNER
MAY CHANGE (card names, the cap, the dial words, the wall's order); NEEDS HIS PHONE OR HIS WORDS; WHAT THE MERGE MUST KNOW
(protected files touched, each marked; anything batch ① will have to add to its catalogue: list your new registry items).
