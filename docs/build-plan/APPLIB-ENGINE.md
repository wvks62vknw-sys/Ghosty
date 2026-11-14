# THE APP LIBRARY · the ENGINE lane (14 Nov 2026)

## What landed

**The format's checks (`packages/shared/src/applib/`)**
- `expr.ts`: the safe expression language for every calc. It uses a hand-written tokenizer and a recursive-descent parser, with no `eval` and no `Function`. It covers numbers, `+ - * / ^ %`, brackets, comparisons, `and`, `or`, `not`, the functions `min max round floor ceil abs sqrt cbrt ln log10 exp pow sin cos tan asin acos atan atan2 hypot clamp if`, and `pi` and `e`. Angles are in degrees. A name it was not given, a prototype name such as `__proto__`, or a formula nested past 100 levels is refused in plain words, never a crash.
- `validate.ts`: every check in the brief:
  - format and lengths: a Title Case name of 18 characters at most; a one-sentence pitch of 30 to 90 characters ending with a full stop; 2 to 8 lower-case keywords; three tour lines of 70 characters at most;
  - unique ids and names;
  - every field a title, line, meta, date, sort, group, stat, chart, reminder or sample names exists and is the right type;
  - board, calendar and gallery have what they need;
  - sample values fit their fields;
  - calc formulas parse and read only inputs or earlier outputs, with 2 or more tests that pass within `tol` (default 0.5% or 0.01) and a public source;
  - glyphs exist, and each archetype's own config is valid;
  - British spelling for the common pairs;
  - no emoji, no "!", no TODO or lorem, and no brand from the deny list. Only the importer's "where to get the file" steps may name a service.
- `apps/edge/test/applib.test.mjs` runs from the brain suite (imported at the end of `appkit.test.mjs`, so no `package.json` edit). It checks the parser and the validator on good and broken apps, then every app in `LIBRARY`, failing with each app id and reason. It also runs the PLAY & MAKE and DATA lanes' `applibgames` and `applibdata` tests when they exist. It asserts that the brain's prompt never reads the Library.

**The engine (`apps/web/src/features/applib/`)**
- `registry.ts` offers:
  - `Renderer` and `registerRenderer`;
  - `redraw(k, draw)`, so a renderer's own view redraws after every kit change, keeping undo, redo, search and the tour;
  - `toolKey(k, el)`, which adds an app key before Undo;
  - `registerMaker` and `registerAppSource` for App Maker;
  - `loadLaneFiles()`, which imports `importer.ts`, `maker.ts` and `games/index.ts` by name when the Library opens, so no lane edits another's file.
