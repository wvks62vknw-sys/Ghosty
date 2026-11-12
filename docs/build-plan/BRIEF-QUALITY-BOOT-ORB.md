# BRIEF: QUALITY PASS — THE BOOT AND THE ORB (the cinematic's every state, the orb's every state, the ribbon, made right; nothing new added)

BRIEF-QUALITY-BOOT-ORB (OWNER-ISSUES 178 "i want everything to have insane quality even if there's things in the past which we've had which
could have better quality"; 184's WHATS-LEFT list 4 "the boot and the orb"; 142 "the cinematic btw which can be a lot lot lot better"; the
HOME pass's two boot-and-orb fixes and its leftovers; QUEUE-11-NOV, the tenth QUALITY PASS). One builder, one PR. The mid tier. Nothing new is
added: the boot and the orb are measured and made right by the method of BRIEF-UPGRADE-PASS, and the STATES RATCHET (apps/edge/test/
ratchet.test.mjs) gains their surfaces. What this pass owns: THE BOOT (shell/boot.ts: every word on it and every state it can be in: the cold
open, the skip, the replay from "reboot", the fault, the slow open's hand-over that POLISH 1 built, the short version and the lean cut on a
phone that cannot keep up, the flat kind with no 3-D, Reduce Motion, offline, each world's floor and film hand-over; features/core/scan/
film.ts's words and states only), THE ORB (features/core/mind.ts and reactor.ts: its five states idle, attending, listening, thinking,
speaking each readable with the motion off; what it shows when the brain is dead, cooling or offline; the press and the hint the HOME pass
added; the 2-D reactor fallback's words; heavy mode's still frame), THE RIBBON (OCTOBER IDEAS 1's readout ribbon, the line that says what
Ghosty is doing: its every line one sentence in his voice, every state, the tilt and the time-of-day light said nowhere as a developer word,
"On it." as POLISH 3's item 4 leaves it), and the catalogue words for the boot and the orb. NOT THIS PASS'S: the storyboard's cut and its
times (2,880 ms; the film's 7,000; the frame budget; boot.spec's numbers: none moves), the film's and the floors' drawings, three.js and how
it loads, the first-screen budget (speed2), Home's instruments and chips (the HOME pass), the chat's talk bar (the chat pass), THE EYE's own
boot shot (BRIEF-EYE-HUD-2), the HUD rings (hud.ts: the chat pass owns its call-outs). Starts FROM MAIN once POLISH 1 (#91) and OCTOBER
IDEAS 1 with LIFE EASIER (#92) are on main and green there, so the slow-open hand-over and the ribbon exist; the HOME pass's boot fixes are on
its own branch in the landing queue: where this pass touches a line the HOME pass also touched (boot.ts's fault line, the orb's hint), it
takes the HOME pass's words as given (read scratchpad/homepass-report.md fixes 22 and 23) and the orchestrator resolves the two as a union.
Read STANDARD.md, BRIEF-UPGRADE-PASS.md (the method), BRIEF-ORB-AND-BOOT.md and the storyboard's README (docs/build-plan/mockups/boot/
2026-11-07), BRIEF-POLISH-1.md item 5, the OCTOBER IDEAS 1 report (scratchpad/octideas-report.md: the ribbon and the orb that reacts),
BRIEF-QUALITY-HOME.md and its report, `tests/boot.spec.mjs` (its header is the boot's contract), `tests/hero.spec.mjs` (MIND), `tests/speed2.
spec.mjs`, `tests/homepass.spec.mjs`. THE QUALITY RULE holds.

## His words
"really cinematic and cool", "on every boot up", "the cinematic btw which can be a lot lot lot better" (43, 45, 142); "insane quality … even
things in the past" (178). The boot is the first thing he sees every time and the orb is the face of the app: nothing on either may lie, stall
in silence, or need motion to be understood.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. No package; nothing from the network.

## What is made right

1. **MEASURE FIRST, WRITTEN DOWN (the method's step 1).** On the preview at 440 × 956 and 390 × 844, in each of the five worlds, with the
   brain live, slow (7 s to the first screen, as POLISH 1's check does), cut and dead, the signal off, software GL and the flat kind (WebGL
   refused), Reduce Motion on and off, heavy mode on: a cold open to a usable Home; TAP TO SKIP at each shot; "reboot"; the fault (main.ts's
   boot failing); the feeds' lines when none answers, when some do, when offline; the stamp's words at 3 am, noon and 11 pm, with and
   without a saved place; the greeting's name when none is saved (what does "Boss" stand for, and is it his word?); the hand-over on the slow
   open (no frame held over 1.5 s, lands with no cut); the orb in each of its five states with the motion off (can he tell listening from
   thinking from a still?), with the brain dead, cooling and offline (does the orb say so, or go on glowing as if all were well?), the press
   and its hint, the 2-D reactor's words, heavy mode's still; the ribbon in every state it has (idle, a turn running, a tool running, done,
   failed, offline, the brain cooling) and its length at BODY 21. List every rough spot: a state with no words (the fault with no next thing,
   a stall with no line, the orb glowing over a dead brain, a ribbon line missing for a state), a word not his (developer words on the stamp
   or the ribbon: "init", "ws", "fetch", "ready", a raw error, a placeholder name), a number without its unit (the feeds' count, a wait), a
   wait over half a second with no words (the slow open's hold, the first three.js load when Home shows an empty hero), a tap that does
   nothing (TAP TO SKIP after the recognition; the orb's press before its hint), anything under 44 pt (TAP TO SKIP's target, the orb's press
   target), anything sideways, anything a film title or a good app's launch does better (the type's rhythm, the sound's restraint, the way the
   name lands). Rank by how much he would feel it. The whole list is in the report, before any fix.
2. **FIX THE TOP TWENTY (THE BOOT nine, THE ORB seven, THE RIBBON four), each the smallest change that does the job, each with a spec check
   that fails on the old code.** Known to start with: the greeting never a placeholder: his saved name, else no name ("Good evening." alone,
   never "Boss" unless he saved it); the fault says the next thing ("I couldn't start this time. Tap to try again." with the tap doing it) and
   keeps the HOME pass's words; the stamp's CHECKING FEEDS becomes its truth within the storyboard's time or says "NO FEEDS YET" rather than
   holding; offline said on the stamp in one line and the feeds' lines not pretended; TAP TO SKIP 44 pt and present until the landing
   (nothing to tap after the recognition today); the flat kind's words the same as the full cut's (no shot silent); the slow open's hold line
   ("Still starting…" with what it waits for: the brain, the network) in the stamp's small type, never a frozen frame; the lean cut and the
   short version said nowhere to him but true in __bootState; Reduce Motion's two frames carry every word the full cut does; THE ORB: each
   state told apart with the motion off by its light alone (listening a steady open rim, thinking the pulses, speaking the sweep, attending
   a lean toward the ask line, idle the breath) and said once under it in words on first use ("I'm listening.", the chat pass's words, the
   same file); a dead or offline brain dims the orb to its own honest state (the light low, no pulses, the ribbon saying why) and never
   glows as if answering; cooling shown as the pulses slowing with the ribbon's time; the press's hint from the first press, one sentence
   (the HOME pass left "after the tenth press" as a question: decided here, first press, once); the 2-D reactor's words the same as MIND's;
   heavy mode's still frame says once why it is still; the orb's press target 44 pt; THE RIBBON: one sentence per state in his voice, a tool's
   line from narrate.ts never a bare verb, the failed line with RETRY where RETRY is possible, the offline line, cooling with its time,
   nothing cut at BODY 21 (the ribbon wraps to two lines or shortens to its first clause, never an ellipsis mid-word), the tilt and the hour's
   light never named on screen.
3. **THE STATES RATCHET gains the boot and the orb.** Rows `shell.boot` (exists: raised, never lowered), `shell.film` (`at: 'shell'` or the
   film's own dir), `core.orb`, `core.ribbon` (dir 'core'), measured on the base and pinned at the new, higher number; `sourceOf` extended
   where a new directory is drawn from. Before and after in the report.
4. **WORDS.** Every line the boot, the orb and the ribbon show in pure words files (shell/bootwords.ts; features/core/orbwords.ts, shared with
   the chat pass's talk-bar lines where the same state is said) the specs import; each one sentence; the catalogue words for the boot and
   the orb re-cut to the same voice.
5. **PROVE IT.** Before-and-after stills of the boot's eight shots in The Scan and the flat kind, the fault, the slow open's hold, the orb's
   five states with motion off, the orb over a dead brain, the ribbon in four states at 440 (twenty-four stills, written by the spec,
   deleted after the report lists them); the boot's timings before and after from boot.spec (unchanged within the load's noise, the cut's
   numbers never moved); speed2's first screen before and after.
6. **LEAVE THE LIST.** What was found and not fixed, ranked, with why, so the next pass knows.

## What must not change

The storyboard's cut and every time in it; the film's cut; the frame budget and its honesty; boot.spec's every existing check (it gains, it
loses none); the first-screen budget; three.js loaded once and only when Home shows; one WebGL context; GLASS pixel-equal and the other worlds'
boot shots byte-equal but for the words this pass changes (each named); the sound rules (no tone on a cold open before a tap); the prompt
guard; no new key; nothing that costs money; the HOME pass's words where they stand; the ratchet's ceiling.

## Tests (each fails on the code before this brief; run against it once and say so)

- tests/bootpass.spec.mjs (new; `all=` word `bootpass` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390,
  with software GL and the flat kind: one check per fix (twenty, grouped THE BOOT · THE ORB · THE RIBBON), each named for the rough spot it
  closes; plus: no placeholder name ever greets; every shot of the flat kind and of Reduce Motion carries the full cut's words; the slow
  open's hold line within 1.5 s and the landing with no cut (POLISH 1's check kept and read); the orb's five states told apart with motion
  off by a measured light reading each; the orb low over a dead brain; the ribbon's words present for every state and nothing cut at BODY 21;
  TAP TO SKIP and the orb's press 44 pt; the boot's timings and the first screen within the budgets.
- apps/edge/test/ratchet.test.mjs gains the rows (equal or higher).
- boot, hero, speed2, speed, homepass, nav, look, ink, thescan, eyehud, maphud, routec, polish1, octideas (or the spec that owns the ribbon)
  unchanged unless a fix lives in a surface they own; then that spec's check is the proof, red before, green after, nothing loosened.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. The preview's brain bundle as the passes do (`npx esbuild src/index.ts
--bundle --format=esm --platform=neutral --external:cloudflare:sockets --outfile=test/.build/brain.mjs` in apps/edge). Preview on port 8846:
`(nohup setsid node tests/preview-server.mjs 8846 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8846.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8846 timeout 590 node tests/<name>.spec.mjs tests/.shots` (bootpass,
boot and hero WITHOUT NO_GL_SHOTS; the rest with NO_GL_SHOTS=1); a nogl copy as `tests/.<name>.nogl.tmp.mjs` and tests/.shots are NEVER
committed (`git status` before every commit; tests/.shots removed after every run). In the foreground, alone, one after another: bootpass,
boot, hero, speed2, speed, homepass, nav, look, ink, thescan, eyehud, maphud, routec, polish1, the ribbon's spec; the brain tests once at the
end in the background with a 1700 s cap, polled. A timing budget missed under load is rerun alone before it is called red and the budget is
never changed; a spec killed at 590 s with no failure line is rerun once alone and, if killed again, reported as that with the last line it
printed. Known sandbox reds not touched: direct, aim, radio's audio, scroll, safari, eye's own screenshot, tabs2's jump bar at 390, tabs' taps
under load, nav's CDP close, speed2's first screen under load (compare with the base at the same load), look's BODY 21 cut on the Theme page,
talk's cooling lines. One spec at a time; the machine is shared.

## The owner's phone check

1. Close Ghosty and open it from your Home Screen: every word on the boot is true of its moment; the greeting has your name, or none, never a
   stand-in. Tap during the name: it skips and lands clean.
2. Aeroplane mode, cold open: the stamp says so in one line; no feed is pretended; Home lands.
3. Settings → Reduce Motion, cold open: the still version says everything the moving one does.
4. On Home with the motion still: can you tell from the orb's light alone when it is listening, thinking and speaking? Press the orb once: the
   hint, one sentence.
5. Turn the brain off (Settings → the brain's switch, or aeroplane mode): the orb goes low and the ribbon says why; nothing glows as if it
   were answering.
6. Ask for something slow: the ribbon says each step in a sentence; biggest text: nothing cut mid-word.
7. "reboot": the film again over Home, the greeting spoken once. Does the boot now feel like a title sequence you would show someone?

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/bootpass-report.md: the measured list (before any fix); the
twenty fixes with before and after (words quoted, the twenty-four stills named); the ratchet counts before and after; boot.spec's and speed2's
numbers before and after; the leftovers ranked; each spec's last line (before and after for the new one); NEEDS HIS WORD; the phone check as
above; the commit list. One commit per fix (or per surface) on builder/bootpass; the orchestrator squashes to one on landing.
