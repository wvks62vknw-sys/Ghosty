# BRIEF: THE OCTOBER IDEAS, SLICE 1 — THE HUD ALIVE (the readout ribbon, the tilt, the orb reacting, the light following the day, spoken acknowledgements)

BRIEF-OCT-IDEAS-1 (OWNER-ISSUES 176: "even if i said something like 2-3 weeks ago which could be added let's do it"; the ideas put to him on
24 Oct in IDEAS-24-OCT, "The HUD and the look", all five; THE-GUIDE-11-NOV section 7, items 1 to 5). Five small things that make the HUD feel
alive, each free, each on the phone, each in the design system's own marks. One builder, one PR, one commit when landed. The design system is
the only look: tokens.css and THE SYSTEM in styles.css; THE SCAN is the home world, ONE INK and GLASS must keep working and keep their
character (ONE INK is a printed page: no glow, no tilt-light; the ribbon there is a line of type under the masthead).

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited (a change that needs one goes under NEEDS HIS WORD in the report): apps/edge/src/agent.ts, apps/edge/src/index.ts,
apps/edge/src/tools/{index,types,repo}.ts, .github/* (except adding the one spec word at the END of check.yml's `all=` list, which is
established practice; the guard job untouched), apps/*/package.json.

## What is built

1. **THE READOUT RIBBON on Home (THE SCAN).** One mono line, in the Scan's marks, between the stamp line and the orb: the time · the weather now
   and the next rain hour (from the Brief's own weather read, never a new fetch on the first screen: read what is cached; "—" until it is) ·
   the next thing (the agenda's thing of the hour, the same source Home's callout reads) · the threat level (the threats feature's own word:
   CALM / WATCH / WARNING as it already decides for NEAR HOME; nothing new computed) · what he is doing right now (the live dots' source in
   shell/areas.ts: "studying algebra", "training", "watching the city", or "idle"). Each part a `span.g-truth`, separated by the system's dot,
   wrapping to two lines at 390, never cut. It updates once a minute and when a source changes, with no new requests of its own. In ONE INK it is
   the same line set in the serif under the masthead; in GLASS it is absent (GLASS is yesterday's look and stays pixel-equal).
2. **HOLOGRAPHIC DEPTH (the tilt).** On the phone, with the owner's permission (iOS asks on the first tap: a small PERMIT key in Settings, THE
   LOOK, "The HUD tilts with the phone", default off; a tap asks the phone and remembers the answer; off is one tap), the Scan's layers shift
   with the phone's tilt: the world a little, the plates less, the orb least, at most 6 px, eased, at the display's rate (requestAnimationFrame;
   no timers). A light sweep follows the touch across a plate (one radial token colour from tokens.css, no new hex: the ratchet ceiling holds).
   Off by default; nothing moves until he permits. Reduced motion (prefers-reduced-motion) disables both. ONE INK never tilts.
3. **THE ORB REACTING.** The orb (Mind / the reactor on Home) draws a thread of light to the room in use when the plan opens (a thin line from
   the orb to the lit room's row, the system's accent, 300 ms, gone when the plan folds); a pulse while he thinks (the turn's "thinking" state
   the session already exposes: the orb's glow breathes at 0.8 Hz until the first word); the owner's voice as a waveform in the orb while the
   mic is open (the same audio features the voice-known courtesy reads: amplitude only, drawn as a ring of 32 bars, nothing stored). On the 2-D
   stand-in orb (where Mind cannot run) the pulse and the ring are drawn in 2-D; the thread is the same.
4. **THE LIGHT FOLLOWING THE DAY.** One variable `--g-day` (0 at night, 1 at noon, from the hour alone, never from GPS) set on `:root` once a
   minute; the Scan's ground, the plates' glow and the orb's brightness read it (bright and cool in the morning, dim and warm after five),
   through the existing tokens only (a mix of two token colours, no new hex). ONE INK's paper warms slightly after five; GLASS unchanged. The
   stage's existing `data-hour` day/night stays as the coarse switch; `--g-day` is the fine one.
5. **SPOKEN ACKNOWLEDGEMENTS.** For a tap that starts work that will take more than a beat (TRAIN NOW, RUN NOW, a pack's download, PUBLISH, a
   course's "teach me", SIT, STUDY ALL, WATCH), one word or two in his voice through assistant/voice.ts speak(): "On it." / "Downloading." /
   "Sitting it now." — from a small table in one file, chosen by the action, never a model; only when the voice is on in Settings and the
   phone is not muted; never twice for one tap; never over a reply being spoken (speak's own queue decides). Settings, VOICE gets one row,
   "A word when I start something" (default on).

## What must not change

The first-screen budget (speed2: 1,000 ms at 150 ms a request, median of five; the ribbon reads caches only and is drawn after the hero
hand-over, never on the first frame); every other budget; GLASS pixel-equal (the look spec's Glass checks); ONE INK's printed page (no glow,
no tilt, no light sweep); every control 44 pt; nothing sideways at 440 × 956 or 390 × 844; the finding rule; the ratchet ceiling
(hex 506, rgba 1016, radiusPx 470, total 1992: equal or lower); the prompt guard; no new key, nothing that costs money, no model named;
accessibility: the ribbon is one `aria-live="off"` line (it must not be read out every minute), the thread and sweep are decorative
(`aria-hidden`), reduced motion disables the tilt, the sweep, the pulse and the thread.

## Tests (each fails on the code before this brief; run against it once and say so)

- tests/octideas.spec.mjs (new; `all=` word `octideas` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390:
  (a) the ribbon is drawn on Home in THE SCAN under the stamp, five parts, none cut, within the screen, not on the first frame (absent at the
  hero hand-over's first frame, present within 3 s), absent in GLASS, present in ONE INK as serif type; (b) with the tilt permitted (the spec sets
  the stored permission and dispatches synthetic deviceorientation events) the world layer's transform changes by at most 6 px and returns;
  with prefers-reduced-motion nothing moves; in ONE INK nothing moves; (c) the plan open draws the thread (an element with the thread's class,
  from the orb's box to the lit row's box); the thinking state breathes the orb (its glow variable changes over 1.5 s); a fake mic amplitude
  feed draws the 32-bar ring; (d) `--g-day` is set and differs between a 10:00 and a 22:00 clock (the spec sets the clock as speed2 does), and
  the ground token mix differs; (e) a TRAIN NOW tap with the voice on calls speak once with a word from the table (the spec's fake speaker,
  tests/fixtures/, counts calls), twice-tapped once, with the row off never.
- speed2.spec unchanged (the budget is the test). look.spec unchanged (Glass pixel-equal is its proof). ink.spec unchanged.
- apps/edge: no brain change expected; if a word of the ribbon needs the brain, it is NEEDS HIS WORD, not built.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8811:
`(nohup setsid node tests/preview-server.mjs 8811 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8811.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the repo ROOT of this worktree: `BASE=http://localhost:8811 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is never committed. In the foreground, alone, one after another: octideas, speed2, look, ink,
thescan, ui, layout, nav, settings, talk, voice. Brain tests in the background (`cd apps/edge && PATH=$PWD/node_modules/.bin:$PATH npm test`,
about 10 min) once, at the end. A timing budget missed under load is rerun alone before it is called red. Known sandbox reds not touched:
direct, aim, radio, scroll, safari, eye's own screenshot, tabs2, talk's cooling lines, look's "[390]/[440] at BODY 21 the Theme page cuts words".

## The owner's phone check

1. Home in THE SCAN: under the stamp, one line: the time, the weather and the next rain hour, your next thing, the threat word, what he is doing.
   It changes within a minute of something changing.
2. Settings, THE LOOK, "The HUD tilts with the phone": PERMIT, allow the phone's prompt, go to Home and tilt the phone: the world shifts a few
   pixels, the plates less, the orb least; drag a finger across a plate: a light follows it. Switch it off: still.
3. Open the plan: a thread of light from the orb to the room you are in. Ask something: the orb breathes until the first word. Hold the mic
   and speak: your voice as a ring of bars in the orb.
4. Compare Home at noon and after five: cooler and brighter, then dimmer and warmer. ONE INK's paper is a little warmer in the evening.
5. Tap TRAIN NOW (or a pack's download): "On it." in his voice, once. Settings, VOICE, the row off: silence.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/octideas-report.md: what was built, each spec's last line
(before and after for the new one), what was found and not fixed, NEEDS HIS WORD, the phone check as above, the commit list. One commit per
step on builder/octideas; the orchestrator squashes to one on landing.
