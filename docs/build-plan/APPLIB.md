# THE APP LIBRARY: hundreds of real apps today, and endless more

The owner's words: "it should have every single one from that list and many many many more … there's genuinely endless
possibilities of apps we could make and we could actually make them good … things people have been reverse engineering we
could add those things in our apps so you don't have to reverse engineer it for yourself, it's already here and better."

So the Library is one engine and hundreds of apps written as data. Every app is an `AppDef`
(`packages/shared/src/applib/types.ts`, the contract), drawn by the engine on THE APP KIT (`apps/web/src/ui/appkit.ts`,
guide `docs/build-plan/APP-KIT.md`). That way every app has the kit's header, one scroll area, search, undo and redo,
Recently deleted, first run with sample data and a tour, CSV and JSON export, settings and a Home card. A hundred apps
feel made by one company.

## The lanes and their files (no lane edits another lane's files)

| Lane | Branch | Owns |
|---|---|---|
| ENGINE | `claude/new-session-4erjve-lane-applib` | `types.ts` (additive changes only, told to every lane), `index.ts`, `expr.ts`, `validate.ts`, `apps/edge/test/applib.test.mjs`, `apps/web/src/features/applib/**`, `catalogue/ghosty.ts`, the `applib` spec, the screen's styles block |
| DATA | `claude/new-session-4erjve-lane-applib-data` | `packages/shared/src/applib/importers/**`, `catalogue/data.ts`, `apps/edge/test/applibdata.test.mjs`, the importer renderer hook in `features/applib/importer.ts` |
| CAT-A | `claude/new-session-4erjve-lane-applib-a` | `catalogue/office.ts`, `catalogue/maker.ts` |
| CAT-B | `claude/new-session-4erjve-lane-applib-b` | `catalogue/create.ts`, `catalogue/games.ts` |
| CAT-C | `claude/new-session-4erjve-lane-applib-c` | `catalogue/learn.ts`, `catalogue/world.ts` |
| CAT-D | `claude/new-session-4erjve-lane-applib-d` | `catalogue/body.ts`, `catalogue/life.ts` |
| CAT-E | `claude/new-session-4erjve-lane-applib-e` | `catalogue/money.ts`, `catalogue/tools.ts` |

The owner's list for each family is `docs/build-plan/applib/catalogue-<family>.md`: 426 apps from the Atlas.

## Times (UTC, today)
- **14:55 ENGINE:** `expr.ts`, `validate.ts` and `applib.test.mjs` are on the integration branch, so every catalogue lane can check its apps.
- **15:45 ENGINE:** the renderers and the Library screen are in. From then on every lane looks at its own apps on the phone and polishes them.
- **16:00:** each catalogue lane has its first half in.
- **17:00:** hard stop. Everything is on the integration branch `claude/new-session-4erjve-apps`, with the lane's report at `docs/build-plan/APPLIB-<LANE>.md`.

**How to land:**
1. Merge `origin/claude/new-session-4erjve-apps` into your lane.
2. Run the brain suite (`npm test`, which must be fully green) and your own spec or validator.
3. Push your lane, then fast-forward the integration branch: `git push origin HEAD:claude/new-session-4erjve-apps`.
4. If the push is refused, merge again and retry.

Land small and often. Keep usage lean: run targeted specs only, never the whole spec set.

## The standing rules (never broken)
- Only his own data and public sources. No prediction about any person. No private person searched or profiled.
- Nothing that costs money, and no keys. No app calls a server. Everything an app keeps stays on the phone under `ghosty.app.<id>`.
- Sharing only through the phone's Share sheet on his tap. Social posting only with his APPROVE every time.
- Every engineering, car, build, body or money figure is a first estimate, never certified. Set `calc.estimate: true`, and the engine shows "A first estimate, never certified."
- The brain never gets live GPS. No app reads location.
- Faces and voices only him and the people he introduces. No app recognises anyone.
- Never raise the prompt guard. The Library list is never put in the brain's prompt; opening apps by name is done on the phone.
- Never skip or weaken a test. Never touch the protected files: `apps/edge/src/agent.ts`, `apps/edge/src/index.ts`, `apps/edge/src/tools/{index,types,repo}.ts`, `.github/*` (except your spec word appended at the very end of `all=` in check.yml), `apps/*/package.json`. `apps/web/public/_headers` may only be tightened.
- Never put a model name in code, comments, tests, docs or pull request text.

## "Reverse engineered, done for you" (DATA lane)
People spend weekends working out the formats of their own data exports so they can see their own numbers:
- Apple Health's export.xml;
- Spotify's streaming history;
- Netflix's and YouTube's viewing history;
- Kindle's My Clippings;
- Garmin's FIT files.

The Library does that work for him. He picks the file, it is read on the phone (in a worker, streamed for big files), and he gets a real app over his own data, for example:
- Wrapped any day of the year;
- every Kindle highlight, searchable;
- his runs from GPX, TCX or FIT;
- steps, sleep, heart rate and workouts from Health.

