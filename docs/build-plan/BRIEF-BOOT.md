# The boot cinematic, built (24 Oct; his words: "really cinematic and cool", "forget giving facts", "it's not an arc reactor anymore")

Mock-up to start from: `mockups/boot/contact.png` (the six frames; keep the timing discipline and the Reduce Motion and
warm-return rules), but change what is drawn: NO status readouts, NO reactor. The centre of Ghosty is **MIND**: the
hologram of his mind (Home's hero, OWNER-ISSUES 27; `apps/web/src/features/core/index.ts` draws it with three.js from
the site: the sphere, the constellation of what he knows, the equator scale). The boot is MIND waking up.

## The sequence (about 3.5 s, skippable with a tap, once per cold open of the day; a 400 ms pulse on a warm return)
1. Black. A single point of light, far away, breathing once (0–400 ms).
2. It splits into a drift of particles that gather into the constellation: lines link as they settle (400–1,400 ms),
   a slow camera push-in; a thin sweep of light passes through them once.
3. The sphere resolves around the constellation and turns a few degrees; the equator scale lights (1,400–2,200 ms).
4. The name assembles from the particles: G H O S T Y, letter-spaced in the instrument face, then it holds (2,200–2,800 ms).
5. The greeting, one line only, personal: "Good evening, <name>." (his name from Settings; spoken in his voice on the
   first tap if iOS blocks speech on a cold open; silent otherwise), no readouts, no numbers (2,800–3,200 ms).
6. The sphere eases up into Home's hero where MIND already lives, the HUD assembles around it (ribbon, tab bar, hub
   cards slide into place), done (3,200–3,500 ms). The transition must land exactly on Home's real MIND, not a copy.
Sound: a low hum rising to a soft chord, synthesised with WebAudio (no files), only when his voice setting is on and
never on a warm return; nothing if the phone is in silent mode cannot be detected, so keep it quiet.
Motion: 120 Hz, GPU-friendly (transforms and opacity; the particles in canvas or three.js, reusing MIND's renderer so
nothing loads twice); `prefers-reduced-motion`: the frames fade without movement; on a slow device (first frame late)
the cinematic shortens itself rather than stutter.

## How
`apps/web/src/shell/boot.ts` (new) plays it over today's loading without delaying it (the app keeps booting
underneath; the cinematic ends when both are done, never later than 3.5 s after the first frame); `index.html` and
`main.ts` call it; CSS in `styles.css` (its own block); the first-open-of-the-day rule and "reboot" (a command and a
line in SYSTEM: REBOOT HIM, which replays it); a check in `tests/boot.spec.mjs` (frames in order, the skip, the warm
return, Reduce Motion, lands on Home's MIND) that fails on the old code. No new packages; no assets; nothing
downloaded; 44 pt targets; the current boot's engine lines and "INITIALISING…" go.

## Finish
Commit per step (no push, no merge). Report: a strip of the frames as screenshots at 440 × 956, the timings measured,
every check's result, what only the real phone can prove (120 Hz, speech on a cold open, the hum on silent).

## Boot 2 (25 Oct; his words: "i want the cinematic to be on every boot up and just a bit cooler like we're so close but it could still be so much better")
Every cold open plays it (a launch from the Home Screen, a fresh tab, a reload: a new page); the once-a-day rule is
gone. Coming back to the running app (a tab switch, the app resumed in the same page life, a page restored from the
back-forward cache) and a deep link play only the breath; "reboot" replays it. The same idea, a richer cut, 3.9 s:
1. True black. One point of light, far away, breathing once (0–450 ms).
2. It splits; the particles gather into the constellation, each leaving a faint trail that fades; the camera pushes in
   slowly through three depths (far dust behind, the constellation, a few near motes streaming past the edges), so the
   push reads as 3-D; one thin sweep of light passes down through it and refracts at the equator: a flare along it
   and a second, bent ring parting below (450–1,500 ms).
3. The sphere resolves from the inside out: the haze, the meridians catching the light one after another, the
   latitudes, the rim last; the equator scale lights round (1,500–2,400 ms).
4. G H O S T Y from particles, a little wide, then one last tightening; a single thin line draws itself under it from
   the middle out, the instruments' own light (svg.inst .fl with .ln end stops) (2,400–3,050 ms).
5. The greeting with a breath of bloom, spoken in his voice as before (3,050–3,500 ms).
6. Mind flies into Home's hero (to the pixel, the same canvas); a beat after it lands, the ribbon, the tab bar and
   Home's cards slide in, not with it (3,500–3,900 ms).
Every frame is held to a budget (a long frame: over 12 ms at 120 Hz, over 20 ms at 60), counted in
`__bootState.budget`; a phone that cannot keep up gets the short version, or mid-flight the lean cut (no depths,
trails or refraction; the rest quickened). Sound unchanged. No text but GHOSTY and the greeting.
