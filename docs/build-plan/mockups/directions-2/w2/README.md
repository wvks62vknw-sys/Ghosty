# W2 · The Map — the Field, as the Machine sees it

**The idea in one sentence:** everything Ghosty can see and do is plotted on one map round the orb; pinch is altitude, a
typed word is a flight, and the Stage is simply the deepest zoom of the thing.

The seed was THE FIELD (BRIEF-DIRECTIONS-2); his reference (OWNER-ISSUES 137) made it the Machine's own map of what it watches:
a plotting grid with a crosshair every five squares, the six areas as districts with dashed borders, every ability a small
square on a crossing of the grid inside its district, and round the origin the square of nine: tonight's book, the three
recents, the four favourites and one free square. The orb stands over the origin on its altitude line. There are no screens
and no bar: the scale along the bottom (All · Areas · At hand · Inside) says how high he is and is itself the zoom; the
breadcrumb at the top of a deep zoom starts with the orb ("● › Plan › Tomorrow › The 7:42"), so Mind is the frame of every
place he goes, the way back is always the orb. At the deepest zoom a point is the thing itself: the Journey's point opens into
the streets of Birmingham with the walk and the train; the Library's point is the page. Semantic zoom decides what a thing
shows: far, a square; nearer, its name; near, its whole reading (the Learn district shows its three near things open and the
far four folded to a line). The tests: said without the banned words; no phone app looks like it (nearest: the watch's app
cloud, which is icons on a flat honeycomb, with no readings, no districts and no altitude); what moves is the camera, rising,
crossing and diving.

Files: `tokens.css`, `style.css`, `field.js` (the one fragment shader: the plane, the districts, the points, the square at
hand, the city at the deepest zoom, the Lens's measured table), `build.py`, the PNGs, `story-1..4`, `story.png`,
`contact.png`, `home-ember-*.png` (the theme proof).

## The finding rule

| What | Taps | How |
| --- | --- | --- |
| Tonight's thing, a recent, a favourite | 1 | They are the square of nine round the orb at Home's altitude; tap the square |
| Anything else (44 screens, about 150 abilities) | 2–3, or one typed word | Tap its district (1: the camera comes down over it), tap the point (2: it opens at its deepest zoom), a panel inside (3); or type a word: the camera rises, crosses and dives to it |
| Back | 1 | The orb at the head of the breadcrumb, or pinch out |

## What runs live on the phone, and what is a still

- One shared WebGL canvas: the plane is one cheap fragment shader (a grid, rectangles and squares: well under a millisecond a
  frame on an iPhone GPU; here 0.6 s in a software renderer); the names and readings are HTML placed by the same camera.
- Live: the camera (pinch, the flight), the orb, the readings on the near points (the hub cards' own `readouts()`).
- The street map at the deepest zoom needs a vector street source: the mock draws a crooked street grid round the real route;
  on the phone it would be OpenStreetMap's free street data for his city, fetched on his tap and kept (a few MB), about two
  days of work, said here because it is not free.
- Still: none. Reduce Motion cuts each flight to a cross-fade.

## Honest costs

- **The shell** (the map's layout model for every screen and ability, districts sized by count, the square at hand fed by
  recents and favourites, the camera with semantic zoom and the flight, the scale, the breadcrumb, the Stage as the deepest
  zoom, the street map): about **9 days**. The layout model is the real work: where each of 44 screens and 150 abilities sits,
  and that it stays where he learned it (a map must not move under him).
- **Migrating the other screens:** each screen becomes the deepest zoom of its point, keeping its content and taking the
  Machine's marks: about half a day each, pass by pass.

## Where it fails the five-second test

This is the weakest of the three. A stranger reads "a map" and the square round the orb at once, but not that the map is the
app: the districts' names are small and far, the plotted squares read as texture, and "pinch to rise" has to be discovered
(the scale at the bottom is the clue). It is clear and calm and the most practical of the three, but it looks more like a
diagram than a world: it has the Machine's precision and little of its presence.
