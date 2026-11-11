# BRIEF: POLISH 1 — THE EDGES (every state of the new worlds, one error voice, every wait said, the biggest text)

BRIEF-POLISH-1 (OWNER-ISSUES 176 and 178: "a lot of the things we have need huge amounts of polish", "insane quality even things in the past";
THE-GUIDE-11-NOV section 8 items 1, 5, 6; SMALL-GAPS families A, J, K, L; QUEUE-11-NOV item 2 and THE QUALITY RULE). Nothing new is added. What
is there is made right, at the edges where an app shows its seams: the states nobody designs, the words a browser says, the beat of nothing
before a thing arrives, the biggest text size. One builder, one PR. The design system is the only look.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json.

## What is made right

1. **ONE ERROR VOICE (SMALL-GAPS A).** Today 27 places in apps/web/src render or speak a thrown thing's own words (`e.message`, `String(e)`,
   `${e}`): "The operation was aborted", "fetch failed", "undefined", "[object Object]" can reach him. One funnel, `ui/hisWords.ts` →
   `sayError(e, what: string): string`, maps any thrown thing to his own words in few words with what it means and what to do ("I lost the
   signal halfway. Try again when you have one." / "That took too long; I stopped it." / "The phone would not give me the camera. Settings,
   Ghosty, Camera."), by the error's kind (abort, network, timeout, permission, quota, not found, the rest), never the raw text; the raw text
   goes to the WHY trail and the day log only. Every one of the 27 goes through it. A lint test (apps/edge/test or tests/, whichever already
   lints apps/web source: knowledge.test's shape) fails on any new `e.message` / `String(e)` / `${e}` reaching a render or speak call outside the
   funnel and the WHY trail.
2. **EVERY STATE OF THE NEW WORLDS (K, L).** For THE SCAN, ONE INK and (if landed by then) THE MAP, on every screen the shell draws (Home, the
   plan, the hubs, Every screen, Settings, the Theme page, the chat log with the Stage): the empty state (nothing yet: `empty()` from
   ui/components.ts, in the world's own marks, in his voice, with the one next thing to do), the loading state (a wait said in words, never a
   bare spinner, never a blank), the error state (through the funnel), the offline state (what still works said, what needs a signal said
   once), the biggest text size (BODY 21: nothing cut, nothing sideways, a wrap never a smaller size) and one-handed reach (every primary key
   in the lower half or on the ask line). Sheets opening over the printed page in ONE INK get the ink's own plain sheet (a hairline, square, no
   glass). A table in the report: screen × state × world, each cell "right" or what was changed.
3. **EVERY WAIT SAID (J).** Any await the user can feel (over 400 ms) shows his-voice progress where it happens: the Lens's first tag ("Looking…"
   as a tag row, replaced by the first real one), a brain's load ("Waking the 2B. Twenty seconds or so."), a pack's download (the bar it has,
   with the words), the Studio's first scene ("Building the room…"), the Stage's picture ("Drawing it…" under the sentence until it lands), a
   course's first lesson, SIT's first paper, a built website's publish. One helper `ui/wait.ts` → `waiting(el, words)` that draws the words in
   the design system's truth style and removes them when the thing lands or fails (then the funnel speaks). Nothing is ever a frozen nothing.
4. **THE HOUSE LINE AND THE FOOT AT BODY 21.** The Scan's `THE HOUSE · 7 ROOMS` / `YOU ARE IN <ROOM>` line and ONE INK's foot of rooms at the
   biggest text: nothing cut, the line wraps to two rows with the second row right-aligned, the foot wraps as a second line of type; every tap
   target still 44 pt.
5. **THE BOOT'S HAND-OVER ON A SLOW OPEN.** When the first screen is late (the network slow, the brain cold), the film must not hold on one shot:
   the last shot loops its own motion (the scan's sweep) and the descent lands the moment Home is ready, with no cut; a line in the film's
   voice if the wait passes six seconds ("Still waking. The signal is slow.").

## What must not change

The first-screen budget and every other budget; GLASS pixel-equal; ONE INK's page; THE SCAN's Home; every control 44 pt; nothing sideways at
440 × 956 or 390 × 844; the finding rule; the ratchet ceiling (hex 506, rgba 1016, radiusPx 470, total 1992: equal or lower; this pass should
LOWER the total if anything); the prompt guard; no new key; nothing added that is not already there.

## Tests (each fails on the code before this brief; run against it once and say so)

- The lint test for the error funnel (fails on the 27 today; passes when all go through sayError).
- tests/polish1.spec.mjs (new; `all=` word `polish1` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390, in
  THE SCAN and ONE INK: (a) with the network cut (route abort) on Home, the chat and the Lens, no element's text matches a raw browser string
  (a list in the spec: "aborted", "fetch failed", "undefined", "[object Object]", "TypeError", "NetworkError", "Failed to"), and his words are
  shown; (b) the Stage, the Lens and the Studio show a waiting line within 400 ms of their start and remove it when the thing lands; (c) at BODY 21
  the house line and the foot are within the screen with no word cut (the measure look.spec uses); every tap target on them 44 pt; (d) empty
  states on five seeded-empty screens (Favourites, Recents, the Library shelf, Spending, Watchers if landed) show `empty()`'s shape in the world's
  marks with a next-thing line; (e) the boot with a 7 s delayed first screen never shows the same frame for over 1.5 s and lands with no cut (a
  frame-diff of two stills).
- look.spec, ink.spec, thescan.spec, speed2.spec, boot/nav specs unchanged unless a fix lives in a screen they own; then that spec's check is the
  proof, red before, green after, nothing loosened.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8813:
`(nohup setsid node tests/preview-server.mjs 8813 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8813.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8813 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is never committed. In the foreground, alone, one after another: polish1, look, ink, thescan, speed2,
boot (or the spec that owns the boot), nav, ui, layout, library, settings, lens, showme, studio, talk. The brain tests in the background once at
the end. A timing budget missed under load is rerun alone before it is called red. Known sandbox reds not touched: direct, aim, radio, scroll,
safari, eye's own screenshot, tabs2, talk's cooling lines; look's "at BODY 21 the Theme page cuts words" is being fixed by SMALL FIXES 1 and is
not yours unless it is still red on your base.

## The owner's phone check

1. Flight mode on, ask anything: his own words about the signal, never a browser's. Open the Lens: the words say what still works.
2. Settings, Accessibility, the biggest text: the house line and ONE INK's foot wrap, nothing cut, every room still tappable.
3. "Where is Lisbon?": "Drawing it…" under the sentence for a beat, then the map. Open the Studio: "Building the room…" then the room.
4. Close Ghosty, switch to a slow connection, open it: the film keeps moving and lands on Home with no held frame.
5. A screen with nothing in it yet (Favourites before you star one): his words and the one thing to do, in the world's own marks.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/polish1-report.md: the 27 places and what each says now; the
screen × state × world table; the waits added; each spec's last line (before and after for the new one); what was found and not fixed; NEEDS
HIS WORD; the phone check as above; the commit list. One commit per step on builder/polish1; the orchestrator squashes to one on landing.
