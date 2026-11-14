# THE PRO ROUND: lane LOG's report

The lane owns the log and importer views (`apps/web/src/features/applib/renderers/log.ts` and its new `log.css`), quick-add
parsing (`packages/shared/src/applib/quickadd.ts`), its brain tests (`apps/edge/test/applibquick.test.mjs`, run from
`applib.test.mjs`) and the new `applibrows` spec (its word is at the very end of `all=`).

## What landed
- **The hero.** The first stat is drawn big (44 pt, tabular figures) with its trend against the period before ("up 20% on
  last week"; for an all-time sum or count, the last 7 days against the 7 before). A limit going up is marked as not good
  (amber), and a reach going up as good (green). It has a goal ring (88 pt with its percentage) and a 14-day sparkline. Where
  there is no trend, it says "£40 left" or "6 to go". The other stats are metric tiles with their own trend and sparkline.
- **Rich rows.** Each row has a photo thumbnail, or a round category mark (a bank's or a health app's), or initials. It has its
  title and line, stars and chips (choices, multi picks, ticked yes-or-nos not already shown) and a right-aligned tabular value.
  There is no cross. Swiping left past halfway deletes, through the kit, so Recently deleted holds it, and puts **Undo** in the
  kit's notice. A short swipe leaves Delete showing. Swiping right does the main action: tick the app's yes-or-no, move the row
  to the next column, or log it again today. A tap on an open row closes it.
- **The item's own page.** It has a big photo (or the glyph art in the category's tone), a large title, the line, stars, and the
  value in the accent. The fields sit on a clean sheet (label left, value right) with long notes below. It has Edit (the form),
  the main action and Delete (with Undo). Escape and the back chevron close it.
- **Quick-add.** One line of plain words above the list. As he types, it shows what it read as chips ("Amount £3.20",
  "Category Fun"). Enter adds the entry with Undo in the notice. If a needed field is missing, it opens the full form already
  filled. The full form is one tap away. The placeholder is a real example taken from the app's own first sample.
  `quickAdd(log, text)` reads:
  - money (£14.50, 18 quid, 80p);
  - stars (4 stars, 4/5, ★★★★) and scales (7/10, "mood 7");
  - durations (26 min, 1 h 20 min, 1:58:30);
  - days (today, yesterday, last Tuesday, next Monday, 3rd March, Dec 25 2025, ISO dates, 12/3);
  - times (7pm, 7.30pm, 18:05);
  - numbers with their field's unit (5k is 5 km, 62.5kg, 300 pages) or label (6 reps);
  - a year for a vintage or model-year field;
  - the app's own choices, with stems and accents ("ran" is Run, "rose" is Rosé);
  - the left-over numbers, into the plain number fields in order;
  - and the rest, as the title.
  It never makes a value up: a 9-star rating or an out-of-range number is left alone.
- **Skins.** A money log reads like a bank's: the list is grouped by day ("Today", "Yesterday", "Thu 12 Nov") with each day's
  total, round category marks, and a 48 pt total. A body log has health-style tiles (the label above, uppercase, in the accent)
  and round marks. Maker logs use monospace readouts, and office logs have airy, plain rows. The skin is `def.skin` or else the
  family (`data-lskin` on the app).
- **Views.**
  - **Board:** drag a card by its grip to another column. The column lights as it passes, and the area scrolls along at the
    edges. The Move key still does it in one tap.
  - **Calendar:** a heatmap month in five levels, weighted by the chart's number or the count. It has a legend, today ringed,
    and the month's entries and days in the head.
  - **Gallery:** a two-column masonry of photos, or glyph art in varied shapes, with the title, line and value.
- **Charts.** Rounded bars, a labelled y axis (0, half and top) with dashed grid lines, and today's bar lit with its value. Line
  charts get an area fill and today's dot.
- **States.** The empty state has the app's glyph on two soft rotated tiles, one inviting line, and "Add the first", which
  focuses the quick-add bar. The importer shows a skeleton in the log's final layout (hero, tiles, rows with thumbnails) while
  it reads a file.
- **Motion.** Sections rise on enter, chips pop, taps scale to 0.97 and the item page slides in. Reduced motion turns all of it off.

Every colour is a token. The stylesheet reads SHELL's `--al-pro-accent`, `--al-pro-accent-text`, `--al-pro-card`,
`--al-pro-radius`, `--al-pro-ground` and `--al-pro-on-accent` where they are set, and falls back to the look's own `--g-*`.

## Checks
- **Brain:** `applibquick.test.mjs` has 7 tests. They cover the cellar and the run lines, days in his words, the workout set,
  nothing made up, and a round trip: every log app's example line reads back into its money and stars, across more than 100
  apps. `npm test` is fully green.
- **Specs:**
  - `applibrows` (new) covers the hero's total, trend and good or not good, ring and sparkline; the money day groups and their
    total; today lit and the y-axis labels; that no row has a cross; stars and thumbnails; the quick-add chips while typing, the
    add, the hero following it and a missing name opening the filled form; swipe left to delete, Undo in the notice and Undo
    bringing the row back; swipe right moving a row; a short swipe and a tap to close; the item page's sheet, stars and art,
    Edit and Delete with Undo; board drag; heat on the month; the two-column masonry; 44 pt keys and nothing sideways; and the
    empty state.
  - `applib` and `applibplay` stay green unchanged. Their log checks (the stats strip, rings, the 7-bar week chart, every field
    type, add, Undo, the four views and the board's Move key) all still hold.

## Notes for the lead
- The kit's page container sets `pointer-events: none` above the app, so anything a finger drags that is not a button needs
  `pointer-events: auto` (log.css sets it for rows, board cards and the item page). SHELL may want this rule in its frame.
- The item page is drawn inside `.ak-app`, so it covers exactly what SHELL's full-screen frame covers.
