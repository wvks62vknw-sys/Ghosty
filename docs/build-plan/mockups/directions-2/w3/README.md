# W3 · The Eye — the Material, as the Machine's attention

**The idea in one sentence:** the orb is an eye; whatever it is looking at is sharp, in a box, with its line of sight drawn to
it, and everything else is there as grain.

The seed was THE MATERIAL ("nothing is drawn until Mind forms it … dark is the absence of Mind's attention"). His reference
(OWNER-ISSUES 137) turned the material from light into attention, which is what the Machine is: an eye that is always looking at
something. Attention is the only material and it has three grades: the thing itself (the picture at full resolution, an accent
box, the line of sight from the orb); the edge of attention (a finer grain, bracket corners: his favourites); and grain (an
ordered dither, dim: present, recognisable as a shape, not looked at). Home is the wall of everything Ghosty watches (tonight's
book, the recents, the favourites, the six areas, every screen) as feeds, all grain but one: tonight the eye is on Alice, page
42, and the page is sharp. A tap moves the attention; a typed word sends the reticle hopping across the wall until it locks;
the Stage is the attention taking the screen: Birmingham in grain except the way he is going, New Street boxed. On the Lens the
world is grain except what it has found; in the reader the passage it is reading aloud is boxed and sharp and the rest of the
page sits just out of focus. The tests: said without the banned words; no phone app looks like it (nearest: a security
camera wall, which has no eye, no attention and no answers); what moves is the attention: grain resolving into the thing, the
line of sight swinging, the reticle hopping.

Files: `tokens.css`, `style.css`, `eye.js` (the one fragment shader: grain, the edge, the thing itself, the line of sight, the
eye), `feeds.py` (the feeds drawn as monochrome pictures: Alice's own page, a globe with aircraft, the radar, the Lens view,
the calendar, a sudoku, the algebra card, the exam paper, the pinball table, the word card, the keyboard, Birmingham from
above), `build.py`, the PNGs, `story-1..4`, `story.png`, `contact.png`, `home-ember-*.png` (the theme proof).

## The finding rule

| What | Taps | How |
| --- | --- | --- |
| Tonight's thing | 1 | It is the feed in focus at the centre of the wall; tap it |
| A recent (God's eye, Brief) or a favourite (Lens, Agenda, Gym, Courses) | 1 | They are the feeds round the eye (favourites at the edge of its attention); tap one: the eye looks at it, it resolves and opens |
| Anything else (44 screens, about 150 abilities) | 2–3, or one typed word | Tap an area's feed (1: the wall becomes that area's feeds), tap a feed (2), a panel inside (3); or type a word: the reticle searches the wall and locks |
| Back | 1 | The wall (top left); the eye lets go and the feed falls back to grain |

## What runs live on the phone, and what is a still

- One shared WebGL canvas behind the type: the grain is a single cheap fragment shader (an ordered dither of a picture); the
  feeds' pictures are each feature's own drawing: the hub cards already draw an instrument for every tool (ui/instruments.ts),
  so a feed is that instrument, or the screen's last frame, drawn into the canvas when it changes (at most once a second).
- Live: the attention (resolve, 360 ms), the line of sight, the eye's states, the search; the Lens's camera dithered at 30 fps.
- Still: a feed whose feature has nothing new is its last picture; Reduce Motion cuts the resolve to an instant change.
- The cheapest of the three on the battery: a 2-D shader that redraws only when attention or a feed changes.

## Honest costs

- **The shell** (the wall and its layout, the three grades of attention, the line of sight and the eye, the search on a typed
  word, the Stage as attention taking the screen, the feeds from the existing instruments): about **8 days**.
- **Migrating the other screens:** half a day each, pass by pass: each keeps its content, takes the Machine's marks, and gives
  the wall one picture of itself (most already have it in their hub card's instrument).

## Where it fails the five-second test

The wall reads at once as "screens being watched, one in focus", and the line from the ball to the sharp one says what the ball
is doing; the Lens and the Stage are the clearest moments of the three worlds. What can fail: grain everywhere can read as "low
quality" to someone who has not been told it is unattended (the first-run moment must show the eye resolving one feed); and on
the wall the tags of fourteen feeds are small, so the wall is for glancing, not reading: everything he reads is in focus.
