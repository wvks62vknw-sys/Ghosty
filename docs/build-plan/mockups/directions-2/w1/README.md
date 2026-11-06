# W1 · The Scan — the Room, as the Machine keeps it

**The idea in one sentence:** the phone is a window into a 3-D scan of a room where everything Ghosty does has its place; tilt
it to look round, and whatever you ask for is brought to the front.

The seed was THE ROOM (BRIEF-DIRECTIONS-2). His reference, given while this round ran (OWNER-ISSUES 137: "person of interest
'The Machine' vibes … modern and clean not like AI slop"), bent it: the room is not lit like a film set, it is the Machine's own
record of a room. Every surface is sampled as points, every edge drawn in one hairline, and the orb floats in it as the eye and
its only light. Things he uses are marked the way Ghosty's Machine view already marks a thing (a reticle, a mono tag above, one
true line below): the window is God's eye with Birmingham outside it, the shelf is the Library, tonight's book lies open on the
desk, the calendar is the Agenda, the chessboard is the Gym, the notebook is Courses, the camera on the shelf is the Lens.
The six areas are the other rooms of the house, drawn along the bottom as the Machine draws a building: a plan with door gaps,
the room he is in lit. The Stage is the room's window brought to the front: the city outside resolves into a model of
Birmingham with the walk and the train drawn on it, and the orb sits on the frame's top edge as its keystone. The tests:
said without dark, glass, card, tab, list, minimal or clean; no phone app looks like it (nearest: a 3-D scanning app, which has
no tags, no house and no eye); what moves is the camera (tilt, walk to a thing, through the window) and the eye's light.

Files: `tokens.css` (every token with its job; Ember as the second block), `style.css`, `room.js` (the one fragment shader:
the room, the city, the Lens), `build.py` (writes the pages), the PNGs at 390 and 440, `story-1..4` and `story.png` (the
strip), `contact.png`, `home-ember-*.png` (the theme proof: the scan's lit points and the route turn orange with no other
change).

## The finding rule

| What | Taps | How |
| --- | --- | --- |
| Tonight's thing (Alice, page 42) | 1 | It lies open on the desk in the accent reticle; tap the callout: the book is brought to the front (the reader) |
| A recent (Library, God's eye, Brief) | 1 | Each is a marked thing in the room (shelf, window, the folded Brief on the desk); tap its reticle |
| A favourite (Lens, Agenda, Gym, Courses) | 1 | The same: the camera, the calendar, the chessboard, the notebook, starred |
| Anything else (44 screens, about 150 abilities) | 3, or one typed word | The plan: tap a room (1, the camera walks there), tap a thing in its inventory (2), a panel inside (3); or type a word in the ask line and the camera goes to the thing |

Recents and favourites are better than the rule (one tap, not two) because they are things in the room he is in.

## What runs live on the phone, and what is a still

- One shared WebGL canvas behind the type. In this mock the room is raymarched in a fragment shader (3–7 s a frame in a
  software renderer); on the phone the room would be a **point cloud baked once** (about 200,000 points from the same room
  description, about 2 MB, made on first run) drawn as GL points: cheap at 60 fps on an iPhone, and true parallax from the
  gyroscope (DeviceOrientation, behind the permission iOS asks for once).
- Live: the camera (tilt, the walk to a room, the move through the window), the orb (the shared Mind shader, idle 30 fps),
  the type and reticles (HTML, projected with the same camera each frame).
- Still: nothing needs to be a picture; with Reduce Motion on, the camera cuts instead of moving and the tilt is off.
- Honest cost on the battery: a 3-D canvas on Home all evening. It draws on demand (when the camera, the orb's state or a
  tag changes), not every frame, and stops when the page is hidden.

## Honest costs

- **The shell** (Home's room, the six area rooms as scans, the plan along the bottom, the camera and its moves, the projected
  reticle-and-tag layer, the Stage as the window with the city model built from the journey planner's legs, the ask line and
  jump, the switcher as the plan): about **12 days**. The room models are the new work (six rooms, each a hand-placed scene of
  boxes; a room must be designed for every area).
- **Migrating the other screens:** each screen keeps its content and takes the Machine's marks (square keys, mono tags, truth
  lines, the reticle) about half a day each, pass by pass; a screen whose thing has no natural object in a room (Make's
  Convert, Me's Keys and storage) is a plate on the wall of its room, which works but is the weakest part of the metaphor.

## Where it fails the five-second test

A stranger sees "a 3-D room with labels" at once and that the glowing ball is the thing to talk to; the plan at the bottom
reads as "other rooms". What fails: the room is dark and drawn in hairlines, so at arm's length the tags are small and the
objects are recognised more by their tags than by their shapes; and the metaphor is natural for Library, God's eye, Agenda
and Gym but arbitrary for screens with no object (the Convert screen is not anything in a room). The Lens is the screen least
changed from round one: the scan shows in the measured table grid and the letter brought to the front, but the photograph
dominates it.
