# FINAL ROUND · the SEE lane (13 Nov 2026)

What this lane covers: God's Eye, the Machine view, THREATS, the map, the cameras, the car and MEASURE. The Lens belongs to the LENS lane.

## What was wrong

**"Sometimes the layers on God's Eye can overlap the cameras."** You were right. I measured every case in all seven looks, at 440 and 390, with the house on and off.

- **On a 390 phone the camera grid covered the chips.** The CCTV grid of the four nearest cameras was taller than the gap between the chips and the readout. It rose up over the layer chips (Aircraft, Incidents, Radar) and over the layers button. This happened in every look with the house.
- **The layers sheet opened over a camera's card.** With a camera open, tapping the layers button laid "What to show" on top of the card. This happened in every look.
- **The LOOK menu opened over the card too.**
- **A camera's card hid its own picture.** On a 390 phone with the house on, the card's keys (PREV, NEXT, STREET VIEW, ASK GHOSTY, ✕) wrapped into three rows pinned at the card's foot. They filled the card and pushed the picture out of sight.
- **The card ran over the readout**, so scraps of the coordinates showed at its edge. The card and the open sheet also sat 4 points into the chips row.
- **Some keys were too small.** The card's keys were 40 points, not 44, and so was Glass's MACHINE VIEW key.

**The specialist pass found these elsewhere in the lane:**

- **Your live position could reach the brain**, which breaks your rule. It happened in four places:
  - ASK GHOSTY on the YOU card sent your exact coordinates.
  - During ROAD AHEAD, God's Eye's own description of itself sent the coordinates the globe was following.
  - The journey planner's "Here" sent your GPS. Typing "home" also sent your GPS, not your saved home.
  - The map's ROUTE HERE sent your GPS through the brain's proxy.
- **ROAD AHEAD claimed "Your position stays on this phone", but the feeds were asked about your exact spot every 8 seconds** while the globe followed you.
- **Dead keys:**
  - The zoom keys + and − did nothing on a tap. They worked only while held, and VoiceOver could not use them.
  - ROUTE HERE often routed to the middle of the map, not to the pin.
  - The ROAD AHEAD key stayed lit after its panel's STOP.
- **The map sheet:**
  - It stayed blank, with no words, when the map would not load, and it never tried again.
  - A route could read "1 h 60 min".
- **THREATS:**
  - It said "12 live signals · 12 signals".
  - It said "none in 48h", but the quake feed covers only 24 hours.
  - The ISS row's "tap to find it" only opened God's Eye.
  - A failed SAVE TO LIBRARY said "I couldn't look that up".
- **The Machine view's hub said "0 TRANSIT"** where there is no bus feed, while the view itself said "no live buses here".
- **MEASURE:**
  - One line ended with two full stops: "…in a moment.. Use a BANK CARD".
  - Its "working out distances… N s" counter never showed while the model loaded.
- **THE CAR:** leaving it with FIND IT ON THE CAR open left that window and its camera running.
- **Outside my lane, but it stopped my checks:** the notifications code crashed when the phone had no service worker, for example in a private window. Now it says "unsupported" instead.

## What I made

- **One measured band for God's Eye** (`features/eye/index.ts`, `reach()`).
  - Everything that floats over the globe lives in it: the card, the CCTV grid, the layers sheet, ROAD AHEAD and the zoom rail.
  - The band runs from the foot of whatever the top shows (the search, its note, the chips, your places) down to the sheet's keys, or down to the Machine view's line above them.
  - It is measured the way the house measures, each time anything changes size. There are no fixed offsets.
- **The CCTV grid fits the band.** It shows four cameras when they fit, else one row of two, else none (the cameras stay on the globe as dots).
- **One corner, one thing: the newest wins.**
  - A card that opens folds the layers sheet and closes LOOK.
  - Opening the sheet or LOOK hides the card until they fold. Then the card comes back as it was.
  - When the card reaches past the readout, the readout steps aside.
- **The card's keys are one row at its foot.** ASK GHOSTY and ✕ come first, and the rest scroll beside them, so a short card still shows the camera's picture. Every key on the card and the sheet is 44 points, in every look.
- **Your position stays on the phone.**
  - The YOU card and God's Eye's description carry no coordinates.
  - While ROAD AHEAD follows you, the feeds are asked only about the area around you, to the nearest 2 km, and the panel now says exactly that.
  - The journey planner's "Here" and the map's ROUTE HERE send only the square kilometre around you. **Decision:** a route from "Here" can start up to about half a kilometre away, and nothing finer ever leaves the phone.
  - "Home" now means your saved home.
- **The zoom keys** zoom one step on a tap, keep the smooth zoom while held, and are named for VoiceOver.
- **SHARE on a tapped spot.** It opens the phone's own share sheet with the spot's name, its coordinates and an OpenStreetMap link. Where there is no share sheet, it copies them.
- **Every defect listed above is fixed in its own file.** The Machine view's brain test now expects "NO LIVE BUSES".
- **A new spec, `tests/seelane.spec.mjs`, added as the last word of check.yml's `all=`.**
  - At 440 and 390, in all seven looks, it checks that the grid, the card, the layers sheet and LOOK never lie over one another, the chips or the keys.
  - It checks that a camera's picture shows in its card, and that ASK GHOSTY and ✕ are on top and can be pressed.
  - It checks that every key is 44 points and that nothing runs sideways.
  - It checks that a camera opened while LOOK is open closes LOOK.
  - It also checks the zoom keys on a tap, and that the brain's words carry no coordinates.

## How to try it on your phone

1. Open God's Eye, turn on CCTV cameras, and search "London". The camera grid sits under the chips. On the smaller phone it is one row of two.
2. Tap a camera. The card shows the picture, with ASK GHOSTY and ✕ first in its key row.
3. Tap the layers button. The card steps aside, and comes back when you fold the sheet.
4. Tap LOOK, then ask "show me the cameras on the Strand". LOOK closes and the camera's card opens.
5. Tap + once. It zooms in a step.
6. Tap the ground, then SHARE. The share sheet opens with the spot's map link.
7. In THREATS, tap the ISS row. God's Eye flies to where the station is now.

## What is left

- **The journey's map with no signal** (the offline pack, drawn in 3D) does not draw the journey's line yet, and its "look here on the map" steps do nothing there. Fixing it needs the map sheet to hand over the map once it exists, so I left it rather than half-do it.
- **The aircraft feed outside ROAD AHEAD** is still asked about the centre of the view. That is where you are looking, not where you are, so I kept it.
