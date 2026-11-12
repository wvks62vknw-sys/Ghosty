# BRIEF: QUALITY PASS — THE CHAT (the conversation itself: the log, a turn's every state, the talk bar, the Stage, the sources, the phone's own answers made right; nothing new added)

BRIEF-QUALITY-CHAT (OWNER-ISSUES 178 "i want everything to have insane quality even if there's things in the past which we've had which
could have better quality"; 184's WHATS-LEFT list 4 "the chat itself (the log, the Stage, WHY, the ask line)"; QUEUE-11-NOV, the eighth
QUALITY PASS). One builder, one PR. The mid tier. Nothing new is added: the conversation is measured and made right by the method of
BRIEF-UPGRADE-PASS, and the STATES RATCHET (apps/edge/test/ratchet.test.mjs, grown by the LIFE, HOME, SEE, MAKE, PLAN AND ME and LEARN passes)
gains the chat's own surfaces. What this pass owns: THE LOG (features/core/index.ts: the conversation's entries, his turn and Ghosty's, the
first-open state, a day's heading, a long reply, the status line under a turn, the tool-trail entries, the cooling card and the I COULDN'T card
beyond what the HOME pass fixed, copy and share of a reply, the scroll to the newest); A TURN'S STATES (assistant/session.ts: sending, waiting,
running, streaming, stopped, failed, an approval asked and answered, RETRY; the words it shows and says, never its protocol); THE TALK BAR
(assistant/voice.ts, barge.ts, spoken.ts, narrate.ts, notices.ts: listening, hearing him, thinking aloud, speaking, cut off, the microphone
refused, the voice chosen, a notice read in a quiet moment; the words and drawn states only, never the audio pipeline or its timings); THE
STAGE (show/stage.ts and show/turn.ts: its wait, a picture with no data, its close, its plate in each look; the pictures' own code untouched);
THE SOURCES (features/core/cited.ts: the chips, the SOURCES list, the check line); THE PHONE'S OWN ANSWERS (assistant/local.ts: "can you…?",
questions about Ghosty himself, answered with no model: one sentence and the way on); THE GUARDIAN'S WORDS ONLY (assistant/guard.ts: the lines
it shows when it is not the panic phrase, e.g. the switch's explanation and a refusal's sentence; the panic flow, its clock and its logic are
NOT touched); the HUD's call-out words (features/core/hud.ts: the six call-outs' labels and their dead states, not the drawing). NOT THIS
PASS'S: Home's instruments, Today, tiles, chips and ask bar, WHY, the cards (features/core/{home,why,cards,homecard,localcard,sitecard,ytcard,
progress,rate,ratelist}.ts: the HOME pass did them); the boot and the orb (shell/boot.ts: the HOME pass and POLISH 3); Telegram (its own
brief); the brain and its prompt guard (apps/edge/*); the voice's audio code and every timing budget of talk.spec and voice.spec; the Stage's
drawings (show/{chart,iso,sim,parts,decide}.ts); the hubs. Starts FROM THE LEARN PASS'S HEAD (builder/learnpass, when it hands back), so the
ratchet's table with every pass's rows, POLISH 1's error voice (ui/hisWords.ts), the wait helper (ui/wait.ts) and the words-file pattern
(features/lens/words.ts) are in the tree; the orchestrator lands only the diff above that head, after the LEARN pass is on main. Read
STANDARD.md, BRIEF-UPGRADE-PASS.md (the method), BRIEF-QUALITY-HOME.md and the HOME report (scratchpad/homepass-report.md: what it fixed in
core/index.ts so nothing is done twice, and its leftovers), BRIEF-TALK-1A.md, BRIEF-SHOW-ME-1.md, BRIEF-POLISH-3.md (what it owns),
`tests/talk.spec.mjs` (its header is the chat's contract; its cooling lines are a known sandbox red), `tests/voice.spec.mjs`,
`tests/cards.spec.mjs`, `tests/cited.spec.mjs`, `tests/hero.spec.mjs`, `tests/offline2.spec.mjs`, `tests/guardian.spec.mjs`,
`tests/showme.spec.mjs`, `tests/speaker.spec.mjs`, `tests/homepass.spec.mjs`. THE QUALITY RULE holds (every state designed, every word his,
every wait said, every number honest, every control 44 pt, nothing merely fine).

## His words
"i want everything to have insane quality even if there's things in the past" (11 Nov, 178). The chat is the one screen he uses every time he
opens the app: every state of a turn must say what is happening in one plain sentence, and nothing he said or Ghosty said may ever vanish.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. Nothing of another room's files. The
guardian's panic phrase, its named person, its clock and what it sends are never touched; apps/web/public/_headers is never touched.

## What is made right

1. **MEASURE FIRST, WRITTEN DOWN (the method's step 1).** Open, at 440 × 956 and 390 × 844, in GLASS, THE SCAN and ONE INK, reduced motion on
   and off, with the scripted brain talk.spec uses, the brain live, slow (900 ms), cut mid-stream and dead, the signal on and off, the first
   ever open and a log of forty turns: THE LOG on first open (what does it say before he has said anything?), a typed turn and a spoken one,
   a reply arriving word by word, a reply with a tool trail (each step's line and its wait), a reply with a card, with a picture, with sources,
   a very long reply, a reply cut mid-stream by the signal, a failed send, the cooling card, a day's boundary in a long log, the scroll when
   a reply lands while he reads older turns, copy and share of a reply; A TURN'S STATES one by one (sending, waiting, running with its
   narration line, streaming, stopped by his tap, failed, an approval card asked, answered yes and no, RETRY after a failure); THE TALK BAR
   (idle, listening, hearing him with his words appearing, thinking, speaking with STOP, cut off by his voice, the microphone refused by the
   browser and by him, the voice chosen in SETTINGS, a notice read in a quiet moment, "that's all"); THE STAGE (its wait, a picture drawn, a
   picture with no data, its close, in each look); THE SOURCES (chips, the list, the check line with no source backing a claim, a source that
   will not open); THE PHONE'S OWN ANSWERS ("can you…?" found and not found, "what can you do here?", a question about Ghosty himself, all
   offline); THE GUARDIAN'S other lines; the HUD's six call-outs dead. List every rough spot: a state with no message (empty, loading, error,
   offline, cut off, refused), a word not his (developer words: "stream", "token", "session", "payload", "status", "timeout", a raw browser
   string, a label that repeats its row, a sentence over 20 words, two where one would do), a number without its unit or its word (a wait
   without "about", a count without what it counts, a cooling time without when), a wait over half a second with no words (a send, a tool
   step, a picture drawing, a source opening, the voice starting), a tap that does nothing or does two things, a control under 44 pt,
   anything sideways, anything a good messaging app does better (the scroll, the day headings, the long message, the copy, the failed send,
   the typing indicator in words). Rank by how much he would feel it. The whole list is in the report, per surface, before any fix.
2. **FIX THE TOP TWENTY-FIVE (THE LOG six, A TURN'S STATES five, THE TALK BAR five, THE STAGE three, THE SOURCES two, THE PHONE'S OWN ANSWERS
   two, THE GUARDIAN'S WORDS and THE HUD two), each the smallest change that does the job, each with a spec check that fails on the old
   code.** Known to start with, from the specs' own comments and the HOME pass's leftovers: THE LOG's first open says one sentence of what to
   do and lists three things he can say (from the catalogue, in his words), never a blank; a day's heading in his words ("Yesterday", "Monday",
   never a bare date) once a log crosses midnight; a long reply folds past twelve lines with "the rest" in 44 pt and never cuts a sentence;
   a reply cut by the signal keeps what came and says once "The signal went. This is what reached me." with RETRY for the rest; a reply
   landing while he reads older turns does not drag the scroll, a 44 pt "newest" key appears instead; copy and share of a reply as plain
   words with its sources' addresses; A TURN'S STATES each one line in his voice under the turn (sending "Sending…", waiting "Asking my
   brain…", running with narrate.ts's own line and never a bare "thinking", stopped "Stopped. What came is above.", failed as the HOME pass
   made it) and the approval card's two keys 44 pt with the exact thing approved said; THE TALK BAR's every state said in words that read
   without the animation ("I'm listening.", "Go on, I'm still listening." after three seconds' silence, "Tap to stop me." while speaking,
   "You cut in; go on." after a barge, the microphone refused said with how to allow it in the phone's own Settings words, the browser's
   refusal in Ghosty's words), a notice read only in a quiet moment and shown as a card he can dismiss, "that's all" signed off in one line;
   THE STAGE's wait said ("Drawing it…", with the kind of picture), a picture with no data never a blank plate but one line of why and no
   plate, its close 44 pt and in reach of a thumb, the conversation never hidden behind it on the smaller phone; THE SOURCES' check line in
   words ("5 of 6 things I said are in the sources; the one that isn't is marked"), a source that will not open said with the address to copy;
   THE PHONE'S OWN ANSWERS one sentence each with the way on as a 44 pt key, the not-found line in his words ("I can't do that yet. Shall I
   learn it?" with YES as it is); THE GUARDIAN's switch and refusal lines one sentence each, the rule's own words where the rule speaks; the
   HUD's dead call-outs in words ("Not answering", "No signal"), never a dash; every control 44 pt; the chat phrases that open each named
   screen are already listed by the earlier passes: here, "what can you do?" lists the rooms in one line each (invent no new ability).
3. **THE STATES RATCHET gains THE CHAT.** The table in apps/edge/test/ratchet.test.mjs gains rows `core.log`, `core.turn`, `core.talk` (dir
   'core' or `at: 'assistant'` as the drawing code's home dictates), `show.stage` (`at: 'show'`), `core.cited`, `core.local` (`at:
   'assistant'`), `core.hud`, measured on the base and pinned at the new, higher number (equal or higher from then on); `sourceOf`'s directory
   list gains `assistant` and `show`. The existing `core.*`, `brief.*` and `shell.*` rows are not lowered. The before and after counts per
   surface in the report.
4. **WORDS.** Every line the chat shows about itself in one pure words file (features/core/words.ts; the talk bar's in assistant/words.ts) the
   spec imports; each one sentence; nothing lost: a fact cut from a line goes to WHY or a sheet, never to smaller type. The catalogue words
   for the chat's own phrases re-cut to the same voice.
5. **PROVE IT.** Before-and-after stills of the log on first open, a tool-trail turn, a failed send, a long reply folded, the talk bar
   listening and speaking, the Stage with a picture and with none, the sources at 440 (eighteen stills, written by the spec, deleted after
   the report lists them) and the measured numbers before and after where there are numbers (the first spoken word's time and the barge-in's
   time, read from talk.spec, must not move by more than the load's noise; the budgets never change).
6. **LEAVE THE LIST.** What was found and not fixed, ranked, with why, per surface, so the next pass knows.

## What must not change

talk.spec's and voice.spec's every budget and every check (first spoken word, barge-in within 150 ms, narration never before 1.5 s, notices in
turn); the brain's protocol in session.ts (what is sent and what each streamed event means); the guardian's panic phrase, person, clock and
sends; the prompt guard; the voice's audio code; the Stage's drawings and the first-screen budget; GLASS pixel-equal; ONE INK's page; every
control 44 pt; nothing sideways at 440 × 956 or 390 × 844; the finding rule; the colour ratchet (hex 506, rgba 1016, radiusPx 470, total
1992: equal or lower); no new key; nothing that can cost money; nothing fetched that was not fetched before; Home's instruments, Today, WHY
and the cards (the HOME pass's); the boot (POLISH 3's).

## Tests (each fails on the code before this brief; run against it once and say so)

- tests/chatpass.spec.mjs (new; `all=` word `chatpass` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390,
  with the scripted brain and the made-up microphone and voices talk.spec uses: one check per fix (twenty-five, grouped THE LOG · A TURN'S
  STATES · THE TALK BAR · THE STAGE · THE SOURCES · THE PHONE'S OWN ANSWERS · THE GUARDIAN AND THE HUD), each named for the rough spot it
  closes; plus: the first-open words; a reply cut mid-stream keeps its words and says so once; the scroll does not move while he reads older
  turns and the "newest" key appears; a long reply's fold never cuts a sentence; every talk-bar state's words present with the animation off;
  the Stage's close in thumb reach at 390; every control 44 pt; BODY 21 clips nothing; nothing sideways; the spec leaves the preview's brain
  as it found it (inbox read, no notice left behind: the MAKE pass's lesson).
- apps/edge/test/ratchet.test.mjs gains the chat's rows in the STATES RATCHET (equal or higher).
- talk, voice, cards, cited, hero, offline2, guardian, showme, speaker, homepass, hubcards, deck, nav, speed2, look, ink, thescan, lifepass,
  seepass, makepass, planmepass, learnpass unchanged unless a fix lives in a surface they own; then that spec's check is the proof, red
  before, green after, nothing loosened. talk's cooling lines are a known sandbox red: named, its other checks read.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. The preview's brain bundle first, as the earlier passes did:
`npx esbuild src/index.ts --bundle --format=esm --platform=neutral --external:cloudflare:sockets --outfile=test/.build/brain.mjs` in apps/edge
(test/.build is gitignored). Preview on port 8842:
`(nohup setsid node tests/preview-server.mjs 8842 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8842.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8842 NO_GL_SHOTS=1 timeout 590 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` and tests/.shots are NEVER committed (`git status` before every commit; tests/.shots removed after
every run). In the foreground, alone, one after another: chatpass, talk (its cooling red named), voice, cards, cited, hero, offline2, guardian,
showme, speaker, homepass, hubcards, deck, nav, speed2, look, ink, thescan, then lifepass, seepass, makepass, planmepass, learnpass (these five
with a 1700 s cap in a background call, polled every 60 s). The brain tests once at the end the same way. A timing budget missed under load is
rerun alone before it is called red and the budget is never changed; a spec killed with no failure line is rerun once alone and, if killed
again, reported as that with the last line it printed. If a spec goes red on state another spec left in the preview's brain, restart the
preview and rerun. Known sandbox reds not touched: direct, aim, radio's audio, scroll, safari, eye's own screenshot, tabs2's jump bar at 390,
tabs' taps under load, nav's CDP close, speed2's first screen under load, look's BODY 21 cut on the Theme page, talk's cooling lines. The
machine is shared (load 11 to 20): one spec at a time.

## The owner's phone check

1. Open Ghosty fresh (Settings → forget this phone, or a new browser): what does the chat say before you have said anything? Three things to
   try, in words you would say.
2. Ask something that makes Ghosty use a tool ("what's the traffic like?"): under your words, one line at a time of what it is doing, never
   "thinking". Tap STOP half way: "Stopped. What came is above."
3. Aeroplane mode half way through a long answer: the words that came stay, one line says the signal went, RETRY brings the rest.
4. Scroll up to read something old while an answer lands: the page does not jump; a "newest" key appears; tap it.
5. Tap the microphone: "I'm listening."; say nothing for three seconds: it tells you it is still listening; talk over it while it speaks:
   "You cut in; go on." Refuse the microphone in Settings once: Ghosty tells you how to allow it in your phone's own Settings.
6. "Show me the rooms as a map": the Stage says "Drawing it…", then the picture; close it with a thumb on the small phone. Ask for a chart of
   nothing: one line of why, no empty plate.
7. A cited answer: the check line in words; tap a source; tap one that is dead: the address to copy.
8. Offline: "can you book a table?": one sentence and YES to learn it; "what can you do here?": the rooms in one line each.
9. Biggest text: nothing cut in the log, the talk bar or the Stage. Does the chat feel like a messaging app you would use all day? Say the
   one thing that does not.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/chatpass-report.md: the measured list per surface (before any
fix); the twenty-five fixes with before and after (words quoted, numbers where there are numbers, the eighteen stills named); the
states-ratchet counts before and after per surface; talk.spec's first-word and barge-in numbers before and after; the leftovers ranked per
surface; each spec's last line (before and after for the new one); NEEDS HIS WORD; the phone check as above; the commit list; one line that
no model name is in the diff. One commit per fix (or per surface) on builder/chatpass; the orchestrator squashes to one on landing.
