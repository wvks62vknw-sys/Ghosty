# The boot, shot by shot (7 Nov; BRIEF-ORB-AND-BOOT, run one: the storyboard)

His words (OWNER-ISSUES 142): "i still want that old glowing hologram orb … if you can make it a little better, along with the
cinematic btw which can be a lot lot lot better". This folder is the new boot drawn shot by shot before it is built: ten frames
at 440 × 956 (2×), the five states of the orb, and a contact sheet. The orb in every frame is the real hologram
(`apps/web/src/features/core/mind.ts`, ported line for line to `orb.js`) drawn with the app's own vendored three.js in headless
Chromium, the way the hero mock-ups were; the floor is the world's from the tokens; every mark is the design system's
(`apps/web/src/design/tokens.css`, `apps/web/src/ui/machine.ts`). Nothing on screen is decoration: the README says what is true
in each shot and where that truth comes from.

| File | What |
| --- | --- |
| `contact.png` | the sheet: the eight shots in order, then The Map and Paper |
| `shot-1.png` … `shot-8.png` | the eight shots on Reactor · Graphite · The Scan |
| `extra-map.png` | The Map: the grid drawn line by line and the crosshair finding centre |
| `extra-paper.png` | Paper: the recognition, on the night ground (see below) |
| `states.png` | the orb's five states, five stills from one live orb |
| `render.mjs` · `frame.html` · `boot.css` · `orb.js` · `cut.js` | how they were made (below) |

## The cut: the time of each shot, in ms from the first frame

The whole: **2,880 ms to a usable Home** (the cinematic over, taps reach Home); the HUD slides in a beat (110 ms) after the
landing and is settled at 3,290. Today's boot is 3,900.

| Shot | Beat starts | Photographed at | What is on screen | Where the truth comes from |
| --- | ---: | ---: | --- | --- |
| 1 | 0 | 160 | **The ground**, nothing else, one breath: the room's light breathing in where the orb will be. | The ground is his recipe's, set on `<html>` before the first frame (`data-ground`; under Paper the night ground, `data-night`). The light is `state/theme.ts`'s `--room`: the accent at .09 × the colour's glow × the world's glow, so GLOW off and One Ink show the bare ground. |
| 2 | 240 | 420 | **The floor forms**: The Scan's field of points sampled in from the top-left corner, the sampling front a step brighter, over 400 ms. | The points are the world's floor, `--g-floor-mask` (16 px, r 1.1) at `--g-floor-a` (.14) in `--g-room-points-rgb`: what every screen stands on after the boot, drawn as it arrives. The other worlds: The Map's grid line by line and the crosshair finding centre (`extra-map.png`); The Eye's grain settling and one box; One Ink's one rule drawn; Glass's blur clearing. |
| 3 | 560 | 900 | **The orb forms from his library's points**: they drift out of the point of light and gather into the constellation, each leaving a short trail; the sweep passes down through them and refracts at the equator; the camera pushes in (1.45× to 1). | Today's gather, kept (`mind.ts` `gathered()`, `BootLook.gather/trails/sweep/refract`). One node per 20 passages, lit when that share of its field has been read (`plan()`): the numbers saved on this phone from the last visit (`ghosty.mind.data`), today's sample 4,186 passages → 209 nodes, 66 lit, 8 fields. The sphere has not resolved yet. |
| 4 | 1,240 | 1,560 | **The stamp line types itself** in mono with a block cursor; behind it the sphere resolves from the inside out (the haze, the meridians catching the light one after another, the rim last, the equator scale lighting round from the front). | `ui/machine.ts` `stampWords()`: the day and the time from the clock, his saved home (never his live position), and the feeds' real state: CHECKING FEEDS while they are still being asked (`watching == null`). Typed at 10 ms a character (three times the brain's pace, `TYPE_MS` 33), 460 ms for the line. |
| 5 | 1,700 | 2,060 | **The feeds answer**, one truth line each as they connect, one lock-length (160 ms) apart; when the third has answered the stamp's last segment becomes WATCHING 3 FEEDS. | The guardian's three feeds (`packages/shared/src/guardian.ts` `FEED_NAMES`): FLOOD · ENVIRONMENT AGENCY · NOTHING ACTIVE; WEATHER · MET OFFICE · NO WARNINGS; CRIME · POLICE.UK · SEP · 14 WITHIN A MILE (police.uk publishes a month's count about two months behind: a count, never a forecast). Only a feed that really answered gets a line (`info.checked[f]` and not `info.failed[f]`, as `feedsWatched()` counts them). Offline: no lines, and the stamp says OFFLINE, FEEDS PAUSED (`stampWords`' own string). |
| 6 | 2,180 | 2,440 | **The recognition**: the reticle snaps onto the orb from 14 px wider, closing on it over the lock's 160 ms in the accent, with one short tone; G H O S T Y under it. The feeds' lines have gone: the stamp holds their truth. | `ui/machine.ts` `recognise()`: the lock's duration and curve from the tokens (`--g-dur-lock`, `--g-ease-lock`), the box the `.g-lock` frame in `attend` state, the tone from `assistant/sfx.ts` on top of his sound setting (tone / click / off) and the phone's rule (iOS keeps a cold open silent until a tap), scheduled on the audio clock. The name is a reading at size (`--g-t-value`), spaced .5 em as today's boot spaces it. |
| 7 | 2,460 | 2,600 | **The greeting**, his line, under the stamp where Home's first line lives; the box and the name still on the orb. | `shell/boot.ts` `greetingLine()`: the part of the day from the clock, the name from Settings (Boss when there is none). Spoken in his voice now if the phone allows sound, else on the first tap; once (the talk rules). |
| 8 | 2,640 | 3,060 | **Home**: the orb eases up into Home's hero over 240 ms (the same Mind, never a copy); the box and the name go as it lifts; the HUD slides up a beat after it lands. | The landing is on Home's real hero box (`boot.ts` `heroRect()`), the canvas handed to the hero (`mind.bootEnd()`). The stamp line stays as Home's own and gains LOOKING AT HOME (its fifth segment, the thing in focus). The HUD here is the plan of the house and the ask line, drawn in the system's marks: the shell pass's Home. |

