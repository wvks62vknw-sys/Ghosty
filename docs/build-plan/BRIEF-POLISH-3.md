# BRIEF: POLISH 3 — THE WORDS AND THE TWO SCREENS (one sentence a screen; the Agenda and System upgrade passes; SMALL FIXES 2)

BRIEF-POLISH-3 (OWNER-ISSUES 176 and 178; THE-GUIDE-11-NOV section 8 items 4 and 8; QUEUE-11-NOV item 6 and THE QUALITY RULE; SMALL FIXES 2
from OWNER-ISSUES 179 (b) and LIFE EASIER's found-not-fixed). Nothing new is added. Four screens say too much and are cut to one sentence
each; the two screens never given their upgrade pass (the Agenda and System) get it by the method every other feature had; two small fixes
ride along. One builder, one PR. The design system is the only look; THE SCAN, ONE INK, GLASS and the HUDs landed by then all keep working.
Starts after OCTOBER IDEAS 1, LIFE EASIER and POLISH 1 are on main (it builds on their acks, watchers, error funnel and wait helper).

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. apps/edge/src/tools/money.ts and
apps/edge/src/watchers.ts are NOT protected.

## What is made right

1. **ONE SENTENCE A SCREEN (guide 8.4).** Settings (features/settings/index.ts and its pages), System (features/system/index.ts and its
   pages), the Theme page (features/look/index.ts) and the packs' cards (features/settings/packs.ts) are swept and cut: a row's helper text is
   at most one sentence and never repeats its label; a section's title is one or two words; a card says what it is, what it costs (free, or the
   size), and the one key, nothing more; a screen's own introduction is one line or none; a number is written once. Nothing is lost: a sentence
   that carried a fact he may need goes to that row's "?" (the existing WHY / explain pattern where the screen has one, else a tap on the row's
   title opens it as a sheet), never into a smaller type. A WORDS RATCHET joins the ratchet test (apps/edge/test/ratchet.test.mjs): for each of
   the four screens, the count of string literals over 90 characters in its files, measured on the base and pinned at the new, lower number
   (equal or lower from then on, the same shape as the colour ratchet). The before and after counts in the report, with each cut sentence and
   where its fact went.
2. **THE AGENDA'S UPGRADE PASS (guide 8.8; BRIEF-UPGRADE-PASS's method).** Measure first, written down: open the Agenda at 440 and 390 as he
   would, with the brain mocked where it must be; list every rough spot (slow, unclear words, a state with no message, a tap that does nothing,
   a number that could be wrong, a thing a calendar app does better), ranked by how much he would feel it. Fix the top ten, each the smallest
   change that does the job, each with a spec check that fails on the old code. Known to start with: the day's line at a glance (today's first
   thing and its time at the top, the free gap said), ADD in two taps from anywhere on the screen, a time typed as he says it ("half three",
   "quarter past"), a reminder's own words kept whole, the WATCHERS list (LIFE EASIER put it under PLAN) in the Agenda's own grammar, the empty
   day said in his voice with the one next thing, the biggest text and reduced motion right. Leave the list of what was found and not fixed.
3. **THE SYSTEM SCREEN'S UPGRADE PASS (the same method).** The System screen and its pages (training, loops, the report card, backup, storage,
   speed, night, foresight, independence): measure, rank, fix the top ten. Known to start with: one honest line at the top (WORKING, or what is
   not, in his words), every number with its unit and its "as of", a wait said on every page that fetches, the report card readable at BODY 21,
   BACKUP's size said before the tap, nothing that looks like a button and is not. The report's table as in the other passes.
4. **SMALL FIXES 2a: "ON IT." IN THE PHONE'S OWN VOICE, NEVER OVER DOWNLOAD (OWNER-ISSUES 179 b).** OCTOBER IDEAS 1's acks (assistant/acks.ts)
   already speak through the phone's own synthesiser, instant and offline; prove it (the spec asserts no network call and no brain route on an
   ack) and prove the offline brain's DOWNLOAD key is never acked (its confirm sheet opens first; the ack table has no row for it: a spec check
   that taps DOWNLOAD with the fake speaker counting and sees zero). An ack never speaks over a reply on the air (a check with a reply being
   spoken).
