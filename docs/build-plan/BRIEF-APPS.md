# APPS: "I'd also like Ghosty to be able to make APPS" (OWNER-ISSUES 5)

Ghosty builds websites (the website builder: `packages/shared/src/sitekit/**`, `apps/edge/src/sitebuild.ts`,
`apps/edge/src/tools/sites.ts`, published at `/s/<name>` through `sites.ts`'s page frame; just reviewed and fixed, see
BRIEF-WEBSITES-FIX.md) and instant widgets on GK, the widget kit (`apps/web/public/widget-kit.js`, `widget-host.*`,
`apps/edge/src/tools/widgets.ts`), and its handbook carries a single-file **app page kit** (`apps/edge/src/knowledge/appkit.ts`:
design tokens, glass cards, 44 px buttons, toast, modal, saved state, nothing fetched). Read BRIEF-W0.md, HANDOFF.md
(the owner's rules; the website builder notes), MAP.md's entries for all of the above, and how published pages are
served and sandboxed (`sites.ts`: the outer `/s/<name>` page, the inner `/s/<name>/page`, the frame's sandbox and CSP,
`PAGE_CSP`; `apps/web/public/_headers` is protected and stays as it is).

The owner wants to say "make me an app that tracks my water intake" or "a tip calculator for the group" and get a real
mini-app: one main purpose, works offline, remembers its state on the phone, installs to the Home Screen with its own
icon, looks premium, and works first time. Honest about what it is: a single-file web app on his Ghosty, not an App
Store app.

Other builders are restyling `features/*` and building the stopwatch and the YouTube tool. Work ONLY in: new
`packages/shared/src/appkit/**` (the kit: templates, blocks, gates, write), new `apps/edge/src/appbuild.ts`,
`apps/edge/src/tools/sites.ts` (register `build_app` beside `build_website`; the published-page routes for the
manifest and icon), `apps/web/public/widget-host.js` and `widget-host.html` ONLY if the frame needs a message for saved
state or install, `apps/edge/src/knowledge/appkit.ts` (keep the handbook truthful), the edge tests (`sitekit.test.mjs`
or a new `appkit.test.mjs` run through an existing file), `tests/websites.spec.mjs` or a new `tests/apps.spec.mjs`
(say which; the CI loop is protected: the orchestrator adds it), MAP.md. No protected files (`tools/index.ts` holds
the sites group's line: report the words you need; `index.ts`/`_headers`: report, never edit).

## Build

1. **The app kit** (`appkit/`): a single-file app built from the handbook's kit and route C's language (graphite
   black, one accent, glass cards, 44 px targets, SF type): a small set of app shapes with real logic, each a template
   with options, e.g. a tracker (count or amount per day with a goal, history, streak), a list (to-dos, shopping, packing;
   check off, reorder, clear done), a timer or routine (steps with durations, start/pause, a bell), a calculator or
   converter (tips, splits, units, fuel), a counter or scoreboard, a habit grid, a notes pad, a flash-card deck, a
   simple game (reuse GK where it helps). Every app: saved state that survives a reload and a day away (on the phone),
   UNDO on destructive actions, empty states, no network needed, no model at run time. A brief (`appkit/brief.ts`)
   reads the owner's request into shape, name, fields, goal, units and look, asking at most two plain questions when
   something essential is missing.
2. **Install to the Home Screen**: the app is published at `/s/<name>` like a site, with its own
   `manifest.webmanifest` (name, short name, start_url and scope under `/s/<name>/`, display standalone, theme and
   background colours, icons generated as SVG/PNG with the app's glyph and accent) and served so iOS and Android can add
   it from the share sheet; it works offline after the first open (the app shell's service worker caches the app's
   page, or the app carries its own tiny service worker if the frame allows: find what the current serving and sandbox
   permit, make saved state and offline really work, and say exactly how in the report). If installing a sandboxed
   framed page cannot work on iOS, say so plainly and make the best honest alternative (a direct, same-origin app page
   with a strict CSP of its own) with the orchestrator's review of any security change.
3. **`build_app`** (`appbuild.ts`, registered in `sites.ts`): a resumable project like `build_website`'s: brief →
   plan (the approval shows the app in plain words: what it does, what it saves, the two questions if any) → build on
   the kit (no model writes the logic; the model writes only the words and picks options) → `check_html` and the
   kit's gates (no errors ever publish) → publish → report with the link, the install steps ("Share → Add to Home
   Screen") and a WHAT IT DOES line; UNDO = unpublish. The chat reply shows a card (reuse the site card through the
   existing hooks: no new interface files beyond what the site card already renders; say if one line is needed).
4. **Quality loop**: every template is exercised by tests on real logic (a tracker's day rollover, a list's reorder,
   a timer's pause); a browser spec installs an app in the preview (opens the published page, checks the manifest,
   saves state, reloads, state is there, goes offline with `context.setOffline(true)` and the page still works).
5. **Honesty**: the approval and the report never claim App Store, notifications or background work; if a request
   needs a server, a login or live data, the reply says so and offers the nearest app that works.

## Tests (each must fail on the old code)

The brief reader on ten requests; each template's logic; the gates; the manifest and icon routes; the project's
steps with a scripted model and the mocked store; the spec above. Then tsc, `npm run check`, prompt budgets, the full
edge `npm test` once (≈ 16 min on this shared machine), the spec on port **8814**.

## Finish

Commit on your worktree branch, often (do not push, do not merge). Final report: how install and offline really work
and on which platforms (tested in Chromium; iOS by reasoning, stated honestly); the words needed in the sites group's
line; the CI spec name; tests and proof; every check's exact result; screenshots; anything not done and why.