A tap, at any moment, skips straight to shot 8's end: Home with the HUD, the Mind landed (`boot.ts` `skip()`); a small TAP TO SKIP
in `--g-t-fine` is shown from the orb's first light until the recognition, so the skip is never a thing he cannot find.

## Reduce Motion: the two-frame version (1,200 ms, nothing travels)

Frame A (0–600): the ground with the floor whole, the orb whole (one still, as `mind.ts` draws it under Reduce Motion), the
stamp line whole with no cursor, the feeds' lines whole as they are known at that moment. Frame B (600–1,200): the box on the
orb where it lands with no travel (the tone still plays once if his sounds are on: a sound, not a motion), G H O S T Y, the
greeting under the stamp. Then Home: the orb appears in the hero with no flight; the two frames fade (200 ms each), as today's
`STILL` cut fades. `data-motion="calm"` (the MOTION switch) plays the same two frames.

## The frame budget plan (today's kinds kept)

`shell/boot.ts` keeps its six kinds and its budget (`__bootState.budget`: the display's rate, long frames, the gaps, the work per
frame, where it leaned); only the timelines change to the cut above.

| Kind | When | What plays |
| --- | --- | --- |
| `full` | the phone keeps up (Mind drawing by 900 ms, no stutter in the ground's breath) | everything above, 2,880 ms |
| `short` | a slow phone or a late Mind (by 1,700 ms), or TV MODE | the floor and the orb fade in whole (no gather, trails, sweep or push-in); the stamp, the feeds and the recognition kept; about 2,200 ms |
| `still` | Reduce Motion, or MOTION calm | the two frames above, 1,200 ms |
| `flat` | no WebGL at all (`reactor.ts`'s 2-D fallback) | the ground, the floor, the stamp, the feeds, the box snapping onto the 2-D fallback's spot, the greeting; about 1,700 ms |
| `warm` | a resume, a deep link, a notification | no cinematic: Mind's light breathes out once (400 ms; 150 under Reduce Motion) |
| `quiet` | an automated check that did not ask for it | nothing |
| the lean cut | mid-flight, a quarter of the recent frames long | the full cut drops the trails and the refraction and quickens, as today |

## The five states (`states.png`)

Five stills from one live orb (one WebGL context, drawn five times into plain canvases), each one visible change,
`mind.ts` `TARGET`'s numbers taken whole as Reduce Motion takes them:

| State | The visible change | Numbers |
| --- | --- | --- |
| idle | turns once in about 70 s and breathes 6 %; four slow pulses on the lit links | `TARGET.idle` |
| listening | opens 8 %, the rim 1.6× brighter; a pale ring round it grows with his voice | `TARGET.listening` (the ring: `P.ear`, from the microphone level) |
| attending | holds nearly still (the turn to a third of idle's) and brightens its core; the reticle in the accent is on the thing | NEW: `{ open .2, rim 1.2, bright 1.1, spin .03, pulses 6, pace .3 }`, set when `recognise()` lands (`marksState.locks`) |
| thinking | thirty-six fast pulses run along the links and it turns twice as fast | `TARGET.thinking` (today's "many pulses") |
| saying | opens half way and brightens; ten pulses keep time with the words while it speaks | `TARGET.speaking` |

## The orb, a little better (what `orb.js` changes from `mind.ts`, each marked BETTER in the file)

1. **Sharper where it is sharp.** The nodes themselves (the unlit ones and the lit ones' cores) are drawn with a crisp point
   texture (a hard edge with one pixel of feather) instead of the soft glow texture, so a node is a point and its halo is the
   only soft thing; the crisp rim's Fresnel is a little tighter (power 9, not 7), so the sphere's edge reads as one line. The
   meridians, latitudes, the equator and its ticks were hairlines already and stay so.
2. **Lit in his colour from the tokens.** Every colour is read from `--g-accent-rgb` and `--g-accent-pale-rgb` on `<html>` and
   tinted from them (the near-white of the unlit nodes included), never a constant: `mind.ts` already reads `--c`/`--c2`, which
   `theme.ts` writes from the same block, so this is the same light named by its token.
3. **The glow follows the world.** The halos (`h2`, `h3`, the lit nodes' haloes) are scaled by `--g-glow × --g-room-glow`,
   which is what `glowNow()` returns in `theme.ts`: GLOW off and One Ink leave the orb its crisp parts and no haze round them.
   (`--g-accent-glow`, a colour's own glow strength, is used by the room's light but not by the orb's halo today; see the
   questions.)

Not changed: the constellation's shape and seed, the plan of nodes, the states' numbers, the boot's `BootLook` and the gather,
the one-context rule, the 30/60 fps habit and the still frame under Reduce Motion and heavy mode. The frame budget is measured
in run two, before and after, on the preview's stand-in GPU.

## Paper boots on the night ground

`extra-paper.png` is the recognition under Paper and it looks like shot 6 on purpose: the boot lands on Home, a room still drawn
light on dark until the shell pass, so under Paper it plays on his **night ground** (`data-night`, Graphite by default, or the
Black, Slate or Warm he chose) in his colour, and Home lands on it too; the Paper row in Settings → Theme says so, and
`bootState.recipe` records `{ ground: 'paper', night: 'graphite', floor: the night canvas }`. The boot's layer carries the night
ground's tokens and the theme's accent block (`data-ground` and `data-accent` on the layer, as a swatch does in tokens.css), so
its marks are the night ground's and the orb is the theme's own colour, which is what `theme.ts` writes to `--c` whatever the
ground. When the shell pass redraws Home on Paper, the boot follows it onto paper: a floor in dark points, the marks in ink, no
glow (`--g-glow-floor` 0), the orb in the accent's ink.

## How they were made

`node docs/build-plan/mockups/boot/2026-11-07/render.mjs shot 4` (one shot), `extra map`, `extra paper`, `states`, `contact`;
`at 1800` photographs any moment. A tiny static server serves the worktree; Playwright's bundled Chromium with software WebGL
(`--use-angle=swiftshader`) opens `frame.html?shot=N`, which draws one moment (`cut.js` holds the cut; `orb.js` the hologram) and
sets `__frameReady`; the frame is photographed at 2×. Stand-in fonts from `../../fonts.css` (Inter for SF Pro; the mono stack
falls to JetBrains Mono on this machine; SF Mono on the phone is a little narrower). One frame takes about two seconds here.
Nothing in this folder ships; run two builds the cut into `shell/boot.ts` and re-cuts `tests/boot.spec.mjs` to it.

## Questions for the owner (the recommendation first in each)

1. The stamp line at 440 wraps to two lines ("SAT 7 NOV · 21:08 · BIRMINGHAM · / WATCHING 3 FEEDS"), as the real component wraps,
   whole segments, ending on the dot. I recommend leaving it: the shell pass can shorten the day to "SAT 7" if two lines are
   too many at the top of Home.
2. The feeds' three lines leave at the recognition (the stamp keeps WATCHING 3 FEEDS). I recommend that; the other way is to keep
   them on Home under the hero as its truth lines.
3. TAP TO SKIP is shown small from the orb's first light to the recognition, so the skip is findable. I recommend keeping it;
   today's boot says nothing and a tap still skips.
4. The stamp types at 10 ms a character (three times the brain's pace), so the line lands in 460 ms. I recommend it; at the
   brain's own 33 ms the line alone would take 1.5 s.
5. Attending: the orb holds nearly still and brightens its core while the box is on the thing. If he would rather it turned
   towards the thing, that needs the line of sight's angle from the hero: a day more.
6. Mono's own glow (`--g-accent-glow` .25) dims the room's light but not the orb's halo today. I recommend the orb follow it too
   (one multiply in `mind.ts`), so Mono's orb is as quiet as its room.
