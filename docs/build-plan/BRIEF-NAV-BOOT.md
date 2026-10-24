# Navigation that does not scroll for ever, and a boot cinematic — mock-ups for the owner's yes (24 Oct)

His words (OWNER-ISSUES 43): "too much things in one tab so you have to scroll loads but there should be different like
tabs for all of it but not overstimulating, and easy to navigate too"; "a cinematic when he's booted up because the
current one is terrible"; "super powerful"; "shouldn't feel like it's made by an AI".

## 1. Navigation (one sheet at 440 × 956, in the A-with-C look of BRIEF-IRON-BUILD.md)
- The five areas stay (Ask, See, Make, Learn, Plan). Each area's hub becomes a **compact instrument grid that fits one
  screen without scrolling** (two columns, at most six cards, each an instrument with two readouts and one line), and
  **every tool is its own screen** (full height, its own title, back to the hub), so no hub page is long.
- Show: the Learn hub (today the longest: GYM, courses, School, library, YouTube), one tool screen (the GYM), the way
  between them (the back, the title, the tab), and a **quick switcher**: a long press on a tab fans out its tools as
  a radial of instruments (optional; show it as one frame).
- Where a hub today has more than six tools, show how the rest are reached (a "more" row of small instruments, or a
  second page with a dot), without becoming overstimulating.
- Personal: the hub greets with his name and the time of day only once (the title), his city in the weather, his
  places by name, his school stage, his rating: nothing generic.

## 2. The boot cinematic (a storyboard of six frames at 440 × 956, plus the timing)
A cold open the first time each day (and on "reboot"), skippable with a tap, 2.5–3.5 seconds, 120 Hz, honest:
1. Black; the reactor's core ignites at the centre (0–400 ms).
2. Rings spin up around it; a thin scan line sweeps once (400–1,200 ms).
3. "GHOSTY" in the instrument face, then "online" (1,200–1,600 ms).
4. A status sweep in real figures, one line each, 200 ms apart: brain (which, and that it is ready), memory ("212
   things known"), library ("1,685 passages"), school (the stage), the day ("Friday 24 October · Birmingham · 14°").
5. His name: "Good evening, <name>." in his own voice if voice is on (the same line the Home title shows).
6. The HUD assembles: the ribbon, the tab bar, the hub cards slide into place; done.
A warm return (coming back within the day) is a 400 ms reactor pulse only. `prefers-reduced-motion`: the frames
appear without motion. No sound file: the voice line only; nothing downloaded.

## How
Static HTML under `docs/build-plan/mockups/nav/` (the hub, the tool screen, the switcher frame) and `mockups/boot/`
(six frames), screenshotted at 440 × 956 (scale 2) into `contact.png` each, on the tokens of `mockups/iron/tokens.css`.
Mock-ups only. Commit (no push). Report: the two PNG paths, a critic's score (Iron Man / calm / easy to navigate /
personal / honest) and the build cost of each.
