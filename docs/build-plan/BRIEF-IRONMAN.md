# Iron Man inside route C — mock-ups for the owner's pick (24 Oct, 20:00 UK, on his 18 Pro Max)

His words, looking at the live app on the phone (screenshot `mockups/owner-see-tab-24oct.png`, the See tab):
"i still think it could use some work in a lot of ways like small details i don't like the little tabs like these you
have to click on they could be way better on every tab and the gym pics could be better and there's a few scroll issues
which could be fixed and also i like the iphone look but i don't want it like too much like an iphone like i still wanna
feel like Iron Man this is nothing like that".

Standing rules that still hold: route C is the structure (the five floating tabs, large titles, one back style, one chat
entry); themes are colour variants (Reactor default, Graphite); NO app-icon tiles (OWNER-ISSUES 32); the deck is "H with
F's pictures and G's information and prompts" (34); everything free, 44 pt targets, plain words; the 18 Pro Max is
440 × 956 with 120 Hz.

## What to mock up (three directions, each a full contact sheet at 440 × 956, dark, and one at 1280 × 800)
Each direction must show the SAME five things so he can compare like with like:
1. **The tab hub cards** ("Tools" on See: God's eye, Lens; the same kind of cards on Ask, Make, Learn, Plan): not the
   plain grey iOS boxes in the screenshot. Think JARVIS / the arc-reactor HUD: thin glowing edges, a live instrument in
   each card (a tiny globe with live counts, the Lens's viewfinder scanline, the GYM's rating), the card's own data as
   readouts, depth and light, a breathing accent; still tappable as a whole, still a card, still not an app icon.
2. **The GYM's pictures**: the game cards' images (drawn, not photos: the board, the maze, the puzzle, rendered as
   holographic line-art with the theme's glow; his rating and the next level as instrument readouts).
3. **One full tab** (See) top to bottom, so the title, the ask bar, the hub cards and the floating tabs are seen together.
4. **The floating tab bar** in the same language (the lit tab, the live dot, the badge), still five tabs.
5. **A reply card in the chat** (so the HUD language reaches the conversation too).

The three directions:
- **A. Reactor HUD**: the arc-reactor blue-white glow, concentric rings, thin scan lines, data readouts in a mono face,
  the hologram feel of MIND carried into every card.
- **B. Stark workshop**: warmer metal and amber, bevelled glass, brushed edges, soft volumetric light; instruments as
  physical dials; fewer lines, more material.
- **C. Hologram minimal**: the iPhone calm he likes (space, large type) plus a holographic layer: translucent cards lit
  from behind, light sweeps on touch, the content itself glowing where it is live; the least decoration, the most light.

Each sheet is scored by an independent critic (a second pass of yourself, fresh) 1–10 on: feels like Iron Man / JARVIS,
still calm and premium, readable at a glance, no app icons, honest (every readout is something Ghosty really knows).

## How
A static HTML page per direction under `docs/build-plan/mockups/iron/<a|b|c>/` using the real `apps/web/styles.css`
tokens where possible (so a pick can be built as CSS + small DOM changes), screenshotted with Playwright at 440 × 956
(device scale 2) and 1280 × 800 into `docs/build-plan/mockups/iron/<a|b|c>/contact.png` and `-laptop.png`. Real data
in the readouts (today's numbers from the preview where they exist). No new packages, no external assets; SVG drawn by
hand or from the repo's own icon set. Do not touch the app's code: mock-ups only, for his pick.

## Finish
Commit the mock-ups (do not push). Report: the three sheets' paths, the critic's scores with one line each, and what
each direction would cost to build (files, hours) so his pick can start at once.
