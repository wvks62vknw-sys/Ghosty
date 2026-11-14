# APPLIB CAT-A: the Office and Maker families

Lane `claude/new-session-4erjve-lane-applib-a`. Files: `packages/shared/src/applib/catalogue/office.ts` (OFFICE) and
`packages/shared/src/applib/catalogue/maker.ts` (MAKER).

## What landed

**93 apps: 46 Office and 47 Maker.**

### Office from the owner's list (16)

| List | App | Archetype | Its working core |
|---|---|---|---|
| office.41 | Day Planner | log | Time blocks with start and estimate. The ring warns past 8 hours today. Calendar and board views. |
| office.49 | Read Later | log | Links with site, minutes, status, tags and highlights. Minutes queued. |
| office.1 | Writer | log | Scenes as cards (chapter, viewpoint, synopsis, status, words, draft). A board corkboard, a weekly word goal and a writing streak. |
| office.5 | Citations | log | Sources with every Harvard part. Each row reads as a reference: "Author (Year) Title", "Place: Publisher". |
| office.24 | Capture | log | One line first, a kind later. An inbox grouped by what each line becomes. |
| office.30 | Checklists | checklist | Moving house, a car check before its test (the GOV.UK things-you-can-check list), and a move-in inventory. |
| office.34 | Projects | log | Tasks with project, status board, priority, due date reminders, milestone and progress. |
| office.35 | Goals | log | Key results with target, current, progress, status board and check-in reminders. |
| office.36 | Event Planner | log | Dated jobs by category, with an estimate-against-actual budget. Guests are the Life family's Guest List. |
| office.37 | Timesheet | log | Entries with project, client, length, billable flag and rate. A 37.5-hour weekly ring and CSV out. |
| office.38 | Shifts | log | Shifts on the calendar with kind, break, overtime and bank holiday. Weekly hours. Pay is worked out in Overtime Pay. |
| office.40 | Snippets | log | Replies with short code, folder and [blanks]. |
| office.43 | Meeting Notes | log | Agenda, notes, decisions, actions and a follow-up reminder. |
| office.46 | Habits | log | One-tap ticks, a streak, a five-a-week ring and a calendar heat map. |
| office.50 | Highlights | log | Passages with source, page, theme and stars, in a gallery. The file import is the DATA lane's job. |
| office.52 | Books | log | Shelves board, covers gallery, pages and a 24-books-a-year ring. |

### Office invented (30)
- **Logs:** Client Pipeline, Job Hunt, Decision Log, Expense Claims, Mileage Log, Leave Tracker, Brag Book, Idea Bank, Priority Matrix, Standup Notes, CPD Log, Waiting For.
- **Calcs:**
  - Overtime Pay, Holiday Allowance and Notice Period, from GOV.UK and the Employment Rights Act s.86;
  - Mileage Rates, from the HMRC approved mileage allowance;
  - Meeting Cost and Day Rate, simple proportion;
  - Reading Time, from Brysbaert 2019: 238 wpm silent, 183 aloud;
  - Writing Pace.
- **Timers:** Focus Sessions, Meeting Timer.
- **Checklists:** Weekly Review, Daily Shutdown, Desk Setup.
- **Counter:** Work Tally.
- **Guides:** Paper Sizes (ISO 216 and 269), Clear Writing (GOV.UK style guide).
- **Decks:** Tricky Spellings, Word Pairs.

### Maker from the owner's list (5 whole apps, plus parts of 7 more)

**Whole apps:**
- **maker.46 Parts Bin:** a log of parts with kind, value, package, quantity, low mark, location, cost and photo.
- **maker.55 Print Lab:** split into three apps:
  - Filament Spools (log);
  - Print Log (log);
  - Print Cost (calc).

  The photo diagnosis needs the brain and is not faked.
- **maker.42 Electronics Toolkit:** its calculators, one app each, each with tests:
  - Resistor Bands (IEC 60062);
  - Ohm's Law;
  - LED Resistor;
  - Voltage Divider;
  - Astable Timer (the 555);
  - Op-Amp Gain;
  - RC Filter;
  - Capacitor Code;
  - Battery Life;
  - Battery Pack;
  - Trace Width (IPC-2221);
  - Wire Gauge (ASTM B258).

  The Lens resistor reading and the pinouts are not included.
- **maker.45 Power Planner:** Solar Sizing (calc): panel watts, battery Wh and Ah. The free sun-data lookup needs a network call, so he types the sun hours.

