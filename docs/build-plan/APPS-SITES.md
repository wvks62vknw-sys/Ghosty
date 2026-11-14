# THE APPS ROUND: SITES (Design)

## What I built: Design, one free canvas
Open **CREATIVE → Design** (it is now the first pill). It opens on a designed page, never a blank one, and everything is kept on your
phone.

- **Every part moves by hand:**
  - drag a part to move it; it snaps to the page's edges and centre and to the other parts, with a line showing where it snapped;
  - pull a corner to resize it from the opposite corner (text grows its letters, a photo keeps its shape);
  - the side handle widens a text box; the handle above a part turns it, settling on every 15°;
  - arrow keys nudge it, Delete removes it, and ⌘Z / ⇧⌘Z undo and redo when a keyboard is attached.
- **Edit:** add a heading, text, a rectangle, a circle, a line, or a photo from your phone (made smaller here, never uploaded). For text
  you get the words, seven faces, size, bold, capitals and alignment, and it warns you when the words are hard to read on the page colour.
  For every part: its colour from your brand, how see-through it is, lining it up on the page, forward and back, duplicate, lock and delete.
- **Layers:** every part, top first, with forward, back, hide and lock. A locked part does not move and says why.
- **Templates:** ten designed templates (birthday party, café menu, big sale, club night, quote, video thumbnail, announcement,
  thank-you card, garage sale, blank), filtered by occasion. Each is laid out in proportions, so it fits every size, and uses your
  brand's colours and faces.
- **Resize (magic resize):** a copy at any other size, with every part kept in its place and in proportion. The sizes are square post,
  story, video thumbnail, A5 flyer, A4 poster, 5 × 7 in invitation, DL menu and A6 card. The first design is kept.
- **Brand:** your colours (started from your look), a heading face and a body face; USE MY BRAND ON THIS DESIGN puts the faces on it.
- **Export, made on your tap:** a PNG at the page's size, a vector file (SVG, with the words as text), and a print PDF with 3 mm bleed
  (the page runs into the bleed and the trim marks the finished size). **ON MY SITES** puts it on your sites as a page: a picture of the
  design with its words as the description. It goes up only after your APPROVE in the chat, through the same pinned approval as every
  page from your phone.
- **My designs:** all of them kept on the phone, to open or copy. Deleting one puts it in **Recently deleted** for 30 days, with PUT BACK.
- **Undo and redo** for every change, and it saves as you go: after a reload the same design is open.

## How to try it
1. CREATIVE → Design. Drag the title somewhere else and watch it snap to the centre line. Tap Undo, then Redo.
2. Templates → Club night. Pull a corner of the ticket to make it bigger, and turn it with the handle on top.
3. Resize → Story: a story-sized copy of the same design.
4. Export → Print PDF with bleed, then open it from Files.
5. Export → On my sites → APPROVE in the chat, then open its link.

## Tests
- **Brain test:** `apps/edge/test/designapp.test.mjs` (6 tests, in the test list). It covers every template at every size, magic resize,
  snapping, alignment and order, text wrapping, a strict read-back (a picture from the network is never drawn), the SVG with its words and
  credits, the PDF's bleed boxes and cross-reference table, and the page for your sites.
- **Spec:** `tests/design.spec.mjs` (its word `design` at the end of check.yml's `all=`), at 440 × 956 and 390 × 844, 56 checks. It covers
  templates by occasion, moving by hand with snapping and a guide, undo and redo, corner resize, rotation, layers (hide, lock), magic resize,
  the brand kit, the PNG, vector file and print PDF read back, My designs and Recently deleted, a reload, 44 pt keys with nothing sideways,
  and ON MY SITES only after APPROVE.
- **tabs.spec:** CREATIVE's pills now start with Design.

## Decisions
- **Inside CREATIVE, not a new tab.** It sits beside the old Poster, Card and Logo, so nothing he has goes away. A tab of its own (Jump
  bar, hub tile, voice) is the next step.
- **His rules:** nothing leaves the phone except through ON MY SITES, which waits for his APPROVE; his photos are redrawn smaller here
  (their hidden details go with the redraw); a picture that is not a data image made on the phone is never drawn from a saved design.
- **No new tool names** and nothing protected changed beyond the test list.

## What is left
- Open-licence fonts downloaded on his tap (it uses the faces already on the phone and the vendored Oswald for now).
- Openverse and Wikimedia Commons photos with their credits (the credit plumbing is built and tested; the search panel is not).
- Background removal with PHOTO's cut-out, collage grids and photo frames, icons and illustrations, mockups.
- Grouping and selecting several parts at once; MP4 and GIF export; an inside page and a folded PDF for cards.
- Its own front door (Jump bar, hub, voice), the ASK button, a Home widget, settings and help pages.
- Invitations with an RSVP page on his sites, and the Site Editor built on the same canvas.
