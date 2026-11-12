# BRIEF: QUALITY PASS — HOME AND THE HOUSE LINE (the first screen made right; nothing new added)

BRIEF-QUALITY-HOME (OWNER-ISSUES 178 "i want everything to have insane quality even if there's things in the past which we've had which
could have better quality"; 143, 155 the house on every screen; 43, 45, 142 the boot "can be a lot lot lot better"; QUEUE-11-NOV item 13,
the second QUALITY PASS). One builder, one PR. The mid tier. Nothing new is added: the HOME room and the line that holds the house are
measured and made right by the method of BRIEF-UPGRADE-PASS, and the STATES RATCHET that the LIFE pass began (apps/edge/test/ratchet.test.mjs)
gains HOME's screens. What this pass owns: Home itself (features/core/home.ts, the reactor, its four instruments, the live-state pill, the
Today card, the tiles; features/core/index.ts's chips and ask bar; features/core/why.ts, cards.ts, homecard.ts, localcard.ts, sitecard.ts,
ytcard.ts, progress.ts, rate.ts, ratelist.ts as the reply cards Home draws), THE BRIEF (features/brief/*, packages/shared/src/mind for its
words), the house line on every screen (shell/house.ts, shell/rooms.ts, shell/areadefs.ts's words, shell/jump.ts, shell/favourites.ts,
shell/launcher.ts, shell/switcher.ts), the boot and the orb (shell/boot.ts and its cut), the widgets (features/*/widgets where Home shows
them; tests/widgets.spec.mjs). Starts FROM THE LIFE PASS'S HEAD (builder/lifepass, when it hands back), so the ratchet's table and POLISH 1's
error voice (ui/hisWords.ts) and wait helper (ui/wait.ts) are in the tree; the orchestrator lands only the diff above that head, after the
LIFE pass is on main. Read STANDARD.md, BRIEF-UPGRADE-PASS.md (the method), BRIEF-QUALITY-LIFE.md (the first pass, the shape of the ratchet),
BRIEF-SHELL-2.md, BRIEF-ONE-INK.md, BRIEF-ORB-AND-BOOT.md, BRIEF-POLISH-1.md, `tests/brief.spec.mjs`, `tests/hero.spec.mjs`, `tests/boot.spec.mjs`,
`tests/deck.spec.mjs`, `tests/nav.spec.mjs`, `tests/cards.spec.mjs`, `tests/widgets.spec.mjs`, `tests/night.spec.mjs`, `tests/thescan.spec.mjs`,
`tests/ink.spec.mjs`. THE QUALITY RULE holds (every state designed, every word his, every wait said, every number honest, every control 44 pt,
nothing merely fine).

