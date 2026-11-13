# THE FINAL ROUND (13 November 2026): one shared brief for every parallel session

About sixteen cloud sessions work at once, one lane each. Each session has its own container and its own branch. They all
start from `claude/new-session-4erjve-final`, which holds everything finished so far: pull request #116's tip plus this file.
**HARD DEADLINE:** every session has its work merged into `claude/new-session-4erjve-final` by **21:15 UTC on 13 Nov**. The
owner's hard limit for everything live is 23:43 UTC, and the combined check takes about 75 minutes. A session that is not
done by 21:15 merges what is finished and whole, and lists the rest.

## What the owner asked for, in his words (13 Nov)
> "audit the entire thing for anything that contradicts itself, any errors, anything wrong, etc audit the entire thing in every
> way shape and form, make every small feature like the drinking water tab, make every small feature like that literally
> feeling like an app within itself like it's made by a multi million dollar cooperation that literally specialise in that, and
> it's just perfect, so when you open Ghosty, it feels like hundreds of apps in one"
>
> "Colours should be named like red, blue, green because if i say to him red he doesn't change the theme to red because it's
> named like crimson or find a way around that, currently the boot-up cinematic is like non-existent? It's definitely not the
> 7 second one we made, It says it recognises me in the settings, my voice, and even when i speak it says you etc, but the
> actual chat says he has no way of recognising me and he doesn't know etc, The "Lens" not working, going almost black and
> white and only can read translate etc, it doesn't have every single feature every other lens feature has in one, and it
> should know when to use each one so you can just point it and it does its job it doesnt have all these buttons etc, It
> should understand multiple meanings of the same thing so if i say play music it should play the radio etc and all things
> like that, the school still uses the smallest brain which answers in like multiple choice or something i think, sometimes
> the layers on Gods Eye can overlap the cameras, things like Comic should be able to import actual real comics or like have
> them separately and create actual full fledged comics which can actually entertain someone, also look for any
> vulnerabilities and fix them"
>
> Earlier the same day: "i give you full permission now to do everything you want in every single way".

The full permission counts as his yes for:
- the protected files, wherever a lane truly needs them;
- KERNEL 3 item 6, the sites route;
- POLISH 3's money-pack tick.

## His standing rules, verbatim (NOT lifted, never broken)
"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and
voices only me and people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its
own; nothing that can cost money and no new keys unless I add them; the brain never gets live GPS; every engineering, car or
build number a first estimate, never certified; social posting only with my APPROVE every time; downloads only on my tap on
Wi-Fi with the size said. Never raise the prompt guard. Never skip or weaken a test. The CI guard job: … beyond that fix you
never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named by tier."

What these rules mean in practice:
- A Lens that "names everything" names things, plants, text, products, landmarks and codes. It names a face only if it is
  him or someone he introduced, and never a stranger.
- Recognising his voice is a convenience, never a lock.
- A comic "imported from real comics" means his own files, or public-domain and openly licensed comics from public sources
  (for example the Internet Archive or the Digital Comic Museum). Downloads happen only on his tap, on Wi-Fi, with the size
  said, and nothing pirated.
- Anything that would call a paid API is out. Use what is free and keyless or already keyed: on-device, public data, and the
  free models the brain already uses.

## Protected files
These change only where a lane truly needs it, and the commit message must say why:
- `apps/edge/src/agent.ts`
- `apps/edge/src/index.ts`
- `apps/edge/src/tools/{index,types,repo}.ts`
- `apps/*/package.json`

These never change, with two exceptions:
- `.github/*`: the only change allowed is ONE spec word appended at the END of check.yml's `all=` list.
- `apps/web/public/_headers`: may be TIGHTENED (security), never relaxed.

The prompt guard (5,500) is never raised. A lane that adds prompt words removes or condenses others to fit.

## How the code is checked
1. Read `.github/workflows/check.yml`. Every browser shard runs the whole brain suite first (apps/edge `npm test`), so one red
   brain test stops every browser check.
2. Set up the app:
   ```
   cd apps/edge && npm install --no-audit --no-fund
   cd apps/web && npm install --no-audit --no-fund
   ```
3. Build the web app with `cd apps/web && node build.mjs`.
4. Start a preview with `node tests/preview-server.mjs 8788`. It loads `apps/edge/test/.build/brain.mjs`, which `npm test`'s
   esbuild steps build.
5. Run a spec with `node tests/<name>.spec.mjs tests/.shots`. If the spec's Playwright cannot find a browser, set
   `CHROMIUM=/opt/pw-browsers/chromium` (the specs read it).