**Parts only.** The rest of each app is under "needs its own build":
- maker.15 Dev Toolbox: Colour Contrast (WCAG 2.2) and File Permissions (POSIX chmod).
- maker.18 Network Tools: Subnet Calculator (RFC 4632 and 3021).
- maker.51 Laser & CNC: Spindle Speeds, the feeds and speeds calc.
- maker.53 Structure Lab: Beam Deflection (the American Wood Council's DA6 beam formulas).
- maker.14 Regex Lab: Regex Guide (MDN).
- maker.8 Dev Docs: HTTP Status (MDN).
- maker.41 Logic Lab: Logic Gates (deck).

### Maker invented (beyond the parts above)
- **Calcs:** Stepper Steps (RepRap), Filament Length, Gear Ratio, Tap Drill (ISO 261), Download Time (SI).
- **Logs:** Build Log, Workshop Tools, Bug Tracker, Side Projects, Changelog, Code Snippets, Today I Learned, Domains.
- **Checklists:** Printer Upkeep, Ship Checklist.
- **Guides:** Version Control (git reference), Cron Syntax (crontab(5)), Markdown Guide (CommonMark).
- **Decks:** Binary Powers, ASCII Codes, Network Ports, Algorithm Costs.

**Rules kept:**
- Every engineering, money, power or build figure sets `estimate: true`.
- Beam Deflection's tour sends anything structural to an engineer.

## Needs its own build (never faked)

### Office
- **office.26 PDF Studio:** page rendering, annotation written into the file, redaction and compression need a PDF engine.
- **office.39 Mail:** a live mailbox needs an account connection and sending, which no archetype gives.
- **office.20 Notes:** Ghosty's own notes and workspace screen (ENGINE's `screen` entries). Sketches, scans and locked notes need their own editor.
- **office.3 Proofread:** an on-phone grammar engine (WebAssembly) running inside every editor.
- **office.28 Scanner:** live edge detection and OCR on camera frames. Ghosty's scan screen is ENGINE's `screen` entry.
- **office.6 Templates:** designed documents filled into the Documents, Sheets and Slides engines.
- **office.4 Dictate:** live speech to text in every editor.
- **office.2 Publisher:** a page-layout canvas with print export.
- **office.7 Mail Merge:** templating over sheet rows into PDFs and an APPROVE send card.
- **office.10 Labels:** print layout on exact label sheets with calibration.
- **office.11 Database:** linked tables, lookups and automations. App Maker covers single tables.
- **office.12 Dashboards:** charts over other apps' data.
- **office.17 Instant Deck:** a deck from the brain into the Slides engine.
- **office.18 Video Presenter:** camera and screen recording.
- **office.21 Ink Notebook:** pen ink with pressure on pages.
- **office.25 Outliner:** endless nesting, zoom and mirrors. A log is flat.
- **office.29 Forms:** a form builder with skip logic and kiosk mode.
- **office.31 Whiteboard, office.32 Diagrams, office.33 Mind Map:** free canvases.
- **office.42 Booking Page:** a published page that reads free and busy times. It needs APPROVE and hosting.

### Maker
- **maker.23 Site Editor, maker.26 Link Page, maker.27 Docs Site, maker.28 Blog:** publishing and visual page editing.
- **maker.31 Flows, maker.25 Ability Builder, maker.32 House Automations:** trigger and step engines that run actions.
- **maker.1 Code, maker.3 Notebooks, maker.5 Terminal, maker.6 Ghosty Console:** editors and runtimes (WebAssembly kernels, a shell).
- **maker.4 Repos, maker.7 Code Review:** git over the network and the brain.
- **maker.8 Dev Docs:** downloadable doc packs with fuzzy search. HTTP Status is one small offline guide.
- **maker.10 API Studio, maker.11 Mock Server, maker.12 Webhook Inbox:** live HTTP.
- **maker.13 JSON Studio, maker.14 Regex Lab, maker.16 Diff, maker.36 Data Cleaner:** live parsing of his text. The expression language has no strings.
- **maker.15 Dev Toolbox:** encoders, hashes, JWT and UUID all work on text. Only its number tools fit a calc.
- **maker.17 SQL Lab:** SQLite in WebAssembly.
- **maker.18 Network Tools, maker.19 Uptime & Status, maker.20 Site Audit, maker.21 Page Watch:** live network checks. Only the subnet maths is offline.
- **maker.22 Brain Console, maker.29 Model Playground, maker.30 Model Trainer:** the brain and the camera.
- **maker.24 App Builder:** the PLAY & MAKE lane's App Maker.
- **maker.34 Chart Studio, maker.35 Map Maker:** chart and map canvases.
- **maker.40 Arduino Sim, maker.41 Logic Lab, maker.43 Scope & Signal:** simulators, and the microphone. Logic Gates teaches the truth tables.
- **maker.44 PCB Viewer, maker.47 Part Designer, maker.48 Blocks, maker.49 Code CAD, maker.50 Drafting, maker.52 Mesh Fixer, maker.54 Slicer, maker.56 Make-it Generators:** 2-D and 3-D geometry engines.
- **maker.51 Laser & CNC:** the box maker, toolpaths and G-code. Spindle Speeds covers the cutting numbers.
- **maker.53 Structure Lab:** a 2-D frame solver drawn by finger. Beam Deflection covers the single span.

## Checks
- `npx tsc --noEmit --strict ... packages/shared/src/applib/index.ts`: clean.
- A lane-local check, before the validator landed, covered:
  - every calc test worked through the expressions;
  - lengths, Title Case, tours of 70 characters or fewer, field references, sample keys and choice values;
  - British spellings, and no "!".

  Result: 0 problems.
- The validator (`apps/edge/test/applib.test.mjs`) is run at each landing once it is on the integration branch.
