# BRIEF: GAMES WAVE 2, THE REST — poker and a word game he can lose to, and GAMES 5's own loose ends (games pass 6)

BRIEF-GAMES-6 (OWNER-ISSUES 94 "insanely good quality and not just slop", 172 "no cap on skill", 176 "do all of it", 178; STARS 100 "Ghosty as an
opponent he can lose to: chess (exists), draughts, Connect 4 (exists), poker, backgammon, a word game"; QUEUE-11-NOV item 11; the GAMES 5 report's
found-not-fixed). Of STARS 100 only POKER and A WORD GAME are not built; this pass builds them as games of our own on the GAMES 5 board kit, and
closes what GAMES 5 found and left. Starts FROM GAMES 5's HEAD (4511157a, branch builder/games5; the orchestrator lands only the diff above it,
after GAMES 5 is on main). One builder, one PR. The mid tier. Read STANDARD.md, BRIEF-ARCADE.md (the bar), BRIEF-GAMES-4.md and BRIEF-GAMES-5.md
(the pattern of a game of our own; the board kit, its Worker search, its level dial and its GYM rating), the GAMES 5 report
(scratchpad/games5-report.md), `apps/web/src/arcade/games/board/*` (kit, search, rules, boards, frame, rating, the Worker), `arcade/games/{kit,
audio,shelf3,pad3}.ts`, `features/arcade/index.ts`, `gym/league.ts`, `tests/games5.spec.mjs`. THE QUALITY RULE holds (every state designed,
every word his, every wait said, every number honest, every control 44 pt, nothing merely fine).

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. No package added. Poker is CHIPS ONLY:
nothing in it is, becomes, or is worded as money; the card says so in one line ("Chips, never money.") and the test proves no money word, no
currency sign and no payment path exists in its code. Nothing downloaded except, if the word list cannot be bundled small (below), the list
itself on his tap on Wi-Fi with its size said, its licence written in the report BEFORE a byte is fetched (a public-domain list only).

## What is built

1. **POKER (heads-up hold'em against Ghosty; `arcade/games/board/poker*.ts`):** two players, the standard deck, blinds that rise by level, a
   stack of chips each (never money), fold / check / call / bet / raise under the thumb at 44 pt with the pot and the stacks always said in
   chips; Ghosty's play in the board Worker: Monte Carlo hand equity against a range that narrows with his actions, pot odds, a bet-sizing
   table by street, a bluff frequency that rises with the level, the level dial as GAMES 5's (the dial's top is not a cap: "no cap on skill",
   the search deepens with the level and the thinking time); "thinking…" with the dot while he thinks, never a frozen table; a hand's result
   said in his voice with the winning hand named ("Two pair, kings and fours. The pot is yours."); a session is 20 hands or a bust, the result
   moving the GYM rating as the boards' do (`gym/league.ts`), so the card ends "You: 1200 · Ghosty: 1200" and the Report card lists it;
   fair, seeded shuffling the test can replay; the hand history readable after the session (every card and every bet). Odds shown only when
   asked (a HINT: his equity as "about 61%", said as an estimate).