- `engine.ts`: `mountApp(host, def)`. It builds the kit frame (header, one scroll area, keys at the bottom, notices, first run with sample records and the tour, search, undo and redo, Recently deleted, CSV and JSON export, settings), then draws the archetype. Values read the way he reads them: £12.50, 1 h 20 min, ★★★★☆, 14 Nov 2026, and a vintage as 2016, not 2,016.
- `renderers/log.ts`:
  - the editor sheet with all 14 field types: text, long, number, money, date, time, duration, choice chips, multi chips, stars, a scale slider, a yes/no switch, a photo (picked, shrunk to 600 px and kept on the phone), and a link;
  - required fields, said in the notice;
  - list (grouped by its choice field), board (a column per option, each card with a "To <next>" key), calendar (month grid, dots, a tapped day's entries, add on that day) and gallery;
  - the stats strip, with every stat kind, periods and goal rings (reach, or a limit that turns amber when passed);
  - a bar or line chart over 7 days, 30 days or 12 months;
  - reminders on the day, said once a day in the app's notice and switched off in its settings.
- `renderers/simple.ts`:
  - checklist: ticks, a progress bar, fresh each day or week, CLEAR TICKS, add an item;
  - calc: answers change as he types, with units, choices, KEEP (a kept answer can be undone), RESET, "A first estimate, never certified." and the source line;
  - timer: steps and rounds, a chime and the step said aloud (a settings switch), a run that survives a reload, and each finished session kept;
  - deck: spaced repetition on the shared SM-2, or a quiz with a score, and a card list;
  - counter: more and less, the leader lit, fresh each day or week;
  - guide: searchable sections and the linked source;
  - screen: opens Ghosty's own screen.
- `glyphs.ts`: all 107 icons named in `APP_GLYPHS`, drawn in the kit's stroke style.
- `index.ts`, the **Apps** screen (Home room, `#apps`):
  - search as he types (Enter opens the best match);
  - pinned apps as Home cards, Recently used, Featured (a hero and four more, changing daily), the families with counts, and a shelf per family with SEE ALL;
  - each app's page: icon, name, family, pitch, what it keeps and how it works, with OPEN, PIN TO HOME and MAKE MY OWN once App Maker lands.
- **Addresses:** `#apps/<id>` opens an app; `#apps/about/<id>` is its page; `#apps/family/<f>` is a family; `#apps/make[/<id>]` is App Maker. `shell/tabs.ts` hands the part after the first `/` to the screen, as it already did after `?`.
- **Open by name on the phone, with no brain:** "open wine cellar" (also "please open the wine cellar app") matches an exact app name in `features/applib/open.ts`, called from `session.ts` before the help desk. The Jump bar finds every app by name and keywords (a command per app). Ghosty's own screens are left to the existing paths, so "open radio" still opens Radio. The Library list never goes to the brain.
- `catalogue/ghosty.ts`: Ghosty's 45 full screens as archetype `screen`.
- **Wiring:** Apps is in the Home room (`areadefs.ts`), the deck (`deckcopy.ts`), the tints and the abilities map. The styles are the "THE APP LIBRARY" block at the end of `styles.css`: every class is `al-` and every colour a token.

**The spec `tests/applib.spec.mjs` (word `applib`)**
- The Library: featured, families, search, no-match words, an app's page, PIN TO HOME, OPEN to `#apps/<id>`, back, Recently used, the pinned Home card, and "open <app>" with and without the extra words, never taking "open radio" or a question.
- **Each archetype driven:**
  - log: stats, rings, the 7-bar chart, the reminder, all 14 field types, the required-field notice, an add shown with its money, undo and redo, the four views, and a board move;
  - checklist: tick and clear;
  - calc: live answers, an output reading an earlier one, the estimate and source, and KEEP;
  - timer: the voice switch, start, a reload mid-run, and the session kept;
  - deck: show, rate, and the due count going down;
  - counter, guide search, and screen opening `#sheets`.
- Every app in `LIBRARY` opened at 390: no page error, one scroll area, nothing sideways, every key 44 pt. Game or importer apps waiting for their lane's renderer are counted in the summary line, never passed as drawn.
- One app per archetype, plus the Library front, in all seven looks at 440 and 390.

## How to try it on the phone
1. Tap **Home**, then **Apps**, or type "apps" in the Jump bar.
2. Type "wine" in the search. Tap Wine Cellar for its page, tap **PIN TO HOME**, then **OPEN**.
3. Tap **ADD**, fill the wine, tap a colour and four stars, then **SAVE**. Try the views.
4. Go back to Apps; Wine Cellar is under Pinned and Recently used.
5. In the chat, type "open focus sessions". It opens on the phone, with no brain.

## Needs its own build
- None of the engine's archetypes was faked. The game and importer renderers belong to the PLAY & MAKE and DATA lanes.

## Left
- The Library's pinned apps are shown on its own front page as Home cards. Placing them on the Home reactor screen itself is a Home-room change for its owner.
- A system notification for a reminder while the phone is locked needs the brain's Web Push watcher. Today a reminder is said in the app's notice when it is opened.

## Landings
- 14:30 `a5cc4d54`: milestone 1 (expr, validate, applib.test, registry).
- 15:46 `c2a85c7d`: milestone 2 (the renderers, the Apps screen, glyphs, Ghosty's screens, open by name, the applib spec and its word).
- 16:31 `3c2155b2`: polish:
  - deck.spec counts Apps;
  - the hub card's readout fits;
  - the Jump bar takes "open <app>" typed whole;
  - calendar days and the back key are drawn plain;
  - check.yml's leftover merge-marker line is gone.

## Seen in targeted runs, not this lane's
- The tabs and tabs2 specs: the People pills now include GIFTS and KEEP IN TOUCH (the MEMORY lane was told), and "[finding] could not tap #pg-area-learn .hubtile[data-id=gym]".
- The brain suite's backup test: "the backup takes ghosty.people.groups" (the People lane's new store).
- The web typecheck: catalogue/learn.ts has five errors (the CAT-C lane was told).
