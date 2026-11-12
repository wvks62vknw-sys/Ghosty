# THE QUEUE from 11 November ("do all of it", OWNER-ISSUES 176)

Everything in THE-GUIDE-11-NOV sections 6, 7 and 8, as briefs, in this order. Four builders at a time at most; each brief is written in full
(rules verbatim, protected files, tests, validation, phone check, report) just before its builder starts; each lands as one PR, merged only on
a run green first time; main's own run read after. The top tier reviews every diff before it is handed to the orchestrator. Ticked when on main.

## Running or landing now
- 12 Nov, his "yes to all" (OWNER-ISSUES 185): physics stays in KERNEL 2; RAW, matting and inpainting become a PHOTO 2 pass; stabilisation
  and best clips a VIDEO 2 pass; slides, video and workspace tools a KERNEL 3; "Share to Ghosty" is SMALL FIXES 2c in POLISH 3.
- 12 Nov, his word "i don't mind you doing several PR's at once" (OWNER-ISSUES 184): landings run from their own branches, up to three pull
  requests at once; merges still one at a time in the order below. TRY-IT-NOW.md and WHATS-LEFT.md are his two short pages.
- [x] ENGINE 3D (on main 11 Nov, PR 83, green) · THE MAP (on main 11 Nov, PR 84, green)
- [x] THE EYE HUD, SPEAKER, SMALL FIXES 1 (on main 12 Nov, PR 86, green) · DOCUMENTS (on main 12 Nov, PR 89, green on main's own run) ·
      TRAINING (on main 12 Nov, PR 87, e977f173, green on main's own run; carries the Home fix for the jump bar's open) ·
      PHONE HARDWARE (on main 12 Nov, PR 90, ad89847, green on main's own run)
- [ ] Landing, in order: OCTOBER IDEAS 1 · LIFE EASIER ·
  POLISH 1 · POLISH 2 · OCTOBER IDEAS 3 · ORBIT HUD · GROWN UP HUD · THE WALL · SPREADSHEETS · GAMES 5 · THE WORKING ENGINE ·
  QUALITY PASS: LIFE · QUALITY PASS: HOME · RELIABILITY AND HEALTH · PRESENTATIONS · THE WORKSPACE · QUALITY PASS: SEE · QUALITY PASS: MAKE (builder/makepass, base 08a5337a, head 4741dc42, entry 210) · QUALITY PASS: PLAN AND ME (builder/planmepass, base 08a5337a, head 093ba13f, entry 211; union with MAKE's ratchet rows and `all=`) · PHOTO (on the fold: builder/photofold, base 16458d0a, head 0aff585c, entry 204; lands right after THE WORKSPACE) · PHOTO 2 (builder/photo2, base 37bdc01a, head d061a0be, entry 209; lands right after PHOTO) · VIDEO (on the fold: builder/videofold, base 0aff585c, head 3bcd43b6; its reserved entry; lands right after PHOTO 2; tabs2's 42 count stands on CI's word) · GAME STUDIO (on the fold: builder/gsfold head e2cd3f18; land only 0e605afa..e2cd3f18, the 15 commits under them are GAMES 5 scaffolding; entry 208) · GAMES 6 (builder/games6, base 4511157a, head a2f11908, entry 215; lands last, union with the fold's `all=`)
- [ ] Building: VIDEO 2 (BRIEF-EDITOR-VIDEO-2; from VIDEO's fold head 3bcd43b6, worktree video2, branch builder/video2, port 8839) · QUALITY PASS: LEARN (from the MAKE pass head 4741dc42, worktree learnpass, port 8840; entry 212) · KERNEL 2 (BRIEF-KERNEL-2; from main 8762f9b4 after POLISH 1, worktree kernel2, branch builder/kernel2, port 8818)

## The quality rule (his words, 11 Nov evening: "insane quality … even things in the past")
Every brief from here says it and every review holds it: every state of every screen designed (empty, loading, error, offline, biggest text,
one-handed); every word his, one sentence a screen; every wait over half a second says what for in his voice; every number honest with its
word (estimate, measured, first estimate · not certified); every control 44 pt; 120 Hz where the phone gives it; a speed budget in every spec;
the top tier reads the whole diff as a critic before landing and sends back what is merely fine. The old surfaces get the same bar through the
QUALITY PASSES below, one room each, each with a ratchet test so the old shape cannot return.

## Next, in order
1. OCTOBER IDEAS 2, life easier: "Hey Siri, ask Ghosty…" and a share-to-library Shortcut; the Brief read aloud on the first open and "leave by"
   times; "What did I miss?"; money nudges from the statements; "teach me what you learned this week"; a photographed letter becomes a reminder
   and a filed document; watchers ("tell me when this price drops / this page changes / there's a strike on my line"); email triage into the
   Brief with drafts for his OK (his own email through Links only; nothing sent without him).
2. POLISH 1, the edges: the new worlds' empty, loading and error states; sheets over the printed page; the house line and foot at the biggest
   text; one error funnel into his own words with a test that fails on a raw browser string; every wait over half a second says what for.
3. OCTOBER IDEAS 3, further: interpreter mode (two-way spoken translation, on the phone when offline); the orb as a real map of what he knows;
   Ghosty proposing his own missing tools through self-edit (shipped only on his word); a lab tab; WALK ME THROUGH IT; WHAT CHANGED SINCE
   YESTERDAY; REHEARSE; places and spending together; the nature diary; the weekly "what Ghosty learned" note on Sunday morning.
4. POLISH 2, the picture: the Stage's charts, maps, documents and 3-D rooms made good (labels, zoom, light, the hand-over from the sentence);
   the Lens's tags smoothed; a drawn picture sent to Telegram as an image.
5. THE TWO LOOKS: ORBIT (Mind is the way in), then GROWN UP (today, with less on it), each a whole HUD like THE MAP and THE EYE.
   Briefs written 11 Nov: BRIEF-ORBIT-HUD (worktree orbithud, port 8816, spec orbithud) and BRIEF-GROWN-UP-HUD (worktree grownup, port
   8817, spec grownup). ORBIT handed back 11 Nov evening (reviewed clean, in the landing queue after THE EYE); GROWN UP started the
   same hour in worktree grownup standing on ORBIT's six commits cherry-picked, so it lands as the diff above that tip, the EYE-over-MAP way.
   GROWN UP handed back 12 Nov (reviewed clean; the capsule, THE ROOMS layer, the folds; the one bar when Home's conversation is open and
   the Mind's mic glyph decided under 179); in the landing queue right after ORBIT.
6. POLISH 3, the words and the two screens: one sentence a screen (Settings, System, the Theme page, the packs); the Agenda and System upgrade
   passes; SMALL FIXES 2 ("On it." proven in the phone's own voice and never over DOWNLOAD; the money pack's price watches and WATCHERS one
   system). The boot's slow open went to POLISH 1. Brief written 11 Nov: BRIEF-POLISH-3 (worktree polish3, port 8819, spec polish3); starts
   after OCTOBER IDEAS 1, LIFE EASIER and POLISH 1 are on main.
7. THE EDITORS 3 to 8, in the programme's order (PROGRAMME-EDITORS): spreadsheets, presentations, the workspace, photo, video, the game studio.
   Brief written 11 Nov for the third: BRIEF-EDITOR-SPREADSHEETS (worktree sheets, port 8821, spec sheets; the app's own formula engine and
   .xlsx over convert/zip.ts, no package); starts after DOCUMENTS is on main.
   Brief written 11 Nov night for the fourth: BRIEF-EDITOR-PRESENTATIONS (worktree slides, port 8825, spec slides; the app's own .pptx
   over convert/zip.ts, the documents' blocks reused, a report becomes a deck, PRESENT ON THE WALL where landed); cherry-picks DOCUMENTS
   if it starts before that lands.
   SPREADSHEETS handed back 12 Nov (reviewed clean; 169 formula results equal; MAKE holds nine on a two-row band, decided under 179); in
   the landing queue after THE WALL. PRESENTATIONS started the same hour in worktree slides, standing on DOCUMENTS cherry-picked.
   Brief written 12 Nov for the fifth: BRIEF-EDITOR-WORKSPACE (worktree workspace, port 8827, spec workspace; pages on the documents'
   blocks, databases with relations, rollups and formulas through the spreadsheets' engine, five views, templates, backlinks, history, a
   project read whole as one chat turn with the size said; the editors fold under one EDITORS card past ten MAKE things); cherry-picks
   DOCUMENTS and SPREADSHEETS if it starts before they land.
   PRESENTATIONS handed back 12 Nov (reviewed clean: the app's own .pptx written and read back, 234 spec checks, a thirteen-slide round
   trip in 67 ms); in the landing queue after the LIFE pass. THE WORKSPACE started the same hour in worktree workspace, standing on
   DOCUMENTS, SPREADSHEETS and PRESENTATIONS cherry-picked. The MAKE count, settled 12 Nov under 179: main holds 8, DOCUMENTS adds none (it
   upgraded MY DOCUMENTS in place), SPREADSHEETS 9, PRESENTATIONS 10 on the two-row band, THE WORKSPACE 11 and builds the EDITORS fold with
   its pills from one list; so the editors land SPREADSHEETS → PRESENTATIONS → WORKSPACE → PHOTO, and PHOTO's builder rebases onto the fold
   before it lands.
   Brief written 12 Nov for the sixth: BRIEF-EDITOR-PHOTO (worktree photoedit, port 8831, spec photoedit; a non-destructive recipe over
   the untouched original, the app's own WebGL2 passes with a CPU path that must agree, masks, heal, a layer, presets and batch, full-size
   export in tiles; the PHOTO TOOLS' three brain keys kept as they are; RAW and on-phone matting NEEDS HIS WORD); starts from the session
   branch.
   PHOTO started 12 Nov in worktree photoedit when GROWN UP handed back.
   Brief written 12 Nov for the seventh: BRIEF-EDITOR-VIDEO (worktree video, port 8834, spec video; clips on a timeline with trims, splits,
   speed, transitions, titles, the PHOTO grade and a .cube LUT, music, a voice-over with ducking, subtitles by his brain's own hearing route,
   chroma key and overlays; WebCodecs with the app's own flat .mp4 muxer where the phone has it, else the phone's recorder in real time, the
   path and the size said; scenes and pauses found on the phone; stabilisation, best clips, Director Mode and reverse NEEDS HIS WORD); starts
   from the session branch and lands after PHOTO, its builder rebasing onto the fold first. VIDEO started 12 Nov in worktree video when
   RELIABILITY AND HEALTH handed back.
   PHOTO handed back 12 Nov (reviewed clean: a 12-megapixel export in six tiles, GPU against CPU equal, the original byte-equal; RAW,
   matting and inpainting to PHOTO 2 under his yes); parked until THE WORKSPACE is on main, then rebased onto the fold and landed.
   Brief written 12 Nov for the eighth: BRIEF-EDITOR-GAME-STUDIO (worktree gamestudio, port 8835, spec gamestudio; a 2-D game maker on the
   platformer's and the cave's own engine: rooms painted in tiles, a pixel editor for sprites, characters with dialogue and shops, things,
   quests, rules, sound, save points; one runtime plays any game on the ARCADE shelf; .ghostygame shared; AS AN APP through the sites
   path or said honestly; 3-D, multiplayer and money not in it); starts from GAMES 5's head and lands after GAMES 5 and the fold. THE GAME
   STUDIO started 12 Nov in worktree gamestudio when PHOTO handed back.
   VIDEO handed back 12 Nov (reviewed clean: fifteen commits, the app's own .mp4 muxer and reader, both export paths, 182 spec checks; the
   size said before an export made honest by the recorder's own rate and a one-line truth when the file still differs); parked behind
   WORKSPACE and PHOTO for the fold. Brief written 12 Nov under his yes (185): BRIEF-EDITOR-PHOTO-2 (worktree photo2, port 8836, spec photo2;
   the cut-out model, the erase model and a RAW reader as packs on his tap with the size said, licences and sizes written before a byte is
   vendored; starts from PHOTO's head, lands after PHOTO). PHOTO 2 started 12 Nov in worktree photo2 when VIDEO handed back.
   THE WORKSPACE handed back 12 Nov (reviewed clean: pages, databases through the spreadsheets' engine, five views, templates, versions,
   the EDITORS fold with its pills from one list, MAKE showing 8 cards, 210 edits in a simulated week with none lost); queued after
   PRESENTATIONS as OWNER-ISSUES 206. Its found-not-fixed routed: the editors' keys in the daily backup and the 40 px button rule to POLISH 3
   (SMALL FIXES 2d). PHOTO is being cherry-picked onto its head (worktree photofold) so it lands right after without waiting for main; VIDEO
   follows the same way.
8. PHONE IN HAND, MACHINE ON THE WALL (STARS 165): the Machine on a TV or laptop screen, the phone the remote.
   Brief written 11 Nov: BRIEF-MACHINE-WALL (worktree wall, port 8820, spec wall; the wall's brain route in its own file); no landing it
   waits on, so it takes the next free slot when the HUD briefs are blocked.
   Handed back 11 Nov night (reviewed clean; routes under /guardian/wall; the wall starts from ?wall=1 or THIS IS THE WALL so TV MODE is
   unchanged); in the landing queue after ORBIT.
9. RELIABILITY AND HEALTH (the depth plan's Pass 2): a WORKING / DEGRADED / NEEDS KEY / OFFLINE mark on every ability, verification on actions,
   the permissions screen; the "that felt off" tap that files a moment with its screen (SMALL-GAPS' capture).
   Brief written 11 Nov: BRIEF-RELIABILITY (worktree health, port 8823, spec health; the brain's health route in its own file mounted
   under /guardian); starts after POLISH 1 is on main (its error voice and wait helper).
   Started 12 Nov in worktree health, made from POLISH 1's head (72f121c6) so its error voice and wait helper are in the tree; the
   orchestrator lands only the diff above that head, after POLISH 1 is on main.
   Handed back 12 Nov (reviewed clean: the four marks computed never written, actions verified by read-back, PERMISSIONS, crash records,
   THAT FELT OFF; health.test on one import line); in the landing queue after the LIFE pass, with which it shares its base.
10. THE DEPTH PLAN, pass by pass (PLAN-STARS passes 1b, 1c, 3 to 11): memory and recall, character, the Lens acting on what it sees, fun, answers,
    making, life deep, the rest.
11. GAMES WAVE 2: the Cave Story-like, a platformer, PICO-8 carts, the others he named; AlphaZero-style board games on the phone's chip.
    Brief written 11 Nov: BRIEF-GAMES-5 (worktree games5, port 8822, spec games5): THE PLATFORMER and THE CAVE as games of our own, four board
    games searched on the chip and rated in the GYM's league (learning on the free GPU, per 179 f); Cave Story itself and PICO-8 named as
    NEEDS HIS WORD, not built. Waits on no landing.
    Handed back 12 Nov (reviewed clean; six games, the boards searched in a Worker, Glicko-2 ratings as chess; a cell-0 move bug found by
    its own spec and fixed); in the landing queue after SPREADSHEETS.
12. THE WORKING ENGINE: a real 3-D engine model that turns, in the Studio, with every part named (first estimate, never certified).
    Brief written 11 Nov: BRIEF-WORKING-ENGINE (worktree workingengine, port 8824, spec workingengine; the car's own geometry over the
    three.js the Studio loads, kinematic, no package; physics stays at KERNEL 2). ENGINE 3D and THE CAR are on main: waits on no landing.
    Started 11 Nov night in worktree workingengine when THE WALL handed back.
    Handed back 12 Nov (reviewed clean; kinematic engine from the car's record, 28 parts with sheets, 14 brain tests; the tray's ENGINE
    stays 120 × 60 × 70 and the table is not put under IN THE WORKS, decided under 179); in the landing queue after GAMES 5.
13. QUALITY PASSES, one room a PR, interleaved from here with the items above (one quality pass after every two new builds): HOME and the
    house line · SEE (God's Eye, the Machine view, the Lens, threats) · MAKE (the Workshop, the Studio, the Workbench) · LEARN (courses, the
    arcade, the GYM, school, the library) · PLAN (the Brief, the Agenda, spending, markets, radio) · LIFE (the eight packs) · ME (Memory, Settings,
    System, Links, Social) · the chat itself (the log, the Stage, WHY, the ask line) · Telegram · the boot and the orb. Each pass: every state,
    every word, every wait, every number, every tap; before-and-after stills in the report; nothing new added, everything there made right.
    Seeded 11 Nov from the first critic pass over the twelve unlanded diffs (scratchpad critic-pass-1.md; the top tier's read-only critic):
    each build's words, missing states and unsaid waits are listed per file and line and go to the pass that owns its room, and each PR's
    entry names them as found-not-fixed. Rule-level findings were fixed at landing instead (a confirm on the mail send; the ack never over
    DOWNLOAD; a failed Telegram picture said once; the raw-error sites swept through the one error voice when its lint lands).
    First pass written 12 Nov: BRIEF-QUALITY-LIFE (worktree lifepass, port 8826, spec lifepass): the eight packs measured and the top ten
    per pack fixed, a STATES RATCHET; made from POLISH 1's head so its error voice is in the tree; lands after POLISH 1.
    Started 12 Nov in worktree lifepass when GAMES 5 handed back. Handed back 12 Nov: eighty fixes, ten a pack, each with a spec check red
    on the base; the STATES RATCHET over 32 screens, 44 states before and 98 after; reviewed clean and queued after THE WORKING ENGINE.
    Second pass written 12 Nov: BRIEF-QUALITY-HOME (worktree homepass, port 8829, spec homepass): Home, THE BRIEF, the house line, the
    boot and the orb measured and twenty-five fixes made, HOME's rows in the STATES RATCHET; starts from the LIFE pass's head when it hands
    back; lands after it. Started 12 Nov in worktree homepass from the LIFE pass's head (d713414d) the hour it handed back. Handed back 12 Nov: twenty-three of the twenty-five fixes (the two
    unreached are the boot's, left to the boot-and-orb pass), the ratchet's HOME rows, 95 spec checks; reviewed clean, queued right after the
    LIFE pass as OWNER-ISSUES 203.
    Third pass written 12 Nov: BRIEF-QUALITY-SEE (worktree seepass, port 8832, spec seepass): God's Eye, the Machine view, the Lens's
    every mode, Threats and the eyes' pack rows measured and twenty-five fixes made, SEE's rows in the STATES RATCHET; the people rule's
    logic and the models' pins untouched; starts from the HOME pass's head when it hands back; lands after it. Started 12 Nov in worktree
    seepass from the HOME pass's head (9f7338e5) the hour it handed back. Handed back 12 Nov: thirty-one fixes against twenty-five, SEE's
    eighteen ratchet rows, 218 spec checks; reviewed clean (its four nogl scratch copies of specs removed, 08a5337a; thescan re-run clean,
    the builder's red a flake); queued right after the HOME pass as OWNER-ISSUES 205.
    Fourth pass written 12 Nov: BRIEF-QUALITY-MAKE (worktree makepass, port 8838, spec makepass): the Workshop, the 3D studio, Reverse,
    Space, the Workbench and the tunnel, Convert and House measured and twenty-five fixes made, MAKE's rows in the STATES RATCHET; the hub
    cards and band (THE WORKSPACE's fold), the editors, the engine's scene and the solvers untouched. Started 12 Nov in worktree makepass
    from the SEE pass's head (08a5337a) the hour it handed back; lands after it.
    Fifth pass written 12 Nov: BRIEF-QUALITY-LEARN (worktree learnpass, port 8840, spec learnpass): courses, the Arcade's shelf, the GYM's
    cards, School, the Library and the reader, Learning and the Coach measured and twenty-five fixes made, LEARN's rows in the STATES
    RATCHET; the games, the workers, the papers, the reader's page engine and the hub cards untouched. Starts from the MAKE pass's head when
    it hands back; lands after it.
13b. VIDEO 2 (BRIEF-EDITOR-VIDEO-2, written 12 Nov; worktree video2, port 8839, spec video2): under his yes (185): STEADY by the app's own
    block matching and a smoothed camera path, BEST CLIPS scored on the phone (sharpness, light, motion, variety; the namer only where kept),
    ON THE BEAT from the music's onsets, REVERSE and a SPEED RAMP; nothing new downloaded unless proved. Starts from VIDEO's head on the fold
    when that rebase hands back; lands after VIDEO.
14. REINFORCEMENT AT SCALE (GRPO-style) inside the free GPU budget, said honestly if the budget does not allow; the self-edit trial measured.
15. KERNEL 2 (BRIEF-KERNEL-2, worktree kernel2, port 8818): the protected-file calls decided under OWNER-ISSUES 179: the brain's test list names
    what it runs, a `document` tool, physics for the engine (one package), automatic rollback after a publish that fails its own first check.
    Starts after DOCUMENTS, ENGINE 3D, TRAINING and POLISH 1 are on main. SMALL FIXES 2 rides with POLISH 3: the spoken "On it." in the
    phone's own voice, not covering DOWNLOAD. Also in SMALL FIXES 2: the money pack's twice-a-day price watch and WATCHERS made one system (lifeeasier's found-not-fixed).

## His hands only (not builds; asked once, here)
The Pl@ntNet, Formspree, DVSA MOT and two free AI keys; the PS5 TV MODE test; the 0.5B SIT result; the voice blind check; his principles in his
own words; the kernel's remaining call (kernel-yes.test.mjs named in the brain's test list: recommend yes).

- PHOTO onto the fold handed back and reviewed 12 Nov: seven PHOTO commits cherry-picked onto THE WORKSPACE's head 16458d0a plus three fold commits (head 0aff585c). One line in EDITORS (`{ id: 'photo', pill: 'PHOTO' }`); the EDITORS card's line counts kept photos; MAKE still 8 cards, five pills ending PHOTO; counts screens 49, THE PLAN 41 things, MAKE 12 with HOUSE at 12; `all=` ends `... workspace photoedit`. Every spec green except tabs' jump bar under load 19 (not in the diff; its cause cut at Home's per-frame loop by the landing agent on TRAINING's branch, 911bfcbf). Brain tests 822 ok. VIDEO goes onto the fold the same way from 0aff585c (builder/videofold), `all=` to end `... photoedit video`, six pills.

- THE GAME STUDIO handed back and reviewed 12 Nov: branch builder/gamestudio, base 4511157a (GAMES 5's head, before the fold), head 98bcd26d, 11
  commits, 51 files. Clean on the rules: no protected file but `all=` (ends `... games5 gamestudio`), no model names, nothing downloaded, a game of
  his stays on the phone. Spec green at 440 and 390 alone; its brain test 12 of 12 by one import line in router.test. Decisions under 179:
  (a) it lands ONLY on the fold: when VIDEO's fold hands back, the studio is rebased onto that head as the seventh pill GAME STUDIO of the EDITORS
  card (its own MAKE card goes; hubcards' band cap of nine, the one loosening, goes back to eight; MAKE stays 8 cards); that rebase also makes
  the exported page carry its icon once (175 of 278 KB were the icon twice) and shortens the PUT IT ON MY SITES line to one sentence in his
  voice ("I can't put this on your sites yet: that needs a change to my server, which needs your word. The file in the library is yours.");
  (b) PUT IT ON MY SITES (a Worker route serving a stored page at /s/<name>/ with its own policy and a phone-callable publish) and a `game`
  brain tool are KERNEL 3 items, with the two test names (games5.test, gamestudio.test) for the brain's test list; asked of him in WHATS-LEFT;
  (c) the studio's 230 KB in the one bundle (first screen +6% here) is a build-shape change for POLISH 3 or KERNEL 3, not this PR. Entry 198
  for GAMES 5 stands; the studio takes entry 208.
- GAMES 6 brief written 12 Nov: BRIEF-GAMES-6 (worktree games6, port 8835, spec games6, base 4511157a = GAMES 5's head; lands after GAMES 5):
  POKER (chips, never money) and A WORD GAME of our own against Ghosty on the board kit, rated in the GYM; GAMES 5's loose ends (whole-turn
  take-back, Workers precached, the cave level floor, the stomp at world 1, faster playouts, the damaged save's line). PICO-8 and Cave Story
  itself stay NEEDS HIS WORD. Started 12 Nov when THE GAME STUDIO handed back.

- PHOTO 2 handed back and reviewed 12 Nov: branch builder/photo2, base 37bdc01a, head d061a0be (12 commits). Vendored with licence and size
  written before a byte: the cut-out model 4.6 MB (Apache-2.0), the erase model 55.7 MB in three parts (our own int8 weights; a ready-made int8
  file was rejected as unverifiable and wrong by 121/255), LibRaw 0.22.1 as WebAssembly 0.93 MB (LGPL-2.1/CDDL-1.0, binding MIT; a first
  library was rejected because it needed a content-security relaxation in _headers, which the builder was refused and did not work around).
  Nothing fetched before his tap; each pack with its size; offline said. `all=` ends `... photoedit photo2`. Two licence files renamed to
  LICENSE.txt so no model name stands in a path (182's rule). Spec photo2 green at both widths; the known load reds (lens, speed2, look, ink)
  not in the diff. Decisions under 179: no extra big-pack warning for the 70 MB erase pack beyond its size said; true 16-bit RAW editing
  (a float source in photo/gpu.ts) left for a later PHOTO pass; the brain test on one import line. Entry 209.
- QUALITY PASS: PLAN AND ME brief written 12 Nov: BRIEF-QUALITY-PLAN-ME (worktree planmepass, port 8841, spec planmepass, base 08a5337a, the
  SEE pass's head, shared with the MAKE pass; lands after the MAKE pass with the ratchet rows and the `all=` word resolved as a union). Owns
  SPENDING, THE MARKETS, THE RADIO, MEMORY, SETTINGS' pages, SYSTEM's pages, LINKS and SOCIAL (25 fixes); NOT the Agenda's, Settings' and
  System's fronts (POLISH 3's), THREATS or the packs page (the SEE pass's). Started 12 Nov when PHOTO 2 handed back.
- 12 Nov, VIDEO's fold hand-back: builder/videofold head 3bcd43b6 (VIDEO 1–15 cherry-picked onto PHOTO's fold head, one fold commit); reviewed
  clean (one `all=` word at the end, no model name, counts only in the tests, MAKE still 8 cards, six pills). tabs2 stayed red on the known
  jump-bar budget so its 42 count stands on CI's word. GAME STUDIO's rebase onto 3bcd43b6 started at once (worktree gsfold, port 8837); VIDEO 2
  (BRIEF-EDITOR-VIDEO-2, port 8839) takes the next free slot.
- 12 Nov, the MAKE pass hand-back: builder/makepass head 4741dc42, 25 fixes plus eight beyond the brief, 264 checks green, ratchet rows only
  rising, two tests edited and neither weaker; reviewed clean, entry 210. Its five NEEDS HIS WORD decided under 179 into POLISH 3 item 9;
  GLASS/ONE INK 40 pt stays. LEARN pass started from 4741dc42 (worktree learnpass, port 8840, entry 212); PLAN AND ME takes 211. Mine next: 213.
- 12 Nov, the PLAN AND ME pass hand-back: builder/planmepass head 093ba13f, 25 fixes, 211 checks green, 12 ratchet rows, three specs edited
  and none weaker; reviewed clean, entry 211. Two of its NEEDS HIS WORD decided under 179 by his posting rule: the draft card's refuse key stays
  NO (as Telegram's) and a failed post's key stays APPROVE. seepass/homepass/lifepass/nav could not finish under load here (the base the same):
  CI's shards decide. VIDEO 2 started from 3bcd43b6 (worktree video2, port 8839).
- 12 Nov, BRIEF-QUALITY-CHAT written (the eighth quality pass: the log, a turn's states, the talk bar, the Stage, the sources, the phone's
  own answers, the guardian's words only; from the LEARN pass head; spec `chatpass`; port 8842; entry 213 when it hands back; mine next 214).
- 12 Nov, BRIEF-QUALITY-TELEGRAM written (the ninth quality pass: every message Ghosty sends in Telegram and the pairing page; telegram.ts is
  not protected, agent.ts's two routes untouched; from the chat pass head; spec `telegrampass`; port 8843; entry 214 when it hands back; mine
  next 215).
- 12 Nov, BRIEF-KERNEL-3 written (slides, videoedit, workspace and game tools for the brain under his 185 yes; the test list carried on; the
  sites route ONLY IF he answers yes to WHATS-LEFT's question, else NOT REACHED: HIS WORD; no new `all=` word; port 8844; starts after
  KERNEL 2, PRESENTATIONS, WORKSPACE, VIDEO, VIDEO 2 and GAME STUDIO are on main).
- 12 Nov, GAME STUDIO's fold hand-back: builder/gsfold head e2cd3f18 (GAMES 5's 15 commits as scaffolding, then the 11 studio commits and one
  fold commit); reviewed clean: `all=` ends `... video games5 gamestudio`, MAKE still 8 cards, seven pills, icon once (160,767 B), SITES_LINE
  one sentence, counts 51/43/14. FOUND ON MAIN: a stray `=======` at apps/web/styles.css:7219 from PR #86 drops the `.eyesizes` rule; the
  landing agent removes it in its next landing with a guard (ratchet.test asserts no marker lines; a brain test sweeps tracked files).
  KERNEL 2 starts from main once POLISH 1 (#91) is green there; POLISH 3 once #92 is too.
- 12 Nov, BRIEF-EYE-HUD-2 written (the rooms as the wall, the film for the eye, abilities as a feed, the first pass's four leftovers; spec
  `eyehud2`; port 8845; starts after GAME STUDIO is on main). The landing agent found and removed two more lone `=======` strays of its own in
  #92 and #93 (runs restarted); every builder branch scanned clean beyond main's inherited one; the guard goes into the first landing after
  #91–#93 merge.
- 12 Nov, BRIEF-QUALITY-BOOT-ORB written (the tenth quality pass: the boot's and the orb's every state, the ribbon; spec `bootpass`; port 8846;
  starts from main once #91 and #92 are green there; the HOME pass's boot words taken as given, union at landing). Every room pass is now
  written: chat, Telegram, EYE 2, boot and orb wait for their starts; KERNEL 2 and POLISH 3 wait for #91/#92.
- 12 Nov, POLISH 1 merged (#91, 8762f9b); KERNEL 2 started from that main at once (worktree kernel2, port 8818); its entry number is the
  orchestrator's reserved one. I mark POLISH 1 live when main's own run is green.
- 12 Nov, GAMES 6 hand-back: builder/games6 head a2f11908; poker and WORDS, GAMES 5's six loose ends; the word list ENABLE (public domain,
  terms written before the fetch) packed to 361,924 B and fetched only on his tap with the size said; reviewed clean, entry 215; mine next
  216. Decisions under 179: the full list stays a download; "Chips, never money." stays; PICO-8/Cave Story still his word. Slot waits for #92.
- 12 Nov, BRIEF-DEPTH-MEMORY written (PLAN-STARS pass 1b: RECALL in the prompt within the ceilings, "what did I ask you about X" on the
  phone by meaning with the model already vendored, a `reply` watcher for a chase, his own things indexed on the phone at idle; spec `recall`;
  port 8847; the `recall` tool goes in tools/memory.ts, not protected; starts after POLISH 3 and the PLAN AND ME pass are on main).
