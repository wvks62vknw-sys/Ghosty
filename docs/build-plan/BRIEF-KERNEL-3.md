# BRIEF: KERNEL 3 — the brain's hands on the new editors, and the protected-file calls he said yes to (OWNER-ISSUES 185, 179)

BRIEF-KERNEL-3 (OWNER-ISSUES 185 "yes to all", 12 Nov: "the brain's own tools (write a document, make slides, cut a video, read your
Workspace from the chat): yes; documents in Kernel 2, the other three in Kernel 3 once those editors are live"; 179 "any questions you
have just do the best possible thing"; the NEEDS HIS WORD lines of gamestudio-report, photofold/videofold, games5/games6, photo2). His word
is the licence for exactly these protected files and these changes and nothing else: `apps/edge/src/tools/index.ts`, `tools/types.ts` and
`agent.ts` (items 1 to 4: four tools, each joining the list where `document` did in KERNEL 2, one line each in agent.ts), `apps/edge/
package.json` (item 5, the test list only). Item 6 (the sites route) touches `apps/edge/src/index.ts` and is built ONLY IF HE HAS SAID
YES to WHATS-LEFT's question of 12 Nov by the time this brief starts; until then it is NOT REACHED and said so in the report, and nothing
of it is written. The mid tier. One builder, one PR. Start from the session branch's head AFTER KERNEL 2, PRESENTATIONS, THE WORKSPACE,
VIDEO, VIDEO 2 and THE GAME STUDIO have landed on main, so the editors these tools drive exist; if one has not landed when you start,
its item is NOT REACHED and said. Read STANDARD.md, BRIEF-KERNEL-2.md and its report (scratchpad/kernel2-report.md: the `document` tool
is the pattern for every tool here: read, a proposal shown in the editor, his tap applies it, never a silent change), the editors' reports
(scratchpad/slides-report.md, workspace-report.md, video-report.md, video2-report.md, gamestudio-report.md), `apps/edge/src/tools/
{index,types}.ts`, `apps/edge/src/appbuild.ts` (`appApproval`: the approval shape), `apps/edge/src/tools/sites.ts` and `sitebuild.ts`
(what a published page is today), `apps/edge/test/prompt.test.mjs` (the ceilings), `apps/web/src/slides/*`, `workspace/*`, `video/*`,
`studio-game/*` (each editor's project shape and store).

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Not touched: tools/repo.ts, .github/* (no new spec word: the cases go into the editors' existing specs and the brain tests; the `all=` list is
not edited), the prompt guard (prompt.test's ceilings: measured before and after every tool; if the tool list would pass its ceiling, another
tool's description is shortened by the same count, never the guard raised), apps/web/public/_headers, the editors' project shapes (new fields
only, an old project still reading), the social posting rule, the ratchet's ceiling.

## What is built

1. **A `slides` TOOL FOR PRESENTATIONS (tools/types.ts, tools/index.ts, agent.ts; apps/web/src/slides/*).** `read` (the open deck's outline:
   each slide's title and its first line, the theme, the count), `edit` (a slide's title or body replaced, a slide added after a named one,
   a slide removed, the theme changed: each a proposal shown in the editor as a marked change he accepts or rejects with one tap, never
   applied silently), `make` (a deck from a report or a chat turn's text: PRESENTATIONS already does this from its own key; the tool calls
   the same code and opens the deck, nothing of it published). Works only on the deck open on the phone, carried as the turn's data as
   `document` is. Tests: apps/edge/test/slides-tool.test.mjs (new; named in the list by item 5): read returns the outline, edit returns a
   proposal and applies nothing, make returns a deck shape; prompt.test's ceilings hold. slides.spec gains: with a deck open, "make slide
   three's title shorter" shows the marked change, ACCEPT applies it, REJECT leaves it; "make slides from this" on a report opens a deck.
2. **A `videoedit` TOOL FOR VIDEO (the same three files; apps/web/src/video/*; named `videoedit` because `videoTools` in tools/extra.ts
   already means something else).** `read` (the open project's clips in order with their lengths, the music, the subtitles' first line),
   `edit` (a clip trimmed to a said range, two clips swapped, a clip removed, a transition set, music set from the library, subtitles on or
   off, and, from VIDEO 2, STEADY, BEST CLIPS with a target length, ON THE BEAT, REVERSE and a RAMP by name: each a proposal shown on the
   timeline he accepts or rejects; the export is NEVER started by the tool, only by his tap). Every number the tool says is in seconds with
   its word. Tests: apps/edge/test/videoedit-tool.test.mjs (new; named in the list): read returns the clip list, each edit returns a proposal
   and applies nothing, export is refused with the sentence he sees; the ceilings hold. video.spec gains: "cut the first clip to the first
   five seconds" shows the proposal on the timeline, ACCEPT trims it, UNDO puts it back.
3. **A `workspace` TOOL FOR THE WORKSPACE (the same three files; apps/web/src/workspace/*).** `read` (a page by name, or the project whole in
   one turn as THE WORKSPACE's own "read whole" does, with its databases as tables), `search` (pages and rows matching his words), `edit` (a
   block's text, a row's cell, a page added under a named page: each a proposal he accepts or rejects), `append` (a block at the end of a
   named page). Tests: apps/edge/test/workspace-tool.test.mjs (new; named in the list): read returns a page and the whole, search finds a
   row, edit proposes and applies nothing; the ceilings hold. workspace.spec gains: "what did I write about the garden?" answers from the
   page; "add 'buy seeds' to the garden list" shows the proposal, ACCEPT adds the row.
4. **A `game` TOOL FOR THE GAME STUDIO (the same three files; apps/web/src/studio-game/*; his yes-if-yes of 12 Nov: "Ghosty making a game for
   you from the chat").** `make` ("make me a platformer about a fox": a studio project built from the studio's own kit, rooms painted from
   its tile sets, sprites from its own sheets re-coloured, people with the dialogue the brain writes, one quest, a save point: opened in the
   studio for him to edit, saved to the studio's library under the name he gave, NEVER published, nothing drawn by a model: the kit only),
   `read` (the open game's rooms, people and quests), `edit` (a room's size, a person's dialogue, a quest's text: each a proposal). Tests:
   apps/edge/test/game-tool.test.mjs (new; named in the list): make returns a valid project the studio's own validator accepts, with at least
   one room, one sprite, one person, one quest and a save point; read and edit as above; the ceilings hold. gamestudio.spec gains: "make me a
   platformer about a fox" in the chat opens the studio on a new game that plays from the ARCADE.
5. **THE BRAIN'S TEST LIST NAMES EVERY TEST (apps/edge/package.json, the `test` script, nothing else in that file; KERNEL 2's item 1 carried
   on).** Every brain test present now that is reached only through an `await import('./…')` line in another test file (grep
   `await import('./` in test/*.mjs: games5, gamestudio, games6, photo2, video, video2, slides, sheets, workspace, health, document and any
   other) is named at the END of the `node --test` list in the order the imports were added, and the imports removed; the four new tests of
   items 1 to 4 join the end. The `# tests` count before and after is the same plus the new tests' own, written in the report.
6. **A GAME ON HIS SITES AS AN INSTALLABLE PAGE (ONLY IF HE HAS SAID YES; apps/edge/src/index.ts, appbuild.ts, sites.ts, the studio's export).**
   Today /s/<name> serves a page Ghosty wrote, in a frame with no storage, so a game there cannot keep its saves or be added to the Home
   Screen. With his yes: a studio game published through the same chat turn and the same APPROVE every time (`appApproval`'s shape, never
   from the studio's own key without the turn), served direct at /s/<name>/ with its own manifest (installable, its icon once), its own
   strict Content-Security-Policy that allows exactly its own inline script and nothing from elsewhere, storage for its saves scoped to that
   page, no camera, microphone or location, no fetch anywhere; the Worker's route in index.ts is the smallest change that serves the stored
   page and its manifest (the report shows the exact diff); PUT IT ON MY SITES in the studio becomes the sentence that starts that chat turn
   ("Ask me in the chat: 'put <name> on my sites' and I'll ask your APPROVE."). Tests: sites.test gains the manifest, the CSP's exact
   string, the storage scope, the refusal of a publish without the turn's approval; gamestudio.spec gains the key's new sentence and, with
   the stubbed brain, the published page opening with its manifest. If he has NOT said yes: the studio's one sentence stays as it is, nothing
   here is written, and the report says NOT REACHED: HIS WORD.

## What must not change

The prompt guard and its ceilings; index.ts untouched unless item 6 is reached, and then its one route only; tools/repo.ts; .github/*; the
editors' own behaviour and specs (slides, workspace, video, video2, photoedit, gamestudio green as before); every export started only by his
tap; nothing published without a chat turn and his APPROVE; no model draws a sprite or a tile; no new key; nothing that costs money; the
social posting rule; the first-screen budget; GLASS pixel-equal; no test skipped or loosened.

## Tests (each fails on the code before this brief; run them against it once and say so)

slides-tool, videoedit-tool, workspace-tool, game-tool (new, all named in the list), prompt.test before and after each tool (the ceilings
hold), the editors' specs' new cases, sites.test's new cases if item 6 is reached, the whole brain test run with its count before and after
item 5.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. The brain tests first and last (`cd apps/edge && PATH=$PWD/node_modules/
.bin:$PATH npm test`, in the background with a 1700 s cap, polled, the log read). Preview on port 8844:
`(nohup setsid node tests/preview-server.mjs 8844 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8844.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call (rebuild the preview's brain bundle first: `npx esbuild src/index.ts --bundle --format=esm --platform=neutral
--external:cloudflare:sockets --outfile=test/.build/brain.mjs` in apps/edge). Specs from the worktree ROOT, alone, one after another: slides,
workspace, video (GL on, 1700 s cap in the background, polled), gamestudio, docs, hubcards, deck, nav, speed2, look, talk, thescan; sites if
item 6 is reached. A timing budget missed under load is rerun alone before it is called red. Known sandbox reds not touched: direct, aim,
radio, scroll, safari, eye's own screenshot, tabs2, talk's cooling lines, tabs' taps under load, nav's CDP close. One spec at a time.

## The owner's phone check

1. Presentations, a deck open: "make slide three's title shorter": the change marked; ACCEPT. "Make slides from this" on a report: a deck.
2. Video, a project open: "cut the first clip to the first five seconds": the proposal on the timeline; ACCEPT; UNDO. "Steady the second
   clip": the proposal; ACCEPT. Nothing exports until you tap EXPORT.
3. The Workspace: "what did I write about the garden?": the answer from your page. "Add 'buy seeds' to the garden list": the proposal; ACCEPT.
4. "Make me a platformer about a fox": the studio opens on a new game; play it from the ARCADE.
5. If you said yes to the sites question: "put <the game's name> on my sites": APPROVE; open the address on your phone; add it to your Home
   Screen; play; close; open again: your save is there.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/kernel3-report.md: the exact diff of each protected file (the
four tools' entries, agent.ts's four lines, package.json's one line, index.ts's route if reached); the test count before and after; the prompt
ceilings before and after each tool; each spec's last line; NOT REACHED (with "HIS WORD" for item 6 if so); found-not-fixed; the phone check
as above; the commit list. One commit per step on builder/kernel3; the orchestrator squashes to one on landing. Never push. Named by tier,
never by model.
