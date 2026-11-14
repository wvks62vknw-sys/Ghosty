# THE APPS ROUND: COMIC (flagship: PAINT)

## What I built

**PAINT, a real painting app (MAKE → PAINT, or say "open paint", "I want to draw", "colouring page")**

Ghosty had nowhere to draw. Now it has a painting app of its own.

- **Six brushes**, each with a sample stroke in the brush library:
  - **Pencil**: grainy, and tilting the Apple Pencil shades wider and lighter.
  - **Ink**: swells with pressure and tapers at both ends.
  - **Marker**: even colour, darker where strokes cross.
  - **Watercolour**: soft washes with a darker rim where they dry.
  - **Oils**: thick paint with bristle streaks that pulls the colour under it along.
  - **Airbrush**: a soft spray that builds up.
  - Also an **eraser** and **liquify** (push, twirl, pinch, expand).
  - Each brush has its own settings (streamline, size and opacity from pressure, taper), kept on this phone.
- **Apple Pencil and finger.**
  - The pencil gives pressure and tilt, with a soft, even or firm pressure curve.
  - A finger gets pressure read from its speed, plus smoothing and a stabiliser (the line trails on a string).
  - Once the pencil has touched the glass, a resting palm never draws.
  - Two fingers pinch to zoom and turn. A two-finger tap undoes, a three-finger tap redoes. A keyboard works too.
- **Layers** (up to 12):
  - sixteen blend modes, opacity, alpha lock and a clipping mask (kept in the PSD too);
  - a mask (the brush hides, the eraser brings back);
  - a reference layer, so the fill bucket stops at its lines;
  - new, duplicate, up, down, merge down, clear, delete and rename;
  - **ADD A PICTURE** puts one of your pictures on its own layer to trace over.
- **Shapes and selection**:
  - **SELECT** draws round a part, freehand or as a rectangle, or takes an area of one colour with a tap (**BY COLOUR**). Brushes and fills then stay inside it, and it can be inverted or cleared inside.
  - **TEXT** (in MORE) puts your words on the painting in one of four faces: lettering, book, handwriting or typewriter.
  - **MOVE** moves, scales, turns and flips a layer or the selection.
  - **Symmetry**: two, four or six ways.
  - **QuickShape**: hold still at the end of a stroke and it snaps to a clean line, circle, oval, box or triangle.
- **Undo and redo** for every step. Only the part of the picture a step changed is kept.
- **The time-lapse.** Every step is recorded, so MORE → **PLAY** (or **TIME-LAPSE** on its gallery card) shows the painting being made, and **SAVE AS VIDEO** keeps it (MP4 on the iPhone).
- **Files**:
  - Save as PNG, JPEG, a **layered PSD** (Photoshop, Procreate, Affinity and Photopea open it with every layer apart) or **OpenRaster** (Krita, GIMP). Or share it.
  - **OPEN A FILE** opens a PSD or an OpenRaster file with its layers apart, or a picture.
- **The gallery**:
  - Kept on this phone as you go, with search.
  - The first visit makes a sample painting and shows a three-step tour, so it is never an empty screen.
  - Each time you leave a painting you changed, a **version** is kept. Deletes wait in **Recently deleted** for 30 days.
- **Colouring pages**:
  - Four pages of line art drawn by the app itself (a mandala, a flower garden, a starry night, a fish bowl), or **FROM MY PHOTO**: your photo turned into outlines on this phone.
  - The lines sit on a locked reference layer, so FILL fills between them.
- **Ghosty inside**:
  - In COLOUR, **ASK GHOSTY FOR A PALETTE** suggests six colours for a mood. They are only a suggestion: KEEP THESE or NO THANKS.
- **Settings and help**: the pressure curve, smoothing, stabiliser, palm rejection, QuickShape, the two-finger taps and a soft click.
- **Its own front door**: its tab, a hub card, the EDITORS pill, the catalogue, its chat words and a WHAT'S NEW line.
- **Built with the App Kit**: the gallery uses the kit's skeleton rows while it opens, and its state cards for no paintings, a search with no match (CLEAR SEARCH) and an error (TRY AGAIN). The studio keeps its notices in one calm line.

