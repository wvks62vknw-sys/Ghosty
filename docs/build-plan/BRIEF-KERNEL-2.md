# BRIEF: KERNEL 2 — the protected-file calls decided under his standing word (OWNER-ISSUES 179)

BRIEF-KERNEL-2 (OWNER-ISSUES 179 "any questions you have just do the best possible thing don't wait for my answer"; the NEEDS HIS WORD
lines of editors-report, engine3d-report, training-report, lifeeasier, further, polish1, polish2). His standing word is the licence for
exactly these files and these changes and nothing else protected: `apps/edge/package.json` (item 1, the test list only), `apps/edge/src/
tools/index.ts` and `tools/types.ts` and `agent.ts` (item 2, the one tool), `apps/web/package.json` (item 3, one dependency), the
publish path's own files (item 4; not protected). The mid tier. One builder, one PR. Start from the session branch's head AFTER
DOCUMENTS, ENGINE 3D, TRAINING and the error funnel (POLISH 1) have landed on main, so the tests and tools this names exist; if one has
not landed when you start, its item is NOT REACHED and said.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Not touched: apps/edge/src/index.ts, tools/repo.ts, .github/* (no new spec word is needed: the cases go into existing specs and the brain
tests), the prompt guard (prompt.test's ceilings), the ratchet's ceiling if styles.css is touched.

## What is fixed

1. **THE BRAIN'S TEST LIST NAMES WHAT IT RUNS (apps/edge/package.json, the `test` script, nothing else in that file).** Every brain test
   that today is reached only through an `await import(...)` line in another test file (kernel-yes from router.test; watchers,
   sundaynote, telegrampic, the error-funnel lint, and any other such import you find with `grep -n "await import('./" test/*.mjs`) is
   named at the END of the `node --test` list in the order the imports were added, and the one-line imports are removed from the files
   that carried them. The count of tests run before and after is the same and written in the report (the `# tests` line of both runs).
2. **A `document` TOOL FOR THE DOCUMENTS EDITOR (tools/types.ts, tools/index.ts, agent.ts; the editor's own files).** One tool, `document`,
   with `read` (the open document's text and its outline), `edit` (replace a named range or a quoted passage with new text, the change
   shown to him in the editor as a marked change he accepts or rejects with one tap, never applied silently) and `append`; it works only
   on the document open on the phone, carried as the turn's data as today (the editors builder's stub: apps/web/src/docs/*; read its
   report at the scratchpad path editors-report.md). The tool's description in the prompt is within prompt.test's ceilings (measure before
   and after; if the tool list would pass 6,500 characters, shorten another tool's description by the same count, never raise the guard).
   The approval shape follows `appApproval` (apps/edge/src/appbuild.ts): an edit is proposed, the phone shows it, his tap applies it.
   agent.ts: the tool joins the list where `build_app` does and nothing else in agent.ts changes. Tests: apps/edge/test/document.test.mjs
   (new; named in the list by item 1): read returns the outline, edit returns a proposal and applies nothing, append the same; a prompt
   test re-run shows the ceilings hold. docs.spec gains: "make the second paragraph shorter" in the chat with a document open shows a
   marked change in the editor, ACCEPT applies it, REJECT leaves the text as it was.
3. **PHYSICS FOR THE 3-D ENGINE (apps/web/package.json: one dependency, `@dimforge/rapier3d-compat`, Apache-2.0, WASM; the engine's own
   files).** The engine (apps/web/src/engine/*, BRIEF-ENGINE-3D-1's "next passes") gains gravity and collision for the parts in a room:
   a dropped part lands on the floor or on the part under it and does not pass through a wall; DROP IT on a part and a ground switch
   PHYSICS ON / OFF in the engine's pane (off by default; nothing moves until he turns it on). The WASM is loaded only when the switch
   is turned on, and the engine's budgets (the pane's first paint, the scene's frame time named in BRIEF-ENGINE-3D-1) are unchanged with
   it off and measured with it on (said in the report, a first estimate). The package's size on the phone is said once in the pane's
   line when he turns it on ("Loading physics, 2 MB" with the true number). engine3d.spec gains: physics off, a part dropped stays;
   physics on, a part dropped lands on the floor within 2 s; a part dropped onto another rests on it; the frame time under 16 ms with
   eight parts resting (rerun alone before red). `npm install` is run once in the worktree (the lockfile changes with the one package
   and nothing else; the diff of the lockfile is read and said).
4. **AUTOMATIC ROLLBACK AFTER A PUBLISH THAT FAILS ITS OWN FIRST CHECK (the training's publish path: apps/edge/src/training/* and the
   phone's system/training surface; not protected).** Today a brain that is published and then scores worse on the phone is rolled back
   only by his ROLLBACK tap (training-report). Now: after a publish, the first check the phone already runs (the files load, the smoke
   question answers, the score against the held-out set) decides within its own window: a load failure or a score below the previous
   brain's by more than the margin the training already uses rolls back to the previous brain automatically, tells him once in his
   voice with the two numbers, and writes `why`; his ROLLBACK tap stays for everything else; a brain he rolled forward by hand is never
   rolled back automatically twice. Tests: apps/edge/test/training.test.mjs (or the test that owns training) gains the three cases (load
   failure rolls back, a worse score rolls back once, a hand roll-forward is left alone); the training spec gains the line shown.

His yes (OWNER-ISSUES 185, 12 Nov, "yes to all"): item 3's one package is confirmed; the `document` tool of item 2 is confirmed; the
`slides`, `video` and workspace tools are NOT this brief: they follow as KERNEL 3 once PRESENTATIONS, VIDEO and THE WORKSPACE are on main, and
the test list of item 1 names every test present when this lands (slides, photoedit, health, workspace and video included if they are in).

## What must not change

The prompt guard; `apps/edge/src/index.ts`, `tools/repo.ts`, `.github/*` untouched; no new key, nothing that costs money (the package is
free, Apache-2.0, and is said so in the report with its licence file's first line); the brain never gets live GPS; never a vendor's model
name; knowledge.test's placeholder rule; the ratchet's ceiling; no test skipped or loosened; every other tool's behaviour as before (the
brain tests prove it); GLASS pixel-equal; the first-screen budget (the physics WASM is never on the first screen's path).

## Tests (each fails on the code before this brief; run them against it once and say so)

document.test.mjs (new), the training test's three cases, docs.spec's and engine3d.spec's new cases, prompt.test before and after (the
ceilings hold), the whole brain test run with its count before and after item 1.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. The brain tests first and last (`cd apps/edge && PATH=$PWD/node_modules/
.bin:$PATH npm test`, about ten minutes, in the background, the log read). Preview on port 8818:
`(nohup setsid node tests/preview-server.mjs 8818 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8818.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call (rebuild the preview's brain bundle first: `npx esbuild src/index.ts --bundle --format=esm --platform=neutral
--external:cloudflare:sockets --outfile=test/.build/brain.mjs` in apps/edge). Specs from the worktree ROOT, alone, one after another:
docs, engine3d, trainingreal (or the spec that owns training), showme, speed2, look, talk, telegram, layout, nav. A timing budget missed
under load is rerun alone before it is called red. Known sandbox reds not touched: direct, aim, radio, scroll, safari, eye's own
screenshot, tabs2, talk's cooling lines.

## The owner's phone check

1. Documents, a letter open: "make the second paragraph shorter": the change marked in the page; ACCEPT, then REJECT on another.
2. The engine, a room with a table: PHYSICS ON (the size said once), drop a cup: it lands on the table; drop a chair: it lands on the floor.
3. System, Training: the log of the last publish shows its first check and "kept" or "rolled back" with the two numbers.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/kernel2-report.md: the exact diff of each protected file
(package.json's one line, the tool's three entries, agent.ts's one line); the test count before and after; the prompt ceilings before and
after; the lockfile's diff summary and the licence line; each spec's last line; NOT REACHED; found-not-fixed; the phone check as above.
One commit per step on builder/kernel2; the orchestrator squashes to one on landing. Never push. Named by tier, never by model.