2. **A WORD GAME (ours, not a trademark's; `arcade/games/board/words*.ts`):** a 15 × 15 board with a bonus layout of our own, seven tiles on a
   rack, the hundred-tile bag with letter counts and points of our own choosing (written in one table), a word placed by dragging tiles to
   squares or by tapping square then rack; every word checked against the list; a challenge is not needed (an invalid word is said at once:
   "Not in my list."); the score for every word said with its bonuses named; swap, pass, the end when the bag is empty and a rack is out, the
   final count. Ghosty's play in the Worker: all placements from the rack through the list's trie, scored, with leave-value and board-defence
   weights that rise with the level; at the top levels he plays the best he finds, at level 1 he plays short words. Rated as the boards are.
   THE LIST: first look for a word list already in the tree; if none, a public-domain English list (the report names it and its terms before a
   byte is taken), compressed as the app's own trie or packed bitset; if the packed list is under 300 KB in the bundle it is bundled, else it is a
   download on his tap on Wi-Fi with the size said, kept on the phone, removable, and the game says so before the first move ("The word list is
   a 1.2 MB download, once, on Wi-Fi."). The word list is words only: no definitions, no proper nouns.
3. **GAMES 5's loose ends, every one closed or said:** (a) backgammon's take-back takes back the whole turn, not one die's move; (b)
   `board.worker.js` (and every other Worker the app ships) listed in the service worker's precache so a game plays offline from the first
   open, with the test that reads sw.js and the build's output and finds every `.worker.js`; (c) the cave bot's wobble: Ghosty's cave level
   does not fall below what he has reached unless he loses three sessions running, said on the card; (d) the platformer bot stomps at world 1
   when a stomp is the shortest way; (e) Othello's and backgammon's playouts made faster (the move generator without allocation; the report
   gives playouts a second before and after on the preview) so level 12 answers within the dial's time on the phone's class of chip; (f) a
   damaged save says "That save was damaged, so this is a new game." instead of a silent new game.
4. **THE ARCADE'S ROW:** two new tiles after CONNECT 4 (POKER, WORDS), each ending in the two ratings; the shelf's counts, the catalogue
   (phrase, hub, screen), the chat ("play poker", "a word game"), THE PLAN's numbering and every list that counts the arcade learn them.
5. **PICO-8 and Cave Story itself** stay NEEDS HIS WORD, named in the report, not built (GAMES 5's reasons stand).

## What must not change

GAMES 5's six games and their ratings; the GYM's chess; every budget (the first screen, speed2, ink, look); GLASS pixel-equal; ONE INK's page;
every control 44 pt; nothing sideways at 440 × 956 or 390 × 844; the ratchet ceiling (hex 506, rgba 1016, radiusPx 470, total 1992: equal or
lower; the games' canvases draw from the kit's palette, not CSS); the prompt guard; no new key; no money anywhere.

## Tests (each fails on the code before this brief; run against it once and say so)

- apps/edge/test/games6.test.mjs (new; imported from router.test.mjs by one import line as games5.test is; NEEDS HIS WORD names it): poker's
  hand ranking on known hands (every category, ties, kickers), a seeded deal replayed, the equity estimate within 3 points of the exact
  answer on three known spots, the bot's betting legal in a thousand seeded hands, no money word or currency sign in poker's source; the word
  game's placement rules (anchor, connected, one line, every new word in the list), its scoring with bonuses on known boards, the trie's
  lookups, the bag's counts sum to one hundred, the bot's best move on a known rack and board; backgammon's whole-turn take-back; the precache
  lists every Worker the build makes; the cave level floor; the platformer bot stomps at world 1 on a built case; the damaged save's line.
- tests/games6.spec.mjs (new; `all=` word `games6` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390: (a)
  the ARCADE room lists POKER and WORDS after CONNECT 4 with PLAY at once, each ending in the two ratings; (b) poker: a hand dealt, a bet made
  under the thumb, Ghosty answers within his thinking time with "thinking…" shown, the pot and the stacks in chips, a hand's result in his
  voice, HINT says "about N%", the session ends and the rating line moves, "Chips, never money." on the card; (c) words: a word placed by
  drag and by tap, an invalid word refused with the line, the score said with its bonus, SWAP, PASS, Ghosty plays a real word from the list,
  the end and the count; the list's size line if it is a download, and the download only after a tap; (d) offline from a fresh open: a board
  game plays with its Worker from the precache; (e) backgammon's take-back takes the whole turn; (f) every control 44 pt, nothing sideways,
  reduced motion stills every animation, sound on and off; (g) the GYM's Report card lists the six board ratings.
- games5, games4, games3, games2, arcade, gym, deck, nav specs unchanged unless a fix lives in a screen they own (games5's take-back check and
  the arcade's counts will move: counts only).

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8835:
`(nohup setsid node tests/preview-server.mjs 8835 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8835.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8835 NO_GL_SHOTS=1 timeout 590 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` and tests/.shots are NEVER committed (git status before every commit; tests/.shots removed after
every run). In the foreground, alone, one after another: games6, games5, games4, arcade, gym, deck, nav, speed2, look, ink, thescan. The brain
tests once at the end. A timing budget missed under load is rerun alone before it is called red and the budget is never changed; a spec killed
at 590 s with no failure line is rerun once and then reported with its last printed line. Known sandbox reds not touched: direct, aim, radio,
scroll, safari, eye's own screenshot, tabs2, talk's cooling lines, tabs' jump bar under load. The machine is shared: load 11 to 20 is normal;
one spec at a time.

## The owner's phone check

1. ARCADE: two new tiles after CONNECT 4: POKER and WORDS, each ending in "You: 1200 · Ghosty: 1200".
2. POKER: play twenty hands at level 1, then at level 10. Does he bluff? Does the hand's result read right ("Two pair, kings and fours")?
   HINT: "about 61%". The card says "Chips, never money."
3. WORDS: drag seven tiles into a word; a made-up word is refused at once; the score says its bonus; Ghosty plays a real word. Can you beat
   him at level 1? At level 12?
4. BACKGAMMON: a take-back now takes the whole turn back.
5. Aeroplane mode, app closed and reopened: DRAUGHTS and POKER still play (the Worker is kept on the phone).
6. Tomorrow: the GYM's Report card lists six board ratings.
7. Does either feel like filler? Say which.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/games6-report.md: what was built, each game's size minified,
the word list's name, terms, packed size and whether it is bundled or a download (written before a byte is taken), playouts a second before
and after for Othello and backgammon, frame time p95 on the shared machine (not the phone), each spec's last line (before and after for the
new ones), found-not-fixed, NEEDS HIS WORD (PICO-8, Cave Story itself, the test's name in the list), the phone check as above, the commit
list. One commit per step on builder/games6; the orchestrator squashes to one on landing.
