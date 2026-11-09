# BRIEF-ORCHESTRATOR-2 — the rest of the week, run by the mid tier (9 Nov 2026, 21:20 UK)

The top tier (the orchestrator until now) is at 95% of its weekly allowance and there is NO weekly reset: "everything has to be
done within this week's limits" (OWNER-ISSUES 167). From here a MID-TIER orchestrator runs the queue end to end. The top tier
takes one turn per hand-back only. Read in this order before anything else: this file; docs/build-plan/HANDOFF.md (the last
80 lines: the method, the usage, the state); OWNER-ISSUES 160–167; STATUS.md items 4–8; AUDIT-8-NOV.md; BRIEF-SHELL-2.md (the
shape every brief takes); BRIEF-ONE-INK.md (the build in flight).

## The owner's rules, never broken (his words)
"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices
only me and people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own;
nothing that can cost money and no new keys unless I add them; the brain never gets live GPS; every engineering, car or build
number a first estimate, never certified; social posting only with my APPROVE every time; downloads only on my tap on Wi-Fi
with the size said. Never raise the prompt guard. Never skip or weaken a test. The CI guard job: … beyond that fix you never
touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named by tier."
Protected kernel files, touched only with his word: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,
types,repo}.ts, .github/*, apps/*/package.json. One established exception: adding one spec word to the `all=` list in
.github/workflows/check.yml for a new spec (the guard job untouched). Messages to him carry context, never OWNER-ISSUES numbers.
His instructions go into OWNER-ISSUES in his words the same hour; new ideas into STARS; nothing dropped.