6. CI's runner is slower than your container, renders WebGL in software, and has no H.264 or AAC encoder:
   - A wait is always on the real condition, never a fixed sleep.
   - A budget is never raised. Make the code faster instead.

Ratchets (all in apps/edge/test):
- Every spec defaults `BASE` to `http://localhost:8788`.
- No merge-conflict markers anywhere.
- The STATES ratchet, the colour ratchet (no new hex or rgba literals: use the tokens), the error voice (no `e.message`,
  `String(e)` or `${e}` in apps/web/src outside `ui/hisWords.ts`; use `sayError(e, what)`, `rawText`, `trail(e, where)`) and
  knowledge.test's self-check.

## What "made by a company that specialises in it" means here
Every screen:
- is a complete app of its own: it does its job end to end, with nothing missing that the best dedicated app of that kind has;
- says each of its states in his words (empty, loading, error, offline, done);
- is fast;
- puts every key at 44 pt, keeps nothing sideways and cuts no words at BODY 21;
- draws only from the design tokens, and looks right in all seven looks (scan, map, eye, orbit, grown, ink, glass);
- remembers his data on the phone;
- is reachable by voice and chat, in more than one wording;
- has a spec that proves all of it at 440 × 956 and 390 × 844.

Where a screen has nothing behind it yet (a dead key, a promise the code does not keep, a contradiction between what it says
and what it does), make it real or take the promise out. Never leave it half-done.

## The lanes (each session owns its lane; touch another lane's files only to merge)

| Lane | Branch suffix | What it owns |
| --- | --- | --- |
| BODY AND KITCHEN | `lane-body` | features/body (water, sleep, steps, the health rooms), kitchen, outside |
| MONEY AND PEOPLE | `lane-money` | features/money, people, homeadmin, work, creative (not the comic) |
| PLAN AND HOME | `lane-plan` | agenda, brief, house, markets, radio, social, links, the Home screen |
| LEARN | `lane-learn` | learn, learning, library, reader, school (its brain too), gym, arcade, coach, rehearse, lab, interpreter, further |
| MAKE | `lane-make` | studio, workshop, workbench, reverse, space, convert, gamestudio |
| EDITORS | `lane-editors` | docs, sheets, slides, workspace, photo, video |
| SEE | `lane-see` | God's Eye (layers over cameras), threats, map, cameras, car, measure, machine view |
| LENS | `lane-lens` | the Lens, rebuilt as one point-and-it-knows lens |
| COMIC | `lane-comic` | the comic: import real comics and make real ones |
| VOICE, MEANINGS AND COLOURS | `lane-voice` | the brain knows the phone recognised his voice; many wordings mean one thing ("play music" → the radio); colours named plainly |
| BOOT | `lane-boot` | the boot cinematic, the 7-second film, back and right |
| SECURITY | `lane-security` | the vulnerability audit of the brain and the app, and the fixes |
| CONSISTENCY | `lane-consistency` | every claim Ghosty makes about itself (catalogue, abilities, persona, settings, docs) matching what the code does |
| SYSTEM AND SETTINGS (POLISH 3) | `lane-polish3` | POLISH 3 finished, and System, Settings, Me, the Look and the chat core given the specialist pass |
| CI TIMING | `lane-ci` | talk's first word, video's export length and steadying, games5's first move |
| MEMORY | `lane-memory` | BRIEF-DEPTH-MEMORY |
| SITES | `lane-sites` | KERNEL 3 item 6: a game on his sites as an installable page |

Each lane's branch is `claude/new-session-4erjve-` plus its suffix.

## Every session's protocol
1. Start from `claude/new-session-4erjve-final`. Work on your own branch.
2. Push your branch about every 45 minutes, so nothing is lost.
3. Commit messages are plain English and end with:
   ```
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   ```
   Builders are named by tier, never by model.
4. When your work is whole and green (typechecks; your brain tests plus ratchet, knowledge and look; every spec whose files
   you touched; and the full brain suite once), or at 21:00 UTC at the latest:
   1. `git fetch origin claude/new-session-4erjve-final` and merge it into your branch.
   2. Resolve conflicts keeping BOTH sides' intent. In check.yml's `all=`, keep every word, with yours at the end.
   3. Rerun the typechecks, the ratchet, knowledge and look tests, and your specs.
   4. Push your branch, then push the same commit to `claude/new-session-4erjve-final` (a fast-forward). If the push is
      rejected because another session got there first, fetch, merge, recheck and push again.
5. Never open a pull request, never touch main, and never change another lane's intent.
6. Write your lane's report as `docs/build-plan/FINAL-<LANE>.md`, in plain words for the owner, covering:
   - what was wrong;
   - what you made;
   - how to try it on his phone;
   - what is left.
   It is merged with your work.
