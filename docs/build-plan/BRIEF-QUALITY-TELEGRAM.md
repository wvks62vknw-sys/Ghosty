# BRIEF: QUALITY PASS — TELEGRAM (Ghosty in the Telegram app, and the pairing page on the phone, made right; nothing new added)

BRIEF-QUALITY-TELEGRAM (OWNER-ISSUES 178 "i want everything to have insane quality even if there's things in the past which we've had which
could have better quality"; 184's WHATS-LEFT list 4 "Telegram"; QUEUE-11-NOV, the ninth QUALITY PASS). One builder, one PR. The mid tier.
Nothing new is added: everything Ghosty says and does inside Telegram, and the LINKS → TELEGRAM page on the phone, are measured and made
right by the method of BRIEF-UPGRADE-PASS. What this pass owns: on the brain, apps/edge/src/telegram.ts (NOT a protected file): every line
Ghosty sends to the paired chat (a reply's text and how it is split, a picture, a voice note's words, the card for an approval and its
buttons, a draft for his accounts, a notification's head and body, the stranger's one line, "I couldn't hear that", "I'm still busy", a
video or GIF said plainly, a TikTok link's card, /stop and the other commands), and the pairing's words (the code's message, the paired
greeting, UNPAIR's line); on the phone, the TELEGRAM panel of LINKS (features/links/index.ts lines for that panel only: not connected,
waiting for the code with its countdown, paired with TEST and UNPAIR, "not known while paused") and the Telegram bot key's block in SYSTEM →
KEYS (features/system/keys words for that one key). NOT THIS PASS'S: apps/edge/src/agent.ts and index.ts (protected: the webhook's two
routes stay exactly as they are), the vault and the token's handling (it never appears anywhere readable: the test that proves it stands),
the signing of buttons and their expiry, who is answered (the owner's chat alone; strangers turned away once an hour and never stored), the
speech code (speech.ts), the social posting rule (APPROVE every time; the PLAN AND ME pass set the phone's draft card to APPROVE · EDIT · NO
and Telegram's draft card already says the same: keep them the same), what the brain does in a turn, the rest of LINKS (the PLAN AND ME pass
did it). Starts FROM THE CHAT PASS'S HEAD (builder/chatpass, when it hands back), so every pass's words and ratchet rows are in the tree; the
orchestrator lands only the diff above that head, after the chat pass is on main. Read STANDARD.md, BRIEF-UPGRADE-PASS.md (the method),
apps/edge/src/telegram.ts top to bottom (its header is the contract), apps/edge/test/telegram.test.mjs (the brain's own checks: every one
stands), tests/telegram.spec.mjs (the phone's page in every state the brain can report), BRIEF-QUALITY-PLAN-ME.md (LINKS' and SOCIAL's words:
match their voice), BRIEF-QUALITY-CHAT.md (the chat's turn-state words: Telegram says the same things in the same words where it can). THE
QUALITY RULE holds (every state designed, every word his, every wait said, every number honest, nothing merely fine).

## His words
"i want everything to have insane quality even if there's things in the past" (11 Nov, 178). Telegram is where he talks to Ghosty when the
app is not open: a message there must read like the same person, and nothing he sends may ever be answered blind or dropped without a word.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. The bot token never appears in a message,
a log, an error or a test fixture (telegram.test's scrub check stands and gains nothing weaker). A stranger's chat is never stored, named or
answered beyond the one line an hour. Nothing is sent to Telegram from a test (the test's Telegram is a stub, as it is today).

## What is made right

1. **MEASURE FIRST, WRITTEN DOWN (the method's step 1).** With the brain tests' stubbed Telegram and the phone's page on the preview: read, as
   the owner would read them in the Telegram app, every message Ghosty can send: a short reply; a long reply split under the limit (where does
   it split: mid-sentence? mid-word? does each part stand alone?); a reply the brain wrote with headings, bold, bullets or a table (Telegram
   shows plain text: what does he see?); a reply with a picture link (the photo and its caption); a reply with sources ([1] markers and the
   SOURCES list as Telegram shows them); a voice note's answer (text, then the voice; the words when the voice cannot be made); a photo he sent
   with and without a caption; a video, video note or GIF (the still frame taken and the plain line that it could not be watched or heard); a
   TikTok link; an approval card (APPROVE / NOT NOW: what exactly is he approving, in the card's own words?); a draft for his accounts (APPROVE
   · EDIT · NO and the exact post); a notification (reminder, task result, error: its head and body); the stranger's line; "I'm still busy…";
   "I couldn't hear that…" (its three reasons); /stop and any other command; the pairing: the code's message in the app, the first message
   after pairing, UNPAIR; a message sent while the brain is paused (what comes back, if anything, and when); a message the brain cannot answer
   (every model cooling: what does Telegram say and when?). On the phone: LINKS → TELEGRAM in each state (not connected, waiting with the code
   and its countdown, paired, not known while paused) and SYSTEM → KEYS' Telegram block, at 440 and 390, in the three looks. List every rough
   spot: a message with no words where words are due (a dropped video, a paused brain, a cooling brain), a word not his (developer words:
   "webhook", "callback", "token", "payload", "status", a raw error string, an emoji doing a word's job), a split that breaks a sentence or a
   list, markdown shown raw, a number without its unit or its word (a file size, a code's minutes, a cooling time), a wait with no words (a
   voice note being heard, a picture being looked at, a long turn), a button whose effect is not said, anything a good bot does better (a
   typing indicator while the brain works, a reply that answers in the chat's own language of short messages). Rank by how much he would feel
   it. The whole list is in the report, before any fix.
2. **FIX THE TOP TWENTY (the messages twelve, the pairing and the phone page five, the notifications three), each the smallest change that does
   the job, each with a test that fails on the old code.** Known to start with: a long reply split at a sentence's end (or a blank line) and
   never mid-word, each part readable alone, "(1 of 3)" said only when there are parts; markdown the brain wrote turned to Telegram's plain
   shape (a heading as a line in capitals, bullets as "•", bold dropped, a table as lines) with nothing lost; the typing indicator sent while a
   turn runs (sendChatAction, free, once every few seconds) so a long turn is never silence; a slow turn's narration (the chat pass's one-line
   steps) sent as ONE message that is edited in place, never a message per step; a video or GIF answered with the plain line first, before any
   answer about its still; a voice note's "I couldn't hear that" in one sentence with the one thing to do; a reply with sources ending in a
   SOURCES block of numbered addresses; an approval card that says in one line exactly what APPROVE does and what NOT NOW does, the thing
   approved quoted; the stranger's line in his voice and one sentence; "I'm still busy" with what it is busy with when the phone's turn has a
   gist; the cooling brain said once with the time the first is back, as the app says it; the paused brain: the webhook answers Telegram at
   once and the message is answered when the brain wakes, or one line says it cannot be just now (measured: what happens today); the code's
   message on the phone one sentence with the three taps in order; the paired greeting one sentence with what he can send (text, a voice
   note, a photo); UNPAIR's line says what stops; the countdown says "valid for about N minutes" and the expired line offers NEW CODE as a 44
   pt key; SYSTEM → KEYS' Telegram block says in one sentence where the token comes from (@BotFather) and that it never leaves the vault;
   notifications' heads in words, not symbols alone ("Reminder: …", "Done: …", "Something went wrong: …"), each body one sentence with its
   time; a notification that fails to send is recorded for the app once, never retried into a flood.
3. **WORDS.** Every line Telegram sends in one pure words file (apps/edge/src/telegramwords.ts) the brain test imports; each one sentence;
   the phone page's lines in features/links/words.ts if the PLAN AND ME pass made one, else there; the catalogue words for Telegram re-cut to
   the same voice.
4. **PROVE IT.** The brain test's stubbed sends written to the report as the owner would read them, before and after, for the twelve message
   fixes; before-and-after stills of the phone page's four states at 440 (eight stills, deleted after the report lists them); the split's
   measured parts for a 9,000-character reply before and after.
5. **LEAVE THE LIST.** What was found and not fixed, ranked, with why, so the next pass knows. Telegram's own limits (no real bot on a test
   runner; what only his phone and his bot can show) named, not pretended.

## What must not change

Who is answered (the owner's paired chat alone), the stranger rule (one line an hour, nothing stored), the token's secrecy, the buttons'
signing and expiry, the webhook's secret, the pairing code's life, the approval's effect (the same as POST /approve), the social posting rule
and the draft card's three keys (APPROVE · EDIT · NO, the same as the phone), the speech code, the two protected routes, what the brain does
in a turn, the brain tests' every existing check (telegram.test gains checks and loses none), the phone's first-screen budget and every other
budget; nothing that can cost money (sendChatAction and editMessageText are free Bot API calls; nothing paid is added); no new key.

## Tests (each fails on the code before this brief; run against it once and say so)

- apps/edge/test/telegram.test.mjs gains one check per message fix (twelve) and the notifications' three, each named for the rough spot it
  closes: the split's parts end at sentence ends and never mid-word; markdown flattened with nothing lost; the typing action sent during a
  turn; the narration as one edited message; the video's plain line first; the sources block; the approval card's one line; the stranger's
  line; the cooling line once; the paused brain's behaviour as measured and chosen; the notification heads in words; a failed notification
  recorded once. The token-secrecy, signing, pairing and stranger checks stand untouched.
- tests/telegrampass.spec.mjs (new; `all=` word `telegrampass` at the END of the list in check.yml, nothing else in .github touched), at 440
  and 390: LINKS → TELEGRAM's four states in his words with the stubbed brain, the code's sentence and three taps, the countdown's "about",
  the expired line's NEW CODE 44 pt, UNPAIR's line, SYSTEM → KEYS' block, every control 44 pt, BODY 21 clips nothing, nothing sideways.
- telegram, planmepass, social, notifications, hubcards, deck, nav, speed2, look, ink, thescan unchanged unless a fix lives in a surface they
  own; then that spec's check is the proof, red before, green after, nothing loosened.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Brain tests first and often: `cd apps/edge && PATH=$PWD/node_modules/.bin:$PATH node --import ./test/no-network.mjs --test test/telegram.test.mjs`
(the whole suite once at the end, in the background with a 1700 s cap, polled). Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`.
The preview's brain bundle as the earlier passes did (`npx esbuild src/index.ts --bundle --format=esm --platform=neutral
--external:cloudflare:sockets --outfile=test/.build/brain.mjs` in apps/edge; test/.build is gitignored). Preview on port 8843:
`(nohup setsid node tests/preview-server.mjs 8843 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8843.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8843 NO_GL_SHOTS=1 timeout 590 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` and tests/.shots are NEVER committed (`git status` before every commit; tests/.shots removed after
every run). In the foreground, alone, one after another: telegrampass, telegram, social, notifications, planmepass, hubcards, deck, nav,
speed2, look, ink, thescan. A timing budget missed under load is rerun alone before it is called red and the budget is never changed; a spec
killed at 590 s with no failure line is rerun once alone and, if killed again, reported as that with the last line it printed. Known sandbox
reds not touched: direct, aim, radio's audio, scroll, safari, eye's own screenshot, tabs2's jump bar at 390, tabs' taps under load, nav's CDP
close, speed2's first screen under load, look's BODY 21 cut on the Theme page, talk's cooling lines. The machine is shared (load 11 to 20):
one spec at a time.

## The owner's phone check

1. In Telegram, send Ghosty a question that takes a while: the "typing…" shows while it works; one message says what it is doing and changes
   in place; the answer arrives as whole sentences, never a part cut mid-word.
2. Ask for something with a list and a heading: it reads as plain, clean text, nothing lost, no stray asterisks.
3. Send a voice note: the text, then Ghosty's voice. Send a video: it says first, plainly, that it could not watch or hear it, then answers
   from the one still.
4. Ask something that needs your approval: the card says in one line what APPROVE does and what NOT NOW does, with the thing quoted.
5. Set a reminder for two minutes from now and close the app: the Telegram message reads "Reminder: …" with its time.
6. On the phone, LINKS → TELEGRAM: UNPAIR, read the line; NEW CODE: one sentence and the three taps; pair again from Telegram: the greeting
   says what you can send. SYSTEM → KEYS: the Telegram block in one sentence.
7. Ask a friend to message your bot once: they get one plain line and nothing else; you are not told who they are (that is the rule).

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/telegrampass-report.md: the measured list (before any fix);
the twenty fixes with before and after (the messages quoted as he would read them; the stills named); the split's parts before and after; the
leftovers ranked; each test's and spec's last line (before and after for the new ones); what only his phone and his bot can show; NEEDS HIS
WORD; the phone check as above; the commit list. One commit per fix on builder/telegrampass; the orchestrator squashes to one on landing.
