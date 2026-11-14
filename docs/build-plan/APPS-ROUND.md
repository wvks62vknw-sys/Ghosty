# THE APPS ROUND (14 November 2026): one shared brief for fifteen lanes

Fifteen cloud sessions work at once, one flagship app each. They all start from the integration branch
`claude/new-session-4erjve-apps`, which is main (`ab5e3de6`: the next round, its polish and fixes) plus this file and `docs/build-plan/apps/`.
Your work is in `docs/build-plan/apps/<your lane>.md`. The catalogue behind it: ten teams swept every app category, then a judge
ranked 580 proposed apps and 175 existing ones against the market leaders.

## The owner's words (14 Nov)
> "first of all they could be better like the ability to make 3d games, and all the other sections much better too … every single
> thing like that that already exists and ones to come like every thing that 'could' be an app; i want it to look and feel like an
> app a major billionaire co operation in that field would actually create … there's probably hundreds or even thousands of 'apps'
> we could create inside this"
>
> "i don't want any sloppy text i want it all to fit the clean aesthetic … everything must be genuine jaw dropping quality"

## Times (UTC, 14 Nov) and usage
- **CONSISTENCY merges the App Kit's core by 14:45.** Everyone else starts on their app's engine and features, and adopts the kit as soon as it lands (fetch, merge).
- **15:00:** your first merge of whatever is whole and green.
- **17:00: HARD STOP.** Your last merge, your report `docs/build-plan/APPS-<LANE>.md`, then a message to `@parent` with the sha and what's left. Then stop completely.
- **Usage is tight:** the owner's weekly allowance is limited, and the account hit its 5-hour cap once today. So use at most one or two helper agents at a time, no parallel builder waves, and finish whole pieces rather than start big new ones.

## The standard every app meets (the judge's quality bar)
1. Its own name, icon and front door: on its hub, in the Jump bar, pinnable to Home, and opened by voice or chat at the exact screen ('open Sheets at the budget').
2. The first run shows it working with real-looking sample data and a three-step tour. Never an empty grey screen.
3. Built only from the shared app kit (the correct builders): one header, toolbar, sheet, list row, button, spacing grid and type scale, so hundreds of apps feel made by one company.
4. Scrolling and gestures feel native: one scroll area per screen, nothing stuck or scrolling twice, momentum, swipe back, pull to refresh where it fits, safe areas respected, and the page never scrolls sideways.
5. Messages never jump out of nowhere: no big text flashing up in the middle of the screen. Notices appear small and calm in one fixed place and leave on their own or with a tap.
6. Every state in plain words: empty, loading with progress, offline, an error with its fix, and done. Skeletons stand in instead of content popping in, and nothing jumps around.
7. Undo and redo for every change, saving as you go, version history for anything you make, and deletes go to a Recently deleted bin.
8. Search inside the app, and everything it keeps can be found from Ghosty's global search and from Files.
9. It opens and exports the leaders' formats (docx, xlsx, pptx, PDF, glTF, apkg, CSV, GPX and the rest) and shares through the iPhone Share sheet.
10. It works offline for everything that does not truly need the network, keeps things on the phone first, and says plainly which parts need a signal.
11. Fast: opens in under a second, touch and animation at 60 fps, heavy work done off the main screen, and typing never waits.
12. Touch-first: 44 pt keys, main actions at the bottom within thumb reach, Apple Pencil and keyboard shortcuts wherever it draws or types, and a sound cue where other apps would vibrate (Safari ignores vibration).
13. It looks right in all seven looks, light and dark, and at every text size, with contrast checked, VoiceOver labels in reading order, calm motion, and captions for anything spoken.
14. Ghosty inside: an ASK button that works on whatever is open and shows his changes as suggestions to accept or reject.
15. A widget-sized summary card for Home and, where it helps, a line in the morning Brief.
16. A settings page with good defaults, a short help page, and professionally designed templates or presets to start from instead of a blank page.
17. The house rules built in: only his data and public sources, nothing that costs money or needs a new key, downloads only on his tap on Wi-Fi with the size said, anything going out waits for APPROVE, and every engineering, car or build number is labelled a first estimate.
18. Checked before it ships: its own tests, iPhone-size screenshots in every look in CI, and no console errors.