**The Comic, with PAINT inside it**
- **Draw on it**: tap a panel, then DRAW ON IT. PAINT's studio opens over the panel's art. Your ink sits on its own layer, under the balloons, and is kept inside the comic.
- **Make it comic art**: a photo behind a panel becomes inked comic art in one tap (flat bold colours, black outlines). UNDO puts the photo back.
- **Angled gutters**: lean a page's gutters for an action page. Side-by-side panels keep an even gutter, and the page's edges stay straight.
- **Two more balloons**:
  - a voice down a **phone or radio** (an electric edge and a lightning tail);
  - a **robot** (clipped corners, typewriter letters).
  - Ghosty's script can ask for either.
- **ComicInfo.xml is read on import**:
  - It gives the series, issue and title, who wrote and drew it, the year and the summary, shown on the shelf.
  - A manga opens right to left.

**Drawing a day draws in PAINT**
- Coach → DRAW → **DRAW IT HERE** opens the studio on today's prompt.
- What you draw goes beside the prompt, counts for the day, and stays in PAINT's gallery with its time-lapse.

## How to try it on your phone
1. MAKE → EDITORS → **PAINT**. Open the sample, then MORE → **PLAY** to watch it being painted.
2. Tap **NEW PAINTING**. Draw with the Apple Pencil, pressing harder and softer. Pinch to zoom, and use a two-finger tap to undo.
3. Draw a wobbly circle and hold still at the end: it snaps clean.
4. Open **LAYERS**: add one, set it to Multiply, and try ALPHA LOCK. Then MORE → **PSD WITH LAYERS** and open it in Procreate or Photopea.
5. In **COLOURING**, pick the mandala, tap **FILL**, and tap between the lines.
6. In COMIC → Make, tap a panel, then **DRAW ON IT**. Also try **ANGLED GUTTERS**.

## Checks
- **paint** (new spec word, about 75 s in my container, 164 checks) covers the real app at 440 and 390:
  - the sample and the tour;
  - a stroke, UNDO, REDO and the two-finger undo;
  - pencil pressure making a wider line, and the palm rejected after the pencil;
  - QuickShape, symmetry, brush settings, freehand, rectangle and by-colour selection, text, twirl, layers, blend mode and alpha lock;
  - Ghosty's palette, the time-lapse, and a PSD and an OpenRaster file saved and opened again with their layers;
  - a colouring page's fill, the bin, and the gallery's search;
  - the Comic's DRAW ON IT, its two new balloons, angled gutters and comic art from a photo;
  - Drawing a day;
  - every key at 44 pt and nothing sideways, at BODY 21 and in all seven looks.
- **comic2** and **comic3** pass. comic2 now reads a CBZ's ComicInfo.xml.
- **The brain's paint test**, run from finding.test, covers:
  - brushes, pressure and tilt, smoothing, dab spacing and symmetry;
  - QuickShape's five shapes, and a scribble left alone;
  - the fill stopping at lines, the wand's traced outline, photo outlines and comic art;
  - the PSD writer and reader, with PackBits.
- **The comic test** also covers ComicInfo.xml, the new balloons and the angled gutters.
- **The full brain suite** passes (2,484 tests on the merged branch).
- On the merged branch, hubcards and awareness pass too. deck now fails only on the APP LIBRARY's and TRANSLATE's new screens (`apps` in Home, `translate`), which belong to those lanes.
- I updated other specs to the new truth: MAKE holds sixteen and the EDITORS pills end with PAINT (deck, hubcards, awareness, deckshots). The plan count is now 58 screens.

## What's left
- Smudge, as its own tool beside liquify.
- A Home card and a Brief line for PAINT.
- Paintings in the phone backup. They are pictures, so they are bigger than the scripts the backup carries now.
- **Comic**:
  - broken borders and inset panels;
  - lettering in his own handwriting;
  - a bigger art set (poses, props, vehicles, weather);
  - a filter that inks a whole page.
- **Your week as a comic**: photos and mood in the story, monthly editions, and a shelf of past weeks.
- **Not started** (the new family apps): Script Cut, Music Studio, Podcasts, Voice Memos, PhotoScan.