**The limits:**
- Only files he exported himself.
- Nothing logged in, no private interfaces, and no DRM ever touched.
- Nothing about other people. Stats are about his own activity, never "who you talk to most".

## The quality bar for every app (what a top company in that field would ship)
1. **Truly useful at its core.** A log has the fields a category leader has (a wine cellar has wine, producer, vintage, region, grape, bottles, rating, price, drink-by, notes and a photo). Its stats are the ones a person checks (bottles in the cellar, value, ready to drink this year). Its views fit (gallery for collections, board for pipelines, calendar for anything dated).
2. **Real first run.** 3 to 6 sample records that look like a real person's, invented and generic: no real people, no brands as content where avoidable. A three-line tour that teaches the app's best move.
3. **Clean words** (the owner: "no sloppy text, all fitting the clean aesthetic"):
   - British English throughout.
   - Names in Title Case, 18 characters at most. A pitch is one sentence of 30 to 90 characters ending with a full stop.
   - Labels are one or two words. No emoji, no exclamation marks, no "Lorem", no placeholders.
   - Never a brand or app name in any text he sees. Never call an app after a product ("Spotify Wrapped" becomes "Listening Year").
4. **Right.** Every calc formula comes from a public source named in `source`. It carries 2 or more `tests` whose expected outputs you worked out from that source; the validator runs them. Guides are plain facts from a public source with its https link: no medical dosing, no legal advice, no made-up facts. Decks hold only facts you are sure of.
5. **Honest.** If an app on the owner's list needs its own engineering that no archetype can give truthfully (a video editor, a 3D game, live data), do not fake it. List it in your report under "needs its own build", with the one line that says why.
6. **Unique.** Ids are unique across the whole Library, so prefix with nothing and check the validator. Two apps never do the same job: merge them.

## Many more
Each catalogue lane covers its two families' lists, then invents at least 60 more apps of the same quality in those families (30 each). Pick what real people install most, plus the clever niche ones that delight. The DATA lane makes one app per import format, and more where one export holds several worth seeing. The ENGINE lane lists every one of Ghosty's own full screens in `catalogue/ghosty.ts` (archetype `screen`), so the Library holds everything.

## ENGINE: what the engine must give (in this order)
1. **`expr.ts`:** the safe expression language in `CalcConfig`'s comment (a hand-written parser: no `eval`, no `Function`). Also `validate.ts`, which checks every AppDef against this brief:
   - the format and the lengths;
   - unique ids;
   - fields referenced exist;
   - calc tests pass within `tol` (default 0.5% or 0.01);
   - glyphs exist;
   - British spelling for the common pairs (color, favorite, center, organize…);
   - no emoji, no "!", no "TODO" or "lorem";
   - no brand names from a short deny list.

   `apps/edge/test/applib.test.mjs` (run from the brain suite like appkit.test) runs it over `LIBRARY` and fails on any problem with the app id and the reason.
2. **The renderers** in `apps/web/src/features/applib/`, one per archetype, on the kit:
   - **log:** field editor sheet with every field type, list, board, calendar, gallery, stats strip with goal rings, chart, reminders through the existing notification path.
   - **checklist:** with daily or weekly fresh starts.
   - **calc:** with live answers as he types, units, the estimate line and the source line.
   - **timer:** steps, rounds, a voice or chime per step, and it survives a reload.
   - **deck:** spaced repetition.
   - **counter**, **guide** (searchable) and **screen** (opens the hash).
   - **game:** as many of the 20 kinds as can be made excellent. The polish3 lane is building the Arcade, so reuse its games where they exist and never duplicate them.
3. **The Library screen.** An app store as good as the best phone one:
   - featured apps, families, search as he types, and each app's page (icon, name, pitch, what it keeps);
   - OPEN, PIN TO HOME and "make my own from this".
   - Open by voice or the Jump bar: "open wine cellar" opens `#apps/wine-cellar` on the phone, without the brain.
   - Recently used, and a Home card for pinned apps.
   - It is one screen in the rooms, with one name: Apps.
4. **App Maker.** "Make your own app": he picks an archetype, adds fields, stats and views, and names it. It is saved on the phone as an AppDef and drawn by the same engine, so the possibilities really are endless. He can also duplicate any Library app and change it. "Make me an app for my vinyl" builds a first draft from the words (extend `packages/shared/src/appkit/brief.ts`'s reading), shown for his OK.
5. **The `applib` spec,** with its word appended at the very end of `all=` in check.yml:
   - Every app in `LIBRARY` opens, draws with no console error, keeps one scroll area, has nothing sideways and every key at 44 pt.
   - One app of each archetype is driven through its main move (add, tick, calculate, time, review, count, search, play, import a fixture).
   - All seven looks at 440 and 390 for one app per archetype.
