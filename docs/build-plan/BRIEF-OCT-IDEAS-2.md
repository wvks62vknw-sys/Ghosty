# BRIEF: THE OCTOBER IDEAS, SLICE 2 — LIFE EASIER (Siri, the Brief aloud on the first open, what did I miss, money nudges, what he learned, the letter, watchers, email triage)

BRIEF-OCT-IDEAS-2 (OWNER-ISSUES 176 "do all of it"; IDEAS-24-OCT "Life easier" and "teach me what you learned"; QUEUE-11-NOV item 1). Eight small
things that save him a tap or a thought, each free, each on the phone or in his own brain, nothing that costs money, no new key. One builder,
one PR. The design system is the only look (tokens.css, THE SYSTEM in styles.css); every new card is a `homecard` / `localcard` of the kind
Home and the Brief already draw; THE SCAN, ONE INK and GLASS all keep working.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited (a change that needs one goes under NEEDS HIS WORD): apps/edge/src/agent.ts, apps/edge/src/index.ts,
apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the one spec word at the END of check.yml's `all=` list; the guard job untouched),
apps/*/package.json. New brain routes go in their own files under apps/edge/src and are mounted where the existing feature routes are mounted
(not index.ts); if mounting needs index.ts, it is NEEDS HIS WORD and the phone-side part is built to a stub.

## What is built

1. **"HEY SIRI, ASK GHOSTY…"** (features/settings/shortcuts.ts and deeplinks.ts already make Shortcuts): a Shortcut that opens Ghosty with the
   dictated words as `?ask=<words>` and sends them as his turn at once (the deep link handler already reads the hash; add `ask` as a query
   word, consumed once, never kept in the address bar); and a share-sheet Shortcut that sends anything shared (a link, a page, a photo, text)
   to the library as `?add=…` with the same one-shot rule. Settings, SHORTCUTS shows both with GET and a one-line how-to. Nothing new is fetched.
2. **THE BRIEF READ ALOUD ON THE FIRST OPEN OF THE DAY.** Settings, VOICE gets a row "Read me the Brief on the first open of the day" (default
   off). On, the first open after 05:00 local (one flag a day in localStorage) speaks the Brief's existing spoken line (brief/index.ts already
   builds it: `spoken(...)`) after the hero hand-over, never on the first frame, never over a reply, and only when the voice is on and the
   phone is not muted. "Leave by" times: the Brief's commute line adds "leave by HH:MM" from the saved commute minutes against the first
   agenda item at work (his own saved places and his own agenda; the free TomTom key only if he has added it, else the usual estimate said as
   an estimate). No new key.
3. **"WHAT DID I MISS?"** A command (the ask line, the brain's words "what did I miss", a card on Home when the last open was more than 20 hours
   ago: the Scan's ABSENCE_MS is the shape to follow): one card from his own data only: the Brief's headlines he did not see, agenda items that
   passed, spending added since, the school's and the training's lines since his last open, the inbox count. Built on the phone from the shared
   mind and the local stores; the brain is not asked. Dismissed with one tap; never shown twice for the same gap.
4. **MONEY NUDGES FROM THE STATEMENTS** (features/money): from the statements he already added and nothing else: a subscription renewing this
   week (the same merchant on the same day of the month twice before), a price that went up against the last charge, and the month running hot
   (spend to date against the same day last month, or against his budget). Each a one-line nudge on the SPENDING sheet and in the Brief's
   money line, said once per fact. Nothing connects to any bank; nothing leaves the phone.
5. **"TEACH ME WHAT YOU LEARNED THIS WEEK."** The command and the brain's words: he explains the week's training in his own words from the Report
   card's numbers and the WHAT I LEARNED TO DO list (the system/training and selftrain surfaces already hold them): the gap closed or not, the
   new skills, the loss he studied in the GYM, in five plain sentences at most, READ IT TO ME. The brain composes from those records through the
   existing training routes (read only); if the brain is offline, the phone composes a plain version from the local copy.
6. **THE PHOTOGRAPHED LETTER.** In the Lens (one Lens: no mode key), when the read text looks like a letter or a bill (a date in the future, an
   amount, "by", "due", "appointment", "reference"), the tag offers REMIND and FILE: REMIND makes an agenda item on the date found (he confirms
   the date in one tap); FILE saves the read text into the library under its sender's name with the date. Both on the phone; the text is read by
   the Lens's own reader as today.
7. **WATCHERS.** A command: "tell me when this price drops", "tell me when this page changes", "tell me when there's a strike on my line". A
   watcher is a public page or feed he names, read by the brain's hourly beat (the same beat that reads the warnings for NEAR HOME; no new
   schedule), compared with its last reading on the phone's rules (a number down, a page's text changed, the word "strike" or "industrial
   action" on the operator's public status page), told once when it trips, through the existing notify path. WATCHERS as a list under PLAN
   with STOP on each. Public pages only; never a login; never a private person's page.
8. **EMAIL TRIAGE INTO THE BRIEF.** Only when his own email is linked in Links (features/links): the Brief gets one line, "two emails need an
   answer", from the inbox the link already reads (subject and sender only, on the phone), with DRAFT on each that opens a drafted reply in
   links/drafts.ts for his edit and his SEND tap. Nothing is sent without his tap; nothing is read beyond what the link already reads; with no
   email linked the line is absent and nothing asks him to link one.

## What must not change

The first-screen budget (speed2) and every other budget; GLASS pixel-equal; ONE INK's page; every control 44 pt; nothing sideways at 440 × 956
or 390 × 844; the finding rule; the ratchet ceiling (hex 506, rgba 1016, radiusPx 470, total 1992: equal or lower); the prompt guard; no new
key; the brain never gets live GPS (places are his saved ones); nothing posted, sent or bought without his tap.

## Tests (each fails on the code before this brief; run against it once and say so)

- tests/lifeeasier.spec.mjs (new; `all=` word `lifeeasier` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390:
  (a) `?ask=hello%20there` opens Home and sends one turn with those words, the address bar cleaned; `?add=<url>` files it and the library
  shows it; Settings, SHORTCUTS shows both with GET; (b) with the Brief row on and the day flag clear, the first open after the hero hand-over
  calls speak once with the Brief's line (the fake speaker in tests/fixtures counts), a second open the same day never; the commute line carries
  "leave by"; (c) with the last-open stamp 25 hours back the WHAT DID I MISS card is drawn on Home with at least three of its lines from seeded
  data, dismissed on one tap and not drawn again; "what did I miss" in the ask line draws the same; (d) seeded statements with a repeating
  merchant, a raised price and a hot month draw three nudges once on SPENDING and once in the Brief's money line; (e) "teach me what you learned
  this week" answers in at most five sentences from seeded report records, with READ IT TO ME; (f) a fixture frame with a letter's text offers
  REMIND and FILE; REMIND makes the agenda item on the found date after the confirm; FILE puts the text in the library under the sender; (g) a
  watcher on a fixture page trips once when the page's number drops and is listed under PLAN with STOP; (h) with the email link seeded, the Brief's
  line counts two; DRAFT opens a draft; nothing is sent without the SEND tap; with no link the line is absent.
- apps/edge/test/watchers.test.mjs (new, named in the brain's test list only if the list is not protected — it is: so the test is imported from an
  existing test file as kernel-yes was, one import line, and NEEDS HIS WORD says so): the hourly beat reads a watcher, compares, tells once.
- speed2.spec, look.spec, ink.spec, brief and agenda specs unchanged.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8812:
`(nohup setsid node tests/preview-server.mjs 8812 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8812.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8812 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is never committed. In the foreground, alone, one after another: lifeeasier, speed2, brief (or the
spec that owns the Brief), agenda, money (or the spec that owns SPENDING), lens, library, settings, talk, look, ink, layout, nav. The brain
tests in the background once at the end (`cd apps/edge && PATH=$PWD/node_modules/.bin:$PATH npm test`, about 10 min; rebuild the preview's brain
bundle first with `npx esbuild src/index.ts --bundle --format=esm --platform=neutral --external:cloudflare:sockets --outfile=test/.build/brain.mjs`
if a brain route changed). A timing budget missed under load is rerun alone before it is called red. Known sandbox reds not touched: direct,
aim, radio, scroll, safari, eye's own screenshot, tabs2, talk's cooling lines, look's "at BODY 21 the Theme page cuts words".

## The owner's phone check

1. Settings, SHORTCUTS: GET "Ask Ghosty"; say "Hey Siri, ask Ghosty what's the weather": Ghosty opens and answers. GET "Send to Ghosty"; share a
   page from Safari to it: it is on the Shelf.
2. Settings, VOICE: "Read me the Brief on the first open of the day" on; close Ghosty; open it tomorrow morning: he reads the Brief after Home
   lands. The commute line says "leave by".
3. Leave Ghosty closed for a day; open it: the WHAT DID I MISS card; one tap dismisses it.
4. SPENDING with your statements in: any nudge lines at the top, and the same line in the Brief.
5. "Teach me what you learned this week": five sentences at most, in his voice.
6. Lens on a letter with a date: REMIND, then the agenda has it; FILE, then the library has it.
7. "Tell me when there's a strike on my line": WATCHERS under PLAN lists it with STOP.
8. With your email linked: the Brief's email line; DRAFT; nothing goes without SEND.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/lifeeasier-report.md: what was built, each spec's last line
(before and after for the new one), what was found and not fixed, NEEDS HIS WORD, the phone check as above, the commit list. One commit per
step on builder/lifeeasier; the orchestrator squashes to one on landing.
