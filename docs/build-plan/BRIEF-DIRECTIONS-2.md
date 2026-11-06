# BRIEF: THREE DIRECTIONS, ROUND TWO — a total redesign, something not seen before (STATUS item 1a, second round)

The owner on round one (6 Nov, OWNER-ISSUES 136): "tbh they're all kinda shit i was expecting it to all look a bit better and like a
total redesign something that hasn't been seen before or something that has and just like better in general". Round one
(docs/build-plan/mockups/directions/, the three sheets) was three rearrangements of a dark phone app: an orbit of icons, an
editorial ink page, today's glass tidied. Not one of them would make a stranger say "I have never seen a phone do that". This round
must. The brief is the floor (OWNER-ISSUES 133); the bar is STANDARD.md's; the pick is his.

Read first, in this order: STANDARD.md; STARS 160 and 164 (Mind the orb at the centre; the Stage that takes the centre while
something is shown); OWNER-ISSUES 129, 131 (finding 6), 133, 135 and 136; BRIEF-DIRECTIONS.md (round one's content list and rules:
the same five moments, the same real words, the same renderer) and round one's `directions/contact.png` so you know what NOT to
make again; `docs/build-plan/mockups/directions/lib/` (the shared content, the phone frame, the renderer checks: reuse the content
and the checks, not the looks); `docs/build-plan/mockups/iron/` and `hero/` (what he liked before: the Iron Man workshop energy and
the Cinematic boot — not to copy, to understand his taste); apps/web/src/shell/hubcards.ts for the real words. Start from the tip of
`claude/new-session-4erjve` (`git log -1` first; reset your worktree to it); branch `builder/directions-2`.

## What "not seen before" means here

A direction is a WORLD with its own physics, not a style sheet. Each must have ONE signature idea a stranger could describe in a
sentence after ten seconds, and everything else follows from it. Tests before you draw:
- Say the idea in one sentence without the words dark, glass, card, tab, list, minimal, clean. If you cannot, it is not an idea.
- Name a phone app that already looks like it. If you can, it is round one again.
- Say what moves: the signature idea must live in motion (how Home becomes a hub, how the Stage arrives, how the orb answers a
  touch), so every direction delivers a STORYBOARD strip (four frames of one transition, Home → the thing he asked for) beside
  the five still screens. The stills alone cannot show a thing not seen before.
- Depth and light are real, not implied: the mock pages may use canvas or WebGL inline (Chromium renders it at screenshot time;
  no packages, no network); gradients, bokeh, volumetric light, reflections, particles, parallax are all allowed where the idea
  needs them, and performance on a phone is said honestly in the README (what runs on one shared canvas, what is a still).
- Mind the orb stays the living centre; the Stage takes the centre while something is shown. Those two are his; all else is open,
  including whether there is a "screen" at all.

Three worlds to build (seeds, not scripts: replace any with a stronger idea of your own and say so):
- W1 THE ROOM. Ghosty is a place, not a page: the phone is a window into a lit three-dimensional space where the orb floats and his
  things stand in depth (the reader as an open book on a surface, the journey as a model of the city on the table, the hub as a
  wall of lit instruments); tilting the phone looks around (parallax from the gyroscope); the Stage is the thing brought to the
  front of the room, life-size. The Iron Man workshop's energy, nothing of its chrome.
- W2 THE FIELD. One infinite canvas with semantic zoom: all of Ghosty is laid out in one space around the orb at the origin;
  pinch out to see everything he can do as a constellation, pinch in on anything until it is the reading itself; the Stage is
  simply zooming into the thing; recents and favourites are what is nearest the orb; typing a word flies to it. No screens, no bar.
- W3 THE MATERIAL. The orb's light is a substance: the interface is made of it. Nothing is drawn until Mind forms it — a card is
  light that gathers, a hub is the orb's light poured along a surface, the Stage is the light taking the shape of the thing (a
  route, a room). Type set in the light; the glow is the structure, not decoration; dark is not a background colour, it is the
  absence of Mind's attention.

## What you deliver (the same shape as round one, plus the storyboards)

`docs/build-plan/mockups/directions-2/w1/`, `w2/`, `w3/`, each: `tokens.css` (as round one: real tokens, every token's purpose, Ember
as a second theme block), `build.py` (stdlib only), the five moments at 390 × 844 and 440 × 956 at 2× (Home idle; Home SHOWING with
the 7:42 from New Street on the Stage; the Learn hub with its seven real cards and readouts; the one Lens with three tags and the
act; the reader with its Shelf row), the STORYBOARD strip (four frames, 390, one transition), a `README.md` (the idea in one
sentence; the design paragraph; the finding rule as a table: recents and favourites in two taps, everything else in three or one
typed word; what runs live on the phone and what is a still; honest costs for the shell and for migrating the other screens;
where it fails the five-second test), a contact sheet per world at 390, and ONE sheet across the three (`directions-2/contact.png`:
the five moments and the storyboard per row, one line each) for his pick.

## Rules (round one's, unchanged, plus three)

Nothing under apps/ or packages/ changes; no packages; real words only (hubcards' names and readouts, Birmingham, Alice at page
42); Ghosty says "I"; no model names anywhere; both widths rendered; the renderer's checks (nothing sideways, no target under
44 × 44, no type under 11 pt) at zero. PLUS: (1) look at every PNG you make and judge it against "would a stranger say they have
never seen a phone do this?" — if the answer is no, change the idea, not the padding; do at least two full rounds of that before you
report; (2) no world may be a recolour or a rearrangement of today's Ghosty or of round one; (3) if one of the three comes out
weaker than the other two, say so plainly in the report rather than polish it.

## Size

The top tier, effort max, three to four hours. Report: the branch, the PNG and README paths, the brief's checklist line by line,
what you did beyond it, your questions for the owner, and your own one-line pick with the reason.