## His standing rules, verbatim (NOT lifted, never broken)
"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me
and people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost
money and no new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never
certified; social posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt
guard. Never skip or weaken a test. The CI guard job: … beyond that fix you never touch it. Never put a model name in code, comments,
tests, docs or pull request text; builders are named by tier."

What the last two rounds' reviews caught:
- **APPROVE is bound to exactly what it showed.** Pin an identity (a time, an id, a fingerprint) in the approval args, and refuse at run time if it changed.
- **LOCK EVERYTHING** already blocks every publish at the store and every 'confirm' tool. Don't add a way round it.
- **Another voice is never answered with his private things,** in any wording. A turn kept on the phone (the offline brain on "always") never leaves the phone, not as a note and not queued for later.
- **Free and keyless only.** Downloads only on his tap, on Wi-Fi, with the size said.

## Protected files
These change only where an item truly needs it, and the commit says why:
- `apps/edge/src/agent.ts`
- `apps/edge/src/index.ts`
- `apps/edge/src/tools/{index,types,repo}.ts`
- `apps/*/package.json`

The two exceptions:
- `.github/*`: only spec words appended at the END of check.yml's `all=`.
- `apps/web/public/_headers`: only tightened, never relaxed.

The prompt guard (5,500) is never raised.

## How the code is checked (as in NEXT-ROUND.md), plus what this round's CI and review taught
1. Set up: `npm install` in apps/edge and apps/web. Build with `cd apps/web && node build.mjs`. Brain bundles come from `cd apps/edge && npm test` (or its esbuild steps, with node_modules/.bin on PATH).
2. Preview with `node tests/preview-server.mjs <port>`. Specs: `BASE=http://localhost:<port> node tests/<name>.spec.mjs tests/.shots`.
3. CI: four shards. Each runs the whole brain suite, then its specs at 480 s each (720 s for nav and routec), with one retry. CI is slower than your container and renders WebGL in software.

The lessons, each of which cost a red or a visible bug:
- **Class names collide.** A bare global class (`.wall`, `.recent`, `.orbsay`) styled another screen's element and broke it, including the big white text he saw. Give every new rule your app's own prefix, or scope it under your page (`#pg-<id>`). Grep styles.css for the class before you add it.
- **Words other specs read:** grep tests/ before changing any on-screen words, and update every spec to the new truth, as strict as before.
- **Chat replies:** find his message by `data-at`, then wait for the first matching reply after it (`H.ask` in planlane). The log draws only 40 entries.
- **The clock:** anything date-based is anchored to London's midnight. CI runs at any hour.
- **No fixed sleeps:** wait on the real condition. Measure sizes only after the screen's 0.5 s scale-in has finished.
- **Software GL:** a heavy WebGL scene holds CI's GPU process for over a second per frame. Your 3D or canvas app must stay responsive under software rendering, with no taps lost.
- **Test pages** use `*.loopback.test` hosts (the netguard refuses loopback).
- **Spec length:** keep each spec under 300 s in your container. Split it into a new spec word appended to `all=` rather than run long.
- **Ratchets:** BASE 8788; no conflict markers; the STATES ratchet; colour tokens only (no new hex or rgba); the error voice (sayError, rawText, trail); knowledge.test's self-check, which flags placeholder-looking comments, so never start a comment with "…".

## Every session's protocol (as before)
1. Work on your own lane branch (BODY, MAKE and MONEY on their `-next` branches). First `git fetch origin claude/new-session-4erjve-apps` and merge it in (no force-push).
2. Push your branch about every 45 minutes.
3. Commit messages are plain English, with the Co-Authored-By trailer your session gives you. Builders are named only by tier.
4. Each time a piece is whole and green:
   - **checks:** the typechecks; your brain tests plus ratchet, knowledge and look; your specs at 440 and 390; and the full brain suite once;
   - **then merge:** fetch the integration branch, merge it, recheck, push your branch, then fast-forward `claude/new-session-4erjve-apps`. If the push is rejected, fetch, merge and retry.
5. Never open a pull request, never touch main, and never change another lane's intent.
6. **Your report** is `docs/build-plan/APPS-<LANE>.md` for the owner, in plain words: what you built, how to try it, what's left.