## His words
"i want everything to have insane quality even if there's things in the past" (11 Nov, 178). "the cinematic btw which can be a lot lot lot
better" (7 Nov, 142). "can't we add tabs for everything we have" (1 Nov, 119): the house line was the answer; this pass makes the first
thing he sees every morning, and the line he reaches every room through, the best screen in the app.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. The rooms' list (shell/areadefs.ts,
shell/rooms.ts) is one source read by the deck, the finding test and THE PLAN: words may be re-cut, nothing added, removed or reordered.
Nothing of another room's files beyond the ones named above (the HUDs' homes, features/core/{eye,orbit,grown,map}/*, belong to their own
builds and are not touched; the LIFE packs are the LIFE pass's). The boot's budget (2,880 ms to a usable Home on a cold open, tests/boot.spec)
is a ceiling, never raised.

## What is made right

1. **MEASURE FIRST, WRITTEN DOWN (the method's step 1).** Open, at 440 × 956 and 390 × 844, in GLASS, THE SCAN and ONE INK, reduced motion
   on and off, the brain live and mocked dead: a cold boot to Home; Home at 6 am, noon and 11 pm (the clock set by the spec); Home with no
   agenda, no school, no library, no weather, no signal; each of the four instruments tapped; the live-state pill in every state it has;
   the Today card with nothing, one thing and nine things; every tile; every chip; the ask bar empty, typed, sent, failed; each reply card
   Home draws (a plan, a place, a site, a video, a rating, a progress line, WHY) with its numbers; THE BRIEF at the same three hours with
   and without weather and headlines, READ IT TO ME; the house line on every screen (THE HOUSE · 7 ROOMS, YOU ARE IN, the seven keys, the
   ask line), THE PLAN open (every room, numbers, stars, clocks, amber dots), the jump bar with a word, two words, a number, nonsense;
   the switcher; the favourites; the widgets. List every rough spot: a state with no message (empty, loading, error, offline, nothing kept
   yet, a dead brain), a word not his (developer words, a label that repeats its row, a sentence over 20 words, two where one would do, a
   greeting that lies about the hour), a wait over half a second with no words, a number without its unit or its word (estimate · measured
   · from your diary), a tap that does nothing or does two things, a control under 44 pt, anything sideways, a thing a good app of that
   kind does better (a weather app's first screen, a launcher, a morning briefing). Rank by how much he would feel it. The whole list is in
   the report, per screen, before any fix.
2. **FIX THE TOP TWENTY-FIVE (Home ten, THE BRIEF five, the house line five, the boot and the orb five), each the smallest change that
   does the job, each with a spec check that fails on the old code.** Known to start with, from the specs' own comments and the first
   critic pass: every instrument's empty state in one line of his (no school: the gauge hides and the space does not gape; no quota known:
   "I haven't asked my brain yet" never a dash); the live-state pill's every word his and never two states at once; the Today card's
   empty line with the one next thing ("Nothing in your diary today. Tell me one thing and I'll keep it."); every fetch Home makes under
   waiting() with what for, and a dead brain said once on Home, not once per instrument; the ask bar's failed send said in his words with
   RETRY; THE BRIEF's greeting true to the hour and the rain line true to the forecast ("rain from 3 pm, measured by the Met Office's feed"
   with its source word), its headlines' section names his, READ IT TO ME stoppable with one tap at 44 pt; the house line's YOU ARE IN
   never stale after a swipe; THE PLAN's numbers and stars at 44 pt and the amber dot's meaning said once on the plan ("amber: in the
   works"); the jump bar's "nothing matches" with the nearest room offered; the boot's every shot true of its moment (a shot that shows a
   number shows the real one), its skip on a tap said once, reduced motion's still boot the same length of words; the orb's hint line
   not gone forever after ten presses (the second route to every room is the house line, said once); the widgets' empty and offline lines.
3. **THE STATES RATCHET gains HOME.** The LIFE pass's table in apps/edge/test/ratchet.test.mjs (per screen, states read from
   `data-state="empty|loading|error|offline"` markers or `/* state: … */` comments, equal or higher) gains rows for Home, THE BRIEF, THE
   PLAN, the jump bar, the boot and each widget, measured on the base and pinned at the new, higher number. The before and after counts
   per screen in the report.
4. **WORDS.** Home's every line at most one sentence; THE BRIEF read aloud in under 60 seconds at the voice's pace (measured by the spec
   from the words' length at 150 words a minute); the rooms' seven `sub` lines in shell/areadefs.ts re-cut to one sentence each in his
   voice (the deck, the finding test and THE PLAN read them: the change is one place); nothing lost: a fact cut from Home goes to WHY or a
   sheet, never to smaller type.
5. **PROVE IT.** Before-and-after stills of Home at the three hours and of THE BRIEF, THE PLAN and the boot's last shot at 440 (ten stills,
   written by the spec, deleted after the report lists them); the boot's time to a usable Home before and after (equal or lower); the
   first-screen budget before and after (tests/speed.spec, equal or lower).
6. **LEAVE THE LIST.** What was found and not fixed, ranked, with why, per screen, so the next pass knows.

## What must not change

The rooms' list and order; what Home shows and from where (every value from the app's own state, each saying when it has none); the boot's
budget and its storyboard's shots (a shot's words may change, its moment may not); the house on every screen in THE SCAN and ONE INK and
Glass's own bar; the first-screen budget and every other budget; GLASS pixel-equal; ONE INK's page; every control 44 pt; nothing sideways
at 440 × 956 or 390 × 844; the finding rule; the colour ratchet (hex 506, rgba 1016, radiusPx 470, total 1992: equal or lower); the prompt
guard; no new key; nothing that can cost money.

## Tests (each fails on the code before this brief; run against it once and say so)

- tests/homepass.spec.mjs (new; `all=` word `homepass` at the END of the list in check.yml, nothing else in .github touched), at 440 and
  390: one check per fix (twenty-five, grouped Home · THE BRIEF · the house line · the boot), each named for the rough spot it closes; plus:
  Home's every empty state's words with the brain dead; the one dead-brain line; a fetch's waiting words; the ask bar's failed send and
  RETRY; THE BRIEF's greeting at the three hours and its spoken length under 60 s; THE PLAN's keys 44 pt; the jump bar's nothing-matches
  line; the boot's skip said once; reduced motion's boot; every control 44 pt; BODY 21 clips nothing; nothing sideways.
- apps/edge/test/ratchet.test.mjs gains HOME's rows in the STATES RATCHET (equal or higher).
- brief, hero, boot, deck, nav, cards, widgets, night, speed, speed2, look, ink, thescan, hubcards unchanged unless a fix lives in a screen
  they own; then that spec's check is the proof, red before, green after, nothing loosened.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8829:
`(nohup setsid node tests/preview-server.mjs 8829 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8829.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8829 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is never committed. In the foreground, alone, one after another: homepass, brief, hero, boot,
deck, nav, cards, widgets, night, speed, speed2, look, ink, thescan, hubcards, lifepass. The brain tests in the background once at the end
(rebuild the preview's brain bundle first: `npx esbuild src/index.ts --bundle --format=esm --platform=neutral --external:cloudflare:sockets
--outfile=test/.build/brain.mjs` in apps/edge). A timing budget missed under load is rerun alone before it is called red. Known sandbox reds
not touched: direct, aim, radio, scroll, safari, eye's own screenshot, tabs2, talk's cooling lines, tabs' `data-id="eye"` finding tap.

## The owner's phone check

1. Cold open at breakfast: the boot, then Home. Is every shot true? Does Home say good morning and mean it?
2. Home with aeroplane mode on: one line about the brain, not four. Each instrument says what it has or that it has nothing.
3. THE BRIEF: READ IT TO ME; stop it with one tap. Is the rain line right for today? Are the headlines' sections your words?
4. Swipe between three rooms: YOU ARE IN is right every time. Open THE PLAN: every number and star under your thumb; the amber dot explained.
5. The jump bar: type "gsdfg": what does it offer? Type "2": where does it go?
6. The orb after ten presses: how do you get to a room now? Is it said?
7. Home at 11 pm and biggest text: nothing cut, nothing sideways.
8. Does Home feel like the best screen in the app? If not, what is the one thing wrong with it?

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/homepass-report.md: the measured list per screen (before any
fix); the twenty-five fixes with before and after (words quoted, numbers where there are numbers, the ten stills named); the states-ratchet
counts before and after per screen; the boot and first-screen times before and after; the leftovers ranked per screen; each spec's last line
(before and after for the new one); NEEDS HIS WORD; the phone check as above; the commit list. One commit per fix on builder/homepass; the
orchestrator squashes to one on landing.
