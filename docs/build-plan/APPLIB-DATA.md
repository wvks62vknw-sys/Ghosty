# THE APP LIBRARY: the DATA lane's report

"Things people have been reverse engineering we could add in our apps so you don't have to reverse engineer it for yourself."
People spend weekends working out the formats of their own data exports. The Library now does that work for him: he picks his
own file, it is read on the phone (in a Web Worker, streamed and unzipped in chunks), and he gets a real app over his own data.

## What landed

### The readers: `packages/shared/src/applib/importers/`
Pure functions that return records keyed by the AppDef's field ids. Every record carries `_key`, so importing again replaces or
merges and never doubles up.

| File | What it reads |
|---|---|
| `xml.ts` | A hand-written streaming XML reader (SAX style). It is fed text chunks and keeps only the unread tail, so a gigabyte export never sits in memory. It skips the prolog, comments and an inline DOCTYPE with its internal subset, and handles CDATA, entities and `>` inside quoted values. |
| `zip.ts` | Reads a zip without loading it. The central directory comes from the end of the file, and each entry is a `Blob.slice` piped through the browser's `DecompressionStream('deflate-raw')`. Handles stored and deflated entries and zip64. |
| `input.ts` | One way to read any file: plain, zipped or gzipped; as text chunks or whole bytes; with progress and a cancel signal. Also the shared date helpers: day-first or month-first worked out from the file, "14 November 2026", "Nov 14, 2026", and iCalendar and vCard line unfolding. |
| `apple-health.ts` | The Health app's export.xml, as a stream. A phone and a watch both record steps and sleep, so each day takes the one source that saw the most, never the sum of the two. Nights belong to the morning he woke. Pounds, stones, miles and kJ are converted. Workouts read their WorkoutStatistics children. |
| `spotify-history.ts` | A music service's streaming history, in both the short and the extended layouts. Plays are folded into one record per track per day. Skips under 30 seconds are left out, and podcasts are kept apart from music. |
| `netflix-history.ts` | A streaming service's viewing history: the simple list, or the full download. Titles are split into series and episode, and trailers are left out. The full download holds every profile on the account, so he picks his own before anything is kept. |
| `youtube-history.ts` | A video site's watch history, as JSON or as the default HTML page. Ads are left out. |
| `kindle-clippings.ts` | An e-reader's My Clippings.txt. A highlight he stretched later is written twice, so only the longer one is kept. Bookmarks are left out. |
| `goodreads.ts`, `letterboxd.ts` | The reading site's library CSV, and the film diary zip (diary.csv is taken over watched.csv). |
| `gpx.ts`, `tcx.ts`, `fit.ts`, `route.ts` | Runs and rides. FIT is decoded from the published protocol: the file header, definition and data messages, the compressed-timestamp header, either byte order, developer fields skipped, chained files, and the session, lap and record messages. `route.ts` works out distance (haversine), pace, kilometre splits (5 km for rides), climb with a 3 m filter, and **the route's shape as an SVG path in a 100 by 100 box**. The shape keeps no coordinates, no scale and no place. |
| `ics.ts`, `vcf.ts` | Calendar events (all-day, timed, duration, repeats; cancelled events left out; guests never kept) and contacts (the photo never kept; no stat ranks anyone). |
| `ofx.ts`, `qif.ts` | Bank statements in OFX or QFX (SGML or XML), and a money program's QIF with its categories. Spending and money in are kept apart. The bank's FITID keeps re-imports single. |
| `csv-table.ts` | Any CSV he exported. The title, date and number columns are found for him. |
| `chrome-bookmarks.ts`, `opml.ts`, `srt.ts` | A browser's bookmarks HTML export or its Bookmarks JSON; podcast or feed subscriptions in OPML; subtitles in SRT or WebVTT. |
| `index.ts`, `meta.ts`, `merge.ts` | `READERS`, keyed by app id: which zip entries an app reads and how they become records. `READER_META` holds the picker's file kinds, the top panel and the route flag, so the page never loads the parsers. `mergeRecords` gives merge or replace without doubles and keeps records he typed himself. `topList` ranks any span of days. |

