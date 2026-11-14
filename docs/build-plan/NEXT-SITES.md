# THE NEXT ROUND: SITES (his sites and everything that publishes)

Lane `lane-sites`, branch `claude/new-session-4erjve-lane-sites`. Built by the mid tier. Every publish still waits for his APPROVE,
every time, and nothing is bought.

## What I built

### 1. Your own photos on your sites (`sites.u12`, the round's pick)
- **Where:** Workshop → Made → **PHOTOS FOR YOUR SITES**. Tap **ADD PHOTOS** and pick from your photos; up to 24 are kept.
- **Location removed:** each photo is made smaller on your phone (1600 px on its long side) and drawn afresh as a new JPEG. That
  leaves its location, the time, the phone model and every other hidden detail behind. Ghosty's server then strips any hidden
  detail block once more before keeping it. The spec checks this: it adds a photo with a GPS position, the phone model and a comment
  in it, and reads the kept file back with none of them.
- **Each photo card:** a caption (what a screen reader says), **MAKE MAIN** (the first photo is the main picture of a site) and
  **REMOVE** (asks first). A photo that a published page still shows keeps working on that page; you are told which page.
- **Using them:** say "build a website for my café **with my photos**" (or "use our pictures"). The approval says "With your own N
  photos… not stock pictures". The site then uses your photos instead of free stock pictures: the first as the main picture, the
  next two for the story, the rest in the gallery, and in the portfolio and past-work galleries that only ever show your own pictures.
- **Privacy:** nothing is public until a page you approved shows it.

### 2. Undo for your pages (`sites.u2`)
- Every page you publish (websites, pages, mini-apps, games) keeps its last three earlier versions.
- **From the Workshop:** PUBLISHED PAGES → **UNDO LAST UPDATE** on the page's card. It asks first, like UNPUBLISH.
- **From the chat:** "undo my last update to the party page" (asks your APPROVE).
- The page goes back at the same link. What was live is kept, so you can undo the undo.
- Taking a page down takes its history with it.

### 3. A document or a deck at its own link (`sites.s4`, with `sites.s3`)
- In DOCS or PRESENTATIONS, EXPORT → **PUT IT ON MY SITES**. It makes one clean read-only page on your phone:
  - a document becomes its own page;
  - a deck becomes its slides drawn one under another, swiped like a book, with no script at all.
- The page waits with me (nothing is published by the key), and the key asks in the chat: "Publish <title> as a page".
- It goes up after your APPROVE, through the same quality check as every page on your sites. A broken page is refused.

### 4. Change a mini-app after it's made (`sites.u6`)
- "Add stretching to my habits app", "take walk off it", "change my water goal to 10", "rename it", more timer steps or rounds,
  more flash cards.
- Only what you named changes. The app keeps its link and its kind, so what you saved on your phone stays.
- The change is said before your APPROVE, checked by the app kit, and undoable with UNDO LAST UPDATE.

### 5. One home page for your sites (`sites.u8`)
- Workshop → PUBLISHED PAGES: tick **ON MY HOME PAGE** on the pages you want on it. The choice is kept on your phone.
- Then tap **PUBLISH MY HOME PAGE (N)**. One clean page listing only those pages (title and link, no script) waits with me and goes
  up after your APPROVE in the chat.

## How to try it on your phone
1. **Your photos:**
   - Workshop → Made → PHOTOS FOR YOUR SITES → ADD PHOTOS, and pick three photos of your place.
   - Write a caption on one and tap MAKE MAIN on another.
   - In the chat: "Build a website for my café in Bilston called Little Fern with my photos". Read the approval: it names your
     photos. Tap APPROVE.
2. **Undo:**
   - Publish a page, then ask me to change a line on it.
   - Workshop → PUBLISHED PAGES → UNDO LAST UPDATE → PUT IT BACK. Open the link: it is the earlier version.
3. **A document at its own link:**
   - DOCS → NEW, write a few lines, then EXPORT → PUT IT ON MY SITES.
   - Tap APPROVE in the chat and open the link. A deck works the same way from PRESENTATIONS → EXPORT.
4. **Change an app:** "Make me an app to tick off my daily habits water and walk", APPROVE; then "add stretching to my habits app",
   APPROVE. Your ticks are still there.
5. **Your home page:** Workshop → PUBLISHED PAGES, tick ON MY HOME PAGE on two pages, then PUBLISH MY HOME PAGE, APPROVE, and open
   the link.

## Tests
- **Brain test:** `apps/edge/test/sitephotos.test.mjs`, named in the test list, 6 tests. It covers:
  - stripping hidden detail from a photo;
  - keeping, captioning, making main and removing photos, with the bytes kept while a page still shows the photo;
  - a whole website built from your own photos (no stock, your captions as alt text, the page check clean);
  - undo, including undoing an undo, the three-version limit and the Workshop's route;
  - a document handed over and published only through APPROVE, with a broken page refused;
  - a changed mini-app (same link, same kind, said first, undoable, and the refusals in words).
- **Spec:** `tests/sitephotos.spec.mjs`, its word at the end of check.yml's `all=`, at 440 × 956 and 390 × 844. It proves the
  photos panel, location removed (read back from the kept bytes), caption, main picture, 44 pt keys, BODY 21, the approval naming
  your photos, remove, undo from the Workshop, a document and a deck at their own links, an app changed after it's made, and your
  home page listing exactly the pages you chose.
- **nav.spec:** its Workshop "Made" section now also checks PHOTOS FOR YOUR SITES.

## Decisions I made
- **No new tool names.** Undo and documents go through `publish_site` (its `undo` and `from_phone`), and app changes through
  `build_app` (`change`). Every new tool name lengthens the plain prompt, which is at its guard.
- **Protected files, each with its reason in the commit message:**
  - `apps/edge/src/agent.ts`: route lines for `/sites/photos`, `/sites/page` and `/sites/<name>/versions|restore`, each answered in
    the brain where his lists live.
  - `apps/edge/package.json`: the test list only.
- **Undo from the Workshop is a confirmed tap**, as UNPUBLISH already is. From the chat it is an APPROVE.

## Merged
- Into the integration branch at `e903fac2` (02:47 UTC): items 1 to 5 above, with their tests, catalogue and WHAT'S NEW lines.

## What is left (sections 5 and 6)
The rest of section 5 is not built yet (each would be its own whole piece):
- edit a live site by tapping (u1);
- a private visitor count (u3);
- sites in more languages (u5);
- more mini-app kinds (u7, with recipe timers);
- a weekly check-up (u9);
- a high-score table (u10);
- a front page for each game (u11);
- add-to-calendar (s1);
- poster and QR (s2);
- comics as a reader page (s5);
- menu from a sheet (s6);
- sheet to mini-app (s8);
- Workshop tools as apps (s10);
- hours from your agenda (c1);
- flashcards as an app (c2);
- a route page (c4);
- sites in a Ghosty look (c6).

## The specialist sweep (against Carrd, Squarespace, Linktree, Glide)
- **Built this round:**
  - your own photos (Squarespace's image library, kept private and location-free);
  - one home page listing chosen pages (Linktree);
  - version history and restore (Squarespace's page history);
  - publishing a document or a deck as a page (Carrd and Glide publish pages from content);
  - editing an app after it is made (Glide's live app editing).
- **Still missing, by app:**
  - Carrd: a one-page link list and custom domains (only one he already owns).
  - Squarespace: in-place editing of a live page, visitor analytics, and multi-language sites.
  - Glide: apps from a spreadsheet.

  Each of these is a section 5 item above.
