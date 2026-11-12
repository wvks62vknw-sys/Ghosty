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
- [x] THE EYE HUD, SPEAKER, SMALL FIXES 1 (on main 12 Nov, PR 86, green) · DOCUMENTS (on main 12 Nov, PR 89, green on main's own run)
- [ ] Landing, in order: TRAINING FOR REAL · THIS PHONE · OCTOBER IDEAS 1 · LIFE EASIER ·
  POLISH 1 · POLISH 2 · OCTOBER IDEAS 3 · ORBIT HUD · GROWN UP HUD · THE WALL · SPREADSHEETS · GAMES 5 · THE WORKING ENGINE ·
  QUALITY PASS: LIFE · QUALITY PASS: HOME · RELIABILITY AND HEALTH · PRESENTATIONS
- [ ] Building: THE WORKSPACE · VIDEO · QUALITY PASS: SEE · THE GAME STUDIO
- [ ] Parked, reviewed clean, waiting for the EDITORS fold: PHOTO (lands after THE WORKSPACE, rebased onto the fold first; OWNER-ISSUES 204)

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
    seepass from the HOME pass's head (9f7338e5) the hour it handed back.
14. REINFORCEMENT AT SCALE (GRPO-style) inside the free GPU budget, said honestly if the budget does not allow; the self-edit trial measured.
15. KERNEL 2 (BRIEF-KERNEL-2, worktree kernel2, port 8818): the protected-file calls decided under OWNER-ISSUES 179: the brain's test list names
    what it runs, a `document` tool, physics for the engine (one package), automatic rollback after a publish that fails its own first check.
    Starts after DOCUMENTS, ENGINE 3D, TRAINING and POLISH 1 are on main. SMALL FIXES 2 rides with POLISH 3: the spoken "On it." in the
    phone's own voice, not covering DOWNLOAD. Also in SMALL FIXES 2: the money pack's twice-a-day price watch and WATCHERS made one system (lifeeasier's found-not-fixed).

## His hands only (not builds; asked once, here)
The Pl@ntNet, Formspree, DVSA MOT and two free AI keys; the PS5 TV MODE test; the 0.5B SIT result; the voice blind check; his principles in his
own words; the kernel's remaining call (kernel-yes.test.mjs named in the brain's test list: recommend yes).