### The apps: `catalogue/data.ts` (22, family "Your data")
One app per format, and several where one export holds several worth seeing:

- **Health app** (6 apps): Health Steps, Health Sleep, Health Heart (heart rate, resting rate and variability), Health Workouts,
  Health Weight, Health Activity (move, exercise and stand).
- **Music service:** Listening Year, a "wrapped" for any span of days. Its top panel ranks artists by minutes for 7 days,
  30 days, this year, last year, all time, or any two days he picks.
- **Streaming service:** Watch History. **Video site:** Video History.
- **E-reader:** Book Highlights, all searchable. **Reading site:** Reading History. **Film diary:** Film History.
- **Watch or bike computer:** Runs and Rides, from GPX, TCX or FIT files, or a zip of many.
- **Files:** Calendar File, Contacts File, Statement Reader (OFX/QFX), Accounts Export (QIF), Table Explorer (any CSV),
  Saved Bookmarks, Podcast List (OPML), Subtitle Reader (SRT/VTT).

Every app has:
- real fields, stats, a chart and views;
- 3 invented sample records;
- a three-line tour;
- the steps to get the file.

No brand or app name appears anywhere he reads.

### The renderer: `apps/web/src/features/applib/importer.ts`
- It registers `importer` through `registry.ts`, and draws the records with the engine's `log` renderer when it is registered (otherwise the kit's own list).
- A panel sits at the top of the one scroll area:
  - the AppDef's `how` steps, then PICK FILE;
  - while reading, a progress bar and a CANCEL key;
  - for a file shared by several profiles, the profile picker;
  - when records are already kept, "Add to them" or "Replace them";
  - afterwards, a summary line, the top panel and the route panel (with NEWER and OLDER);
  - "How to get a newer file".
- An IMPORT key sits along the bottom.
- Parsing runs in `workers/applibdata.worker.ts` (built by `build.mjs` as `dist/applibdata.worker.js` and kept offline by `sw.js`). Cancel ends the worker.
- The records go to IndexedDB (`ghosty-applib-data`, one entry per app id).
- The newest 1,500 records go to the kit in one change (`KitApp.replaceAll`, added to `ui/appkit.ts`), so one Undo puts back what he had.
- Styles are the "THE APP LIBRARY: the importer" block at the end of `styles.css`: every class is `al-imp` and every colour is a token.

### Tests
`apps/edge/test/applibdata.test.mjs` has 21 tests on small hand-written fixtures, all invented. The ENGINE's `applib.test.mjs` imports it, so it runs in the brain suite. It covers:
- the XML reader fed 3 characters at a time;
- a deflated zip built by hand;
- every Health tally, cancelling, both music layouts;
- profiles and trailers in viewing history;
- the video site's HTML;
- stretched highlights;
- reading and film exports;
- GPX (distance, splits, climb, and the shape with no coordinates), TCX, and a FIT file encoded by hand (a big-endian definition, a compressed timestamp and an invalid field);
- calendar, contacts, OFX, QIF, CSV, bookmarks, OPML, SRT and VTT;
- merging without doubles;
- the catalogue's own checks: a reader per app, fields that exist, clean British words and no brand names.

Checked by hand in Chromium at 390 pt: a GPX file was picked, read in the worker and kept in IndexedDB. Picking the same file again with "Add to them" left one record, not two. It was still there after a reload, with no console error.

## The limits kept
- Only files he exported himself. Nothing logged in, no private interfaces, no DRM.
- Nothing about other people. A shared viewing history is cut to his own profile, guests on calendar events are dropped, photos of contacts are dropped, and no stat ranks a person.
- No location goes to the brain. Routes are kept as a shape (no coordinates) on the phone only.

## Notes for the other lanes
- **ENGINE:** the Library screen must import `features/applib/importer.ts` (as it does for the game renderers) so that `importer` registers. The renderer calls `rendererFor('log')` with `{ ...def, archetype: 'log', log: def.importer.log }`. The kit items it hands over are `{ id: record._key, title, sub, meta, ...fields }`.
- `ImportFormat` values `tcx` and `fit` have no app of their own: Runs and Rides (`gpx`) reads all three, because two apps must never do the same job.