5. **SMALL FIXES 2b: ONE WATCHER SYSTEM (LIFE EASIER's found-not-fixed).** The money pack's price watches (apps/edge/src/tools/money.ts `watch`
   and `unwatch`, MONEY_KEYS.watches, read twice a day) and WATCHERS (apps/edge/src/watchers.ts, read on the hourly beat, told once) are made
   one: a price watch made through the money pack is stored as a watcher of kind `price` (the watchers' store, the watchers' reading, the
   watchers' one telling, MIN_GAP keeping a shop safe), `unwatch` removes it there, and the WATCHERS list under PLAN shows it with STOP like the
   rest; the money pack's own words and its `watch` listing keep working, reading from the watchers' store; the twice-a-day follow job that
   money.ts adds is no longer added (an existing one is left to run out and does nothing). The money pack's tick in the brain's agent file is
   protected: it stays as it is and must not double-tell (the watchers' store carries the last told reading; a second reader of the same drop
   tells nothing). Its removal is NEEDS HIS WORD for KERNEL 2, named in the report.

6. **SMALL FIXES 2c: "SHARE TO GHOSTY" FROM ANY APP (his yes, OWNER-ISSUES 185).** apps/web/public/manifest.webmanifest gains a
   `share_target` (method POST, enctype multipart/form-data, `title`, `text`, `url` and `files` accepting images, PDFs, documents, sheets,
   slides, audio and video), and the service worker answers that POST by keeping the shared things in the phone's own database and
   redirecting to the app with one marker, where the library's existing Add path takes a file (the same words and sizes as a file picked
   there) and the chat takes shared words or a link as his typed line, never sent anywhere by itself. Said once the first time: "Shared
   from another app; kept here." Nothing leaves the phone. Proof: polish3.spec posts a form to the share path on the preview (a picture
   and a line of text) and sees the picture in the library and the words in the ask line; the manifest's share_target parsed and its
   fields named; the Shortcuts' `?add=` of LIFE EASIER unchanged. Installed as a Home Screen app, the share sheet lists Ghosty: NEEDS HIS
   PHONE (the phone check has it).

## What must not change

The first-screen budget and every other budget; GLASS pixel-equal; ONE INK's page; every control 44 pt; nothing sideways at 440 × 956 or 390 ×
844; the finding rule; the ratchet ceiling (hex 506, rgba 1016, radiusPx 470, total 1992: equal or lower); the prompt guard; no new key;
no fact cut from a screen without a home on that screen; the boot (POLISH 1 did the slow open: not this brief's); nothing of another
feature's files beyond the two fixes named.

## Tests (each fails on the code before this brief; run against it once and say so)

- tests/polish3.spec.mjs (new; `all=` word `polish3` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390: (a)
  on Settings, System, the Theme page and a packs card, no visible text node over one sentence (one terminal full stop or none; a list of
  allowed exceptions in the spec, each with why), no row's helper repeating its label's words; (b) the Agenda's ten fixes, one check each,
  including the day's line, ADD in two taps, "half three" parsed, the empty day's words, BODY 21; (c) the System screen's ten fixes, one check
  each, including the honest top line, every number with a unit, a wait said on a fetching page; (d) an ack makes no network request and the
  fake speaker counts one; DOWNLOAD counts zero; an ack during a spoken reply counts zero; (e) a price watch made by the money pack's words
  appears under WATCHERS with STOP and STOP removes it from the money pack's list too.
- apps/edge/test/ratchet.test.mjs gains the WORDS RATCHET (four pinned counts, equal or lower).
- apps/edge/test/watchers.test.mjs (LIFE EASIER's, imported by one line) and apps/edge/test/money.test.mjs (or the test that owns the money
  pack): a `watch` through the money pack lands in the watchers' store and is read by the watchers' beat; a drop is told once by whichever
  reader sees it first and never by the second; `unwatch` and STOP are the same removal.
- agenda.spec, settings.spec, packs.spec, packs2.spec, packs3.spec, independence, backup, foresight, speed, night, look, ink, thescan
  unchanged unless a fix lives in a screen they own; then that spec's check is the proof, red before, green after, nothing loosened.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8819:
`(nohup setsid node tests/preview-server.mjs 8819 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8819.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8819 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is never committed. In the foreground, alone, one after another: polish3, agenda, settings, packs,
packs2, packs3, independence, backup, foresight, speed, night, look, ink, thescan, speed2, nav, layout, talk, lifeeasier, octideas. The brain
tests in the background once at the end (rebuild the preview's brain bundle first: `npx esbuild src/index.ts --bundle --format=esm
--platform=neutral --external:cloudflare:sockets --outfile=test/.build/brain.mjs` in apps/edge). A timing budget missed under load is rerun
alone before it is called red. Known sandbox reds not touched: direct, aim, radio, scroll, safari, eye's own screenshot, tabs2, talk's cooling
lines.

## The owner's phone check

1. Settings, then System, then the Theme page, then a pack's card: every line one sentence; nothing you used to read is gone (its "?" has it).
2. The Agenda: today's first thing and its time at the top; ADD, say "dentist half three": it lands at 15:30; an empty day says what to do.
3. System: one honest line at the top; every number has its unit and its "as of"; BACKUP says its size before you tap.
4. Tap TRAIN NOW with the voice on: "On it." at once, offline too. Settings, the offline brain, DOWNLOAD: the sheet opens and nothing is said.
5. "Watch the price of this" with a product page: PLAN, WATCHERS lists it with STOP; STOP, then "what are you watching?": gone from both.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/polish3-report.md: the cut sentences and where each fact went,
the four words-ratchet counts before and after; the Agenda's and System's measured lists, the ten fixes each with before and after, the
leftovers ranked; each spec's last line (before and after for the new one); found-not-fixed; NEEDS HIS WORD (the money tick's removal at
KERNEL 2); the phone check as above; the commit list. One commit per step on builder/polish3; the orchestrator squashes to one on landing.