## The budget
At 21:10 UK 9 Nov: all models weekly 68%, top tier 95%. The top tier's usage is now fixed; everything you spend is the "all
models" line. STOP LAUNCHING NEW BUILDS when the owner reports all models at 90% (the top tier relays his reports to you; record
each in HANDOFF): the last tenth is for the small fixes he will point out after he looks ("i'm happy for you to finish
everything then i point out what needs to be changed"). Spend by method: builders at the mid tier; reviews and log reading at
the low tier; your own turns short; read a file's tail, not the file; one timed wait per CI run, never polling by the minute.

## The queue (his "all of it" order, OWNER-ISSUES 164; most important first; expect three or four builds in the budget)
1. ONE INK — a builder is running now (worktree .claude/worktrees/ink, branch builder/ink from dc98881, port 8798, report to
   the scratchpad file ink-report.md). Wait until that report exists and builder/ink has not moved for ten minutes (Monitor,
   checking every five minutes), then land it (below). OWNER-ISSUES 168 = "ONE INK, BUILT" with his nine-step phone check from
   BRIEF-ONE-INK §"The owner's phone check". PR title "ONE INK: the second whole HUD".
2. The five speed offenders (AUDIT-8-NOV item 1; PLAN 3 B3: tools side by side, replies streaming from the first word, warm
   caches, shorter prompts, the quickest free model giving the same answer — "model" here is a tier or a slot name in code,
   never a vendor's model name). Measure first with the stopwatch and the SPEED card, write the five down with numbers in the
   brief, fix each, prove each with a before/after number in the report and a spec budget that holds.
3. SHOW ME, the first slice (STATUS item 5; STARS 164): place → map or God's Eye; route → journey; numbers → chart; plan or
   letter → document; formula → simulation; the first sentence at once, the picture when its data is ready.
4. Offline maps + offline eyes (downloads only on his tap on Wi-Fi with the size said).
5. The games he named; 6. the working 3-D engine; 7. no cap on skill (test); 8. the speaker model for his voice (never a lock
   on its own); 9. THE MAP and THE EYE HUDs; 10. weekly training for real; 11. phone-hardware items blind with fallbacks;
   12. the full editors last. Each item: read its lines in AUDIT-8-NOV, STATUS and STARS before briefing.

## One build, start to finish
- BRIEF: docs/build-plan/BRIEF-<NAME>.md in BRIEF-SHELL-2's shape (what is fixed, what must not change, tests that fail
  before and pass after, validation one step at a time with COMMIT BEFORE EVERY HEAVY STEP, the owner's phone check, report).
  Commit it on the session branch.
- WORKTREE: `git worktree add .claude/worktrees/<name> -b builder/<name> <session-branch-head>`; symlink every node_modules the
  main checkout has (root, apps/web, apps/edge, packages/*) into the same places in the worktree. Builders use port 8798.
- BUILDER: a mid-tier agent (Agent tool, subagent_type general-purpose, model sonnet, run_in_background true) with the brief's
  path and these standing lines: work only in the worktree; every spec run in the foreground before the report; nogl copies
  (tests/.<name>.nogl.tmp.mjs) deleted and never committed; known sandbox reds direct/aim/radio are not theirs to fix; budgets
  held by cost, never by loosening; never push; report to the scratchpad file named in the brief; hand back a short summary.
- REVIEW (a low-tier agent, model haiku, reading `git diff <base>..builder/<name>` and the report): protected files beyond the
  one `all=` word; a model name anywhere; a removed, skipped or loosened check; a budget raised; tests/.*.tmp.mjs, screenshots
  or other stray files; the report's last line of every spec verbatim with its verdict. You fix what it finds (small) or send
  the builder back (large).
- LAND as ONE commit on the session branch, from /home/user/Ghosty:
  `git diff --binary <base> builder/<name> -- . ':(exclude)<stray>' > <scratchpad>/<name>.patch && git apply --index --3way
  <scratchpad>/<name>.patch && git commit -m "<NAME>: <one line>" -m "<the builder's summary>"` with the two trailers every commit
  here ends with (see HANDOFF's recent commits: `git log -3 --format=%B`). Then OWNER-ISSUES <n> (his phone check in plain
  terms), HANDOFF entries (time UK: what), STATUS line, one more commit. `git push -u origin claude/new-session-4erjve`.
- PR: mcp__github__create_pull_request (load with ToolSearch) base main, head claude/new-session-4erjve; body: what it is,
  the specs, his phone check, ending with the two lines the harness asks for (no model name). Do NOT subscribe to PR activity.
- THE RUN: wait ONE timed stretch (Monitor with an until-loop that checks the run every five minutes, up to 90 minutes):
  `T=$(gh auth token); curl -sS -H "Authorization: Bearer $T" "https://api.github.com/repos/wvks62vknw-sys/Ghosty/actions/runs?branch=claude/new-session-4erjve&per_page=1"`
  then `.../runs/<id>/jobs?per_page=50`. Jobs: brain, interface, deploy-build, smoke (1–4), guard (skipped is right). Red: a
  low-tier agent reads `.../actions/jobs/<id>/logs` (grep '##\[error\]' and the spec's own last lines) and reports the cause;
  reproduce on the preview (below); fix forward on the session branch; push; wait again. Green on every job: merge with
  mcp__github__merge_pull_request (merge_method squash; no expectedHeadSha), then `git fetch origin main && git merge
  origin/main`, read MAIN'S OWN RUN the same way with branch=main, record it, remove the worktree and branch. A build is
  "finished" only when main's own run is green; say so in HANDOFF/STATUS as "finished on the code side, pending his phone check".
- The brain's unit tests run first in every smoke shard: a red brain test stops every browser spec. knowledge.test flags any
  comment starting `// ...` as a placeholder; finding.test matches house.ts's source by regex; ratchet.test counts hard-coded
  colours and radii outside THE SYSTEM in styles.css (ceiling hex 506, rgba 1016, radiusPx 470, total 1992: equal or lower).

## Local commands (from /home/user/Ghosty)
- Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`.
- Preview: `(nohup setsid node tests/preview-server.mjs 8797 > <scratchpad>/preview8797.log 2>&1 < /dev/null & disown)` in a
  FOREGROUND Bash call; `curl -s -o /dev/null -w '%{http_code}' localhost:8797/` → restart when 000.
- A spec: `cd apps/web && BASE=http://localhost:8797 NO_GL_SHOTS=1 timeout 480 node tests/<name>.spec.mjs tests/.shots`.
  God's Eye screenshots hang in the sandbox: make a copy with
  `sed -E "/^\s*await page\.screenshot\(\{ path:/ s/\}\);\s*\$/, timeout: 15000 }).catch(() => undefined);/" tests/x.spec.mjs | sed -E "s/('detached', timeout: )(15000|20000)/\190000/" > tests/.x.nogl.tmp.mjs`,
  run the copy, delete it. Known sandbox reds: direct, aim, radio.
- Brain tests: `cd apps/edge && PATH=$PWD/node_modules/.bin:$PATH npm test` (about ten minutes: run in the background and
  read the log).

## Reporting
Keep <scratchpad>/orchestrator-notes.md: after each landing a paragraph TO THE OWNER in plain context (what he can now do on
his phone, the calls that are his with your recommendation first), and the usage he last gave. Your hand-back to the top tier
is short: what landed and is green on main, what is in flight, what is blocked, the TO THE OWNER paragraphs. Never wait for
the owner to merge; never ask him a question you can decide; every decision that is his goes in one line with the
recommendation first.
