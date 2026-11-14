# THE NEXT ROUND (14 November 2026): one shared brief for the seventeen lanes

Seventeen cloud sessions work at once, one lane each, the same lanes as the final round. Each session has its own container and its own
branch. All of them start from `claude/new-session-4erjve-next`, which is main (`58f0ccd2`, with #118 and #119 in it) plus this file and
`docs/build-plan/next/`.

**Your work is in `docs/build-plan/next/<your lane>.md`.** It comes from THE MAP: your own lane's report, which 5 reviewers checked against
the owner's rules and the code itself, which a judge then ranked, and which 2 skeptics challenged. Everything in it is rule-safe as written.
Where an idea was reshaped, build the reshaped version.

## Times (UTC, 14 Nov)
- **Now to 03:30.** Build sections 1 to 3 of your file. By 03:30, merge whatever is whole and green into the integration branch (protocol below), so the early check sees it.
- **03:45.** The coordinator runs GitHub's full check on a snapshot of the integration branch, and sends each lane the reds that are its own. Fix those first when they come.
- **03:30 to 06:00.** Build sections 4 to 6. Merge each time a piece is whole and green, about every 60 to 90 minutes.
- **06:00. HARD STOP.** The last merge. After 06:00, nothing more is merged unless the coordinator asks for a fix. Then the combined check runs (about 100 minutes), the coordinator proves it locally as well, and it goes to main.

A lane that is not done at 06:00 merges what is whole and green, and lists the rest in its report. Half a feature is never merged.

## What the owner asked for, in his words (14 Nov)
> "yes build everything and everything you've missed aswell, i want every single little feature and thing to be the absolute best
> capabilities there possible it can be, and even more things, literally every single thing you can think of, in every single way,
> whatever it is, i want this to go to the next level in every single way and just be on the next level ultimately"

From the final round, still standing:
> "make every small feature like that literally feeling like an app within itself like it's made by a multi million dollar cooperation
> that literally specialise in that, and it's just perfect, so when you open Ghosty, it feels like hundreds of apps in one"
>
> "i give you full permission now to do everything you want in every single way"

## His standing rules, verbatim (NOT lifted, never broken)
"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me
and people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost
money and no new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never
certified; social posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt
guard. Never skip or weaken a test. The CI guard job: … beyond that fix you never touch it. Never put a model name in code, comments,
tests, docs or pull request text; builders are named by tier."

What these rules mean in practice:
- **People.** The Lens names things, never a stranger. A pattern is told from his own numbers as what happened, never a forecast about a person.
- **Money and keys.** Free and keyless, or a key he already added. A feed behind a paid login is out (for example Standard Ebooks' full catalogue: use Gutendex and OPDS instead).
- **Reminders.** An iPhone suspends a hidden web app. So a reminder that must fire with the phone locked goes through the brain's Web Push, which Ghosty already has. A phone-only timer is never promised to fire on a locked phone.
- **Location.** A route or position stays on the phone. The brain gets totals, never positions.
- **Approvals.** Anything that sends, posts, pays, publishes or ships waits for APPROVE, every time. A one-word routine that would send something stops at APPROVE.

## Protected files
These change only where an item truly needs it, and the commit message says why:
- `apps/edge/src/agent.ts`
- `apps/edge/src/index.ts`
- `apps/edge/src/tools/{index,types,repo}.ts`
- `apps/*/package.json` (no new dependency that costs money or phones home)

These never change, with two exceptions:
- `.github/*`: the only change allowed is spec words appended at the END of check.yml's `all=`.
- `apps/web/public/_headers`: may be TIGHTENED, never relaxed.

The prompt guard (5,500) is never raised. A lane that adds prompt words removes or condenses others to fit.

## How the code is checked (unchanged, with what the last round taught)
1. Set up: `cd apps/edge && npm install --no-audit --no-fund`, then `cd apps/web && npm install --no-audit --no-fund`.
2. Build with `cd apps/web && node build.mjs`. The brain bundles come from `cd apps/edge && npm test`, which also runs the whole brain suite.
3. Preview with `node tests/preview-server.mjs 8788`. Run a spec with `node tests/<name>.spec.mjs tests/.shots` (`CHROMIUM=/opt/pw-browsers/chromium` if Playwright cannot find a browser).
4. CI runs every spec on four shards: each shard runs the whole brain suite first, then its specs, each spec with **480 s** (720 s for nav and routec) and one retry. CI's runner is slower than your container, renders WebGL in software, and has no H.264 or AAC encoder.

**What the last round taught (each of these cost a red on CI):**
- **Words other specs read.** If you change any words on screen (a label, a key, a reply line, an empty state), grep `tests/` for the old words first. Update every spec that reads them to the new truth, as strict as before. In the final round, one lane's wording broke 13 specs.
- **Chat replies.** The chat log draws only its last 40 entries, so never wait for a count of replies. Find his own message by the time it was sent (`data-at`), then wait for the first reply after it that matches. `H.ask` in `tests/planlane.spec.mjs` is the pattern.
- **The clock.** CI runs at any hour. Anything date-based in a spec or a stand-in is anchored to London's midnight, so a run between 00:00 and 01:00 still passes.
- **Paint timing.** Do not change how the chat log is painted (features/core/index.ts paints at once when not busy or on a new entry of his). Wait on the real condition, never a fixed sleep.
- **Test pages.** The network guard refuses loopback addresses. A spec's test page uses a `*.loopback.test` host, which only the preview server maps back to 127.0.0.1.
- **Budgets.** A budget is never raised. If something is slow on CI, make the code faster.
- **Spec length.** Keep every spec well under 480 s on CI (aim for 300 s in your container). Add new parts to your lane's own spec while it stays under that. Otherwise start a new spec word, and append it at the END of `all=` in check.yml.

**Ratchets** (all in apps/edge/test):
- Every spec defaults `BASE` to `http://localhost:8788`.
- No merge-conflict markers.
- The STATES ratchet.
- The colour ratchet: no new hex or rgba literals, use the tokens.
- The error voice: no `e.message`, `String(e)` or `${e}` in apps/web/src outside `ui/hisWords.ts`. Use `sayError(e, what)`, `rawText` or `trail(e, where)`.
- knowledge.test's self-check.

## What "the absolute best" means here
Every screen you touch:
- is a complete app of its own, with nothing missing that the best dedicated app of its kind has (your file names them);
- says each of its states in his words: empty, loading, error, offline, done;
- is fast;
- puts every key at 44 pt, keeps nothing sideways and cuts no words at BODY 21;
- draws only from the design tokens, and looks right in all seven worlds (scan, map, eye, orbit, grown, ink, glass);
- keeps his data on the phone;
- is reachable by voice and chat in more than one wording, and appears in Abilities (the catalogue is generated, so a new ability needs its catalogue entry);
- has a spec that proves all of it at 440 × 956 and 390 × 844.

Where a screen has nothing behind it yet (a dead key, a promise the code does not keep), make it real or take the promise out. Never leave it half-done. Add a WHAT'S NEW line for each thing he would notice.

## Cross-lane items
Your file lists the items whose idea joins two lanes (`with:`). The lane that owns the id builds it into the other lane's area: small, additive, keeping that lane's intent, and saying so in the commit. The other lane's file lists what to expect under "Built into your area by other lanes". When you merge, keep both sides.

## Every session's protocol
1. `git fetch origin claude/new-session-4erjve-next` and start your branch from it: `claude/new-session-4erjve-<lane>-next`. (Your old lane branch is done; do not reuse it.)
2. Push your branch about every 45 minutes, so nothing is lost.
3. Commit messages are plain English and end with the Co-Authored-By trailer your session gives you, exactly as in the final round. Nowhere else in a commit, a file or a report is a builder named except by tier.
4. Each time a piece is whole and green:
   - **Checks first:** the web and edge typechecks; your brain tests plus ratchet, knowledge and look; every spec whose files you touched, plus every spec that greps for words you changed; and the full brain suite once.
   - **Merge:**
     1. `git fetch origin claude/new-session-4erjve-next` and merge it into your branch.
     2. Resolve conflicts keeping BOTH sides' intent. In check.yml's `all=`, keep every word, with yours at the end.
     3. Rerun the typechecks, the ratchet, knowledge and look tests, and your specs.
     4. Push your branch, then push the same commit to `claude/new-session-4erjve-next` as a fast-forward. If the push is rejected because another lane got there first, fetch, merge, recheck and push again.
5. Never open a pull request, never touch main, and never change another lane's intent.
6. **Your report:** write `docs/build-plan/NEXT-<LANE>.md` in plain words for the owner, covering what you built, how to try it on his phone, what is left, and your specialist sweep's list. It is merged with your work.
7. When you finish, or at 06:00, message the coordinator (`@parent`) with what you merged (the sha) and what is left.
