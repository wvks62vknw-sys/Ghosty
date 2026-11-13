# BRIEF: DEPTH 1b — MEMORY AND RECALL (he remembers the week's conversation, finds what you asked by meaning, holds a chase for days, and indexes your own things on the phone)

BRIEF-DEPTH-MEMORY (PLAN-STARS pass 1b; STARS 4 "he remembers the whole conversation of the day, and last Tuesday's, and says 'like you
said on Tuesday'", 17 "'What did I ask you about X?': recall by meaning across every channel, instant", 19 "he holds a multi-day task
('remind me to chase this if they don't reply by Thursday') without being babysat", 26 "his own documents, photos' text, messages and notes
indexed and searchable by meaning, on the phone"; OWNER-ISSUES 178 "insane quality", 184's WHATS-LEFT list 4 "the depth plan, pass by pass:
memory and recall"). The mid tier. One builder, one PR. Starts from the session branch's head AFTER POLISH 3 and QUALITY PASS: PLAN AND ME
are on main (the one watcher system and MEMORY's words are then in the tree); if KERNEL 3 is in too, the new brain test is named in the test
list, else it is reached by one import line as today's are. Read STANDARD.md, STARS.md 3 to 26, THE-GUIDE-11-NOV.md, the code this builds on and
does not replace: apps/edge/src/mind.ts (THE ONE SHARED MIND: `observe`, episodes, `mindSnapshot`), memories.ts (the TIMELINE, lock, forget
with undo), profile.ts (the profile and the DIARY), context.ts (what the model is given: the budgets; `trimContext` drops old turns from the
model's context), prompt.ts (`contextLines`; prompt.test's ceilings), tools/memory.ts (`remember`, `forget`, `forget_everything`,
`list_memory`: this file is NOT protected and its list is where a new memory tool goes), projects.ts and schedule.ts (the multi-day
projects and the alarms), the watchers (LIFE EASIER's, made one system by POLISH 3 item 5: apps/edge/src/… as that brief names), the mail
integration (integrations/mail.ts: what LIFE EASIER sorts into the Brief), library/store.ts (FTS5 and the optional embeddings on the brain),
packages/shared/src/meaning.ts and apps/web/src/offline/embed.ts (the phone's own 384-number meaning model, already vendored, already used by
apps/web/src/library/idle.ts to index the library at idle), apps/web/src/features/memory/{index,timeline}.ts, tests/memory.spec.mjs,
tests/projects.spec.mjs, apps/edge/test/context.test.mjs and profile.test.mjs. THE QUALITY RULE holds.

## His words
STARS 4, 17, 19 and 26 above; and the rule: "only my own data … no prediction about any person … faces and voices only me and people I
introduce, kept on the phone". Everything here is HIS OWN words, things and messages, recalled for him; nothing is inferred about anyone else.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. The prompt guard's ceilings (prompt.test)
hold: every line this adds to the prompt is measured and paid for by shortening elsewhere within the same ceiling, never by raising it. No
package; no model vendored (the phone's meaning model is already there; nothing is fetched that is not fetched today); no new key; nothing
leaves the phone that does not leave it today (the brain already holds the turns; the on-phone index never leaves the phone).

## What is built

1. **THE WEEK REMEMBERED IN REPLIES (STARS 4).** The brain's episodes (`observe`, mind.ts) already keep a gist of every turn with its channel
   (app, Telegram). Now: (a) every turn's gist is kept for at least 30 days (the cap today, if lower, raised to that and said in the report;
   locked memories untouched); (b) `mindSnapshot` gains RECALL: the day's turns' gists and, for the last seven days, the ones that match the
   current ask by words (FTS over the gists on the brain, no model) and, when Workers AI is connected, by meaning; (c) prompt.ts renders
   RECALL as at most four lines, each "On Tuesday you asked about X and I said Y" with its date word ("today", "yesterday", "on Tuesday", "last
   week"), within the ceiling (measured before and after; another block shortened by the same count if needed); (d) the reply may say "like
   you said on Tuesday" and, when it does, the line is a tap (the chat pass's cards: a RECALL chip opens that turn in the log, or MEMORY's
   timeline when the turn is gone from the log). Telegram's turns count the same. Nothing about anyone but him is written into a gist beyond
   what he himself said.
2. **"WHAT DID I ASK YOU ABOUT X?" (STARS 17), ON THE PHONE FIRST.** (a) The phone keeps every turn it has seen (the log already does; the
   brain's /history fills gaps after a reinstall) and indexes each turn's text by meaning at idle with the phone's own model (library/idle.ts's
   pattern, one more source: `turns`), in IndexedDB, never sent anywhere; (b) a question of that shape ("what did I ask you about X", "when
   did I mention X", "did I tell you about X", "find where I said X") is answered on the phone with no model and no network, under a second
   after the index is warm: a RECALL card listing the matching turns with their day words and channel ("Tue 10 Nov · Telegram"), each a tap
   into the log or the timeline, the best three first, "nothing like that" said plainly when nothing matches; aeroplane mode changes nothing;
   (c) the same question to the brain (typed in Telegram, or when the phone's index is cold) is answered by a new `recall` tool in
   tools/memory.ts (words over the gists and the library's FTS; meaning when the brain has embeddings) returning the same shape, its
   description within the ceiling; (d) MEMORY's search box takes the same questions and shows the same card (the PLAN AND ME pass's words
   stand).
3. **A CHASE HELD FOR DAYS (STARS 19).** "Remind me to chase this if they don't reply by Thursday", said over a mail the Brief showed, or
   over his own sent note: a watcher of the one system (POLISH 3's) of kind `reply`: the thread, the person (his own correspondent, named by
   him), the day; Ghosty says once what it will do ("If nothing comes from Sam by Thursday 9 am, I'll remind you to chase it."); the alarm
   (schedule.ts) checks the thread on that morning through the mail integration already connected (nothing new fetched, nothing read that the
   Brief does not read), and either says "Sam replied on Wednesday; nothing to chase." or raises the reminder with the thread's one line and a
   DRAFT A CHASE key (a draft for his OK, the mail rule as LIFE EASIER left it: SEND needs his confirm). Without a mail account linked, the
   watcher is a plain dated reminder and says so when set. PLAN → WATCHERS lists it with STOP; "what are you chasing?" lists them. No person
   is profiled: the watcher holds a thread id and the name he used.
4. **HIS OWN THINGS INDEXED BY MEANING ON THE PHONE (STARS 26).** The on-phone index of item 2 takes, at idle and only on the phone: the
   editors' kept documents, spreadsheets' cell text, decks' text and workspace pages (their stores' text, by title and paragraph), the Lens's
   and the scanner's read text already kept on the phone (scan/page.ts's pages, the Lens's READ results where the app keeps them), his notes
   and the library's items it already indexes. FIND (the jump bar's third word or more, and MEMORY → FIND) answers by meaning with no model
   and no network: the best eight things with their kind, title and the matching line, a tap opens the thing at the line; the index's size
   said in SYSTEM → STORAGE with CLEAR (it rebuilds at idle). Photos' pixels are never indexed, only text the app already read from them.
   Nothing leaves the phone. The battery: indexing runs only at idle, on power or above 50%, a few items a second, and stops when he touches
   the screen (idle.ts's rule).
5. **THE WORDS AND THE STATES.** Every new line in his voice, one sentence, in the words files the passes set (features/memory/words.ts; a
   recall card's lines in features/core/words.ts; the brain's in prompt.ts's block); every state designed: the index cold ("Still reading your
   things; ask me again in a minute."), nothing found, offline (the same), the brain cold, a chase without mail; every control 44 pt; BODY 21
   clips nothing.

## What must not change

The prompt guard's ceilings; context.ts's budgets for the model (RECALL lives inside them); what memories.ts keeps and FORGET's and LOCK's
effect (a forgotten turn is gone from the gists and the index too, with UNDO); the nightly reflection; the mail rule (SEND needs his confirm);
the social posting rule; the library's store and its tests; the phone's first-screen budget (the index never runs before Home is up); GLASS
pixel-equal; no new key; nothing that costs money; nothing fetched that is not fetched today; no face or voice code touched.

## Tests (each fails on the code before this brief; run against it once and say so)

- apps/edge/test/recall.test.mjs (new; named in the test list if KERNEL 3 is in, else one import line from context.test): a week of turns
  observed, RECALL picks today's and the matching ones within four lines with the right day words; the ceiling holds (prompt.test re-run);
  `recall` returns matching turns with dates and channel and nothing for a stranger's name he never said; a forgotten turn is gone from recall
  and comes back with UNDO; a `reply` watcher on a thread fires only on its morning, says the right one of its two lines, and without mail is a
  dated reminder; nothing in the index code imports vision/faces or the speaker.
- tests/recall.spec.mjs (new; `all=` word `recall` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390: (a)
  the on-phone index builds at idle from the log, the editors' stores and a scanned page (the spec seeds them), its size shows in STORAGE; (b)
  "what did I ask you about trains?" answers on the phone under 1 s with the right turns, offline too, a tap opens the turn; (c) FIND "garden"
  finds the workspace page and the document at their lines; (d) a reply from the stubbed brain carrying "like you said on Tuesday" shows the
  RECALL chip and it opens the turn; (e) "remind me to chase this if Sam doesn't reply by Thursday" over a stubbed Brief mail sets the watcher
  with its sentence, WATCHERS lists it with STOP; (f) every state's words; every control 44 pt; BODY 21 clips nothing; the first screen within
  budget with the index present.
- memory, projects, planmepass, talk, cards, hubcards, deck, nav, speed2, look, ink, thescan unchanged unless a fix lives in a surface they
  own; then that spec's check is the proof, red before, green after, nothing loosened.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Brain tests first (`cd apps/edge && PATH=$PWD/node_modules/.bin:$PATH node --import ./test/no-network.mjs --test test/recall.test.mjs
test/prompt.test.mjs test/context.test.mjs`) and the whole suite once at the end (background, 1700 s cap, polled). Build: `cd apps/web && npx
tsc --noEmit -p . && node build.mjs`. The preview's brain bundle as the passes do. Preview on port 8847:
`(nohup setsid node tests/preview-server.mjs 8847 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8847.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8847 NO_GL_SHOTS=1 timeout 590 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` and tests/.shots are NEVER committed (`git status` before every commit; tests/.shots removed after
every run). In the foreground, alone, one after another: recall, memory, projects, planmepass, talk, cards, hubcards, deck, nav, speed2, look,
ink, thescan. A timing budget missed under load is rerun alone before it is called red and the budget is never changed; a spec killed at 590 s
with no failure line is rerun once alone and, if killed again, reported as that with the last line it printed. Known sandbox reds not touched:
direct, aim, radio's audio, scroll, safari, eye's own screenshot, tabs2's jump bar at 390, tabs' taps under load, nav's CDP close, speed2's
first screen under load, look's BODY 21 cut on the Theme page, talk's cooling lines. One spec at a time; the machine is shared.

## The owner's phone check

1. Ask something you asked on Tuesday: does the reply say "like you said on Tuesday"? Tap the chip: that chat opens.
2. Aeroplane mode: "what did I ask you about trains?": the list of times you did, within a second; tap one.
3. In Telegram ask the same: the same list.
4. "Find garden": the Workspace page and the letter where you wrote about it, at the line.
5. Over a mail in the Brief: "remind me to chase this if they don't reply by Thursday": one sentence back; PLAN → WATCHERS shows it. On
   Thursday morning: the reminder with DRAFT A CHASE, or "they replied on Wednesday".
6. MEMORY → FORGET the Tuesday chat: "what did I ask you about trains?" no longer finds it; UNDO: it is back.
7. SYSTEM → STORAGE: the index's size; CLEAR; it rebuilds while the phone sits on charge.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/recall-report.md: the prompt ceilings before and after; the
index's size and build rate on the preview; recall's time on the phone warm and cold; each spec's and test's last line (before and after for
the new ones); found-not-fixed; NEEDS HIS WORD; the phone check as above; the commit list; one line that nothing leaves the phone that did not
before and that no face or voice code is imported. One commit per step on builder/recall; the orchestrator squashes to one on landing. Never
push. Named by tier, never by model.
