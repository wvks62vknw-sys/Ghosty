# APPLIB CAT-E: Money & home, and Utilities

Files: `packages/shared/src/applib/catalogue/money.ts` (MONEY) and `packages/shared/src/applib/catalogue/tools.ts` (TOOLS).
Every app passes `validate.ts` (apps/edge/test/applib.test.mjs), and every calc's tests were worked out from the source it
names. UK rates are for the 2026 to 2027 tax year (6 April 2026 to 5 April 2027), checked against GOV.UK's
"Rates and thresholds for employers 2026 to 2027" and its income tax, dividend, CGT, SSP, minimum wage and redundancy pages.

## What landed

**Money & home: 85 apps.**

- **Logs:** receipts, envelope budget, net worth, subscriptions, spending diary, savings pots, IOUs, meter readings, home inventory, pocket money, giving log, payslips, invoices, quotes, business books, stock and orders, business posts, sales log, post room, better deals, claim it, price book, big purchase, returns tracker, home upkeep, appliances, storage boxes, renting, DIY projects, renovation budget, car shortlist, fuel log and parking log.
- **Calcs:** monthly budget, coin count, savings tax, child benefit charge, emergency fund and gas units.
- **Loans and property:** mortgage, overpayments, remortgage check, loan repayments (APR), debt payoff, savings growth, inflation, stamp duty (England and NI, three buyer types), Lifetime ISA, pension planner, rental yield and rent split.
- **Tax and work:** self-employed tax (income tax and Class 4), gains tax, dividend tax, gift aid, margin and markup, break-even, offer compare, redundancy pay, sick pay and minimum wage.
- **Home and car:** energy use, charging cost and car costs.
- **Build:** paint, tiles and slabs, flooring, wallpaper, concrete (with a 1:2:4 mix), gravel, topsoil and mulch, turf, bricks, fence, stud wall, timber and loft insulation.
- **Checklists:** tax return list, moving house and used car check.
- **Guides:** help finder, interview prep, dashboard lights and gov services.
- **Timer:** answer practice.

**Utilities: 46 apps.**

- **Sums:** take-home pay (income tax with the allowance taper, NI, pension, student loan plans 1, 2, 4 and 5, postgraduate), VAT, tip and split, discount, percent sums, unit price, trip fuel cost, pay converter, ratio scaler, shift hours, currency sums, speed and time, height by angle, password strength, screen density, room area, ladder angle, average, fractions and bulb swap.
- **Converters:** length, weight, volume, area, speed, temperature, data size, pressure, energy, power, time units and angles.
- **Timers:** deep work, screen break, power nap and tidy sprint.
- **Counters:** tally counter, lap counter, door count and stock take.
- **Checklists:** emergency kit, digital tidy and car kit.
- **Logs:** countdowns, parcels and key holders.

**Invented beyond the lists:** at least 30 per family. Money's include subscriptions, IOUs, savings pots, meter readings, home inventory, gift aid, dividend tax, savings tax, child benefit charge, rental yield, rent split, the build calculators and charging cost. Utilities' are the converters, timers, counters, checklists and small logs.

## Covered by another lane's app (not repeated here)

Several list items were already landed by the Office lane (CAT-A) for the same job, so they were dropped from this lane:

| List item | Covered by |
|---|---|
| money.20 Clients | office `client-pipeline` |
| money.52 Job Search (tracker core) | office `job-hunt` |
| money.13 Mileage Log | office `mileage-log` and `mileage-rates` |
| money.56 Work Rights (holiday and notice) | office `holiday-allowance` and `notice-period` |
| money.24 Pricing (day rate) | office `day-rate` |
| tools.35 Clipboard (snippets core) | office `snippets` |
| tools.39 Focus | office `focus-sessions` |

Also left out because another lane already had the same job:
- the meeting timer, paper sizes and timesheet (office);
- download time (maker);
- aspect ratio (create);
- the wishlist and speech timer (life);
- the phonetic alphabet, Morse code, fuel economy and leaving home (learn and world).

## Needs its own build

Each of these needs engineering or device access that no archetype gives truthfully:

| App | Why |
|---|---|
| money.11 Receipts (reading) | The log works; reading the photo into shop, items and VAT needs on-phone OCR. |
| money.53 CV Studio | Needs designed templates, a page-layout PDF engine and ad matching. |
| money.58 Post Room (reading) | The log works; scanning and reading letters needs OCR. |
| money.6 Money Sheets | Needs two-way sync with Sheets and MONEY. |
| money.22 Business Hub | A dashboard across several apps' data; no archetype reads another app. |
| money.25 Contracts | Templates, drawn signatures and a signed PDF; also too close to legal advice for a guide. |
| money.42 Paint Visualiser | Needs a downloaded segmentation model and live camera work. |
| money.43 3D Home Designer | A 3-D engine. |
| money.50 Car Workshop 3D | A 3-D engine with exploded parts. |
| money.51 Parking & Charging (map) | The log works; a map of car parks and chargers needs live public data. |
| money.52 Job Search (feeds) | Morning fetch from public boards needs a fetch worker. |
| money.54 Interview Coach (camera) | The guide and timer work; video, speech pace and filler-word scoring need their own build. |
| money.8 / money.1 live figures | Ofgem cap and House Price Index lookups need live public data; the logs work. |
| tools.36 Clock | Alarms by push, world clock, stopwatch with laps. |
| tools.16 Calculator | An expression keypad with an editable tape. |
| tools.1 Book Scanner | Camera, page flattening, OCR. |
| tools.3 Cards | Camera and barcode drawing. |
| tools.5 Text Grabber | OCR on photos. |
| tools.7 Distance & Height (sensor) | Height By Angle does the sum; reading the tilt needs the motion sensor. |
| tools.9 Map Measure | Map drawing and GPS. |
| tools.11 Speedometer | GPS. |
| tools.13 Video Converter | FFmpeg in WebAssembly. |
| tools.15 Date Calculator | Needs date inputs and the bank holiday list; calc inputs are numbers only. |
| tools.17 Math Notes | A free-text sum parser. |
| tools.25 QR Studio | Code generation and drawing. |
| tools.26 Scan to Sheet (scanning) | Stock Take counts; scanning barcodes needs the camera. |
| tools.27 Link Checker | Needs the brain to follow links. |
| tools.31 Metadata | File parsing. |
| tools.33 Nearby Send | WebRTC. |
| tools.41 Compass | The magnetometer. |
| tools.42 Sun & Moon | Camera overlay and solar position. |
| tools.44 Waypoints | GPS. |
| tools.46 Magnifier | Camera. |
| tools.49 Seeing Assistant | Camera and vision models. |
| tools.50 Live Captions | Speech recognition. |
| tools.51 Sound Alerts | Microphone and a classifier. |
| tools.53 Sound Meter | Microphone. |
| tools.56 Torch | Torch and screen light. |
| tools.57 Random | Needs a random generator; no archetype draws random numbers. |
| tools.58 Speed Test | Network measurement. |
| tools.59 Passwords (generator and leak check) | Password Strength does the sum; generating with crypto.getRandomValues needs a generator archetype. |
| tools.60 Teleprompter | Scrolling text and camera recording. |
| money.41 DIY Toolbox (level, ruler, sound meter) | The motion sensor and screen calibration; the quantity calculators are in. |

A small "generator" archetype (passwords, passphrases, dice, coins, picks from a list, all drawn with crypto.getRandomValues) would turn tools.57 and the tools.59 generator into data apps. That is a suggestion for the ENGINE lane.

## Notes for the engine

- Calcs return 0 for "never" in a few places (debt payoff when the payment is below the interest, break-even when the price does not beat the cost). The output labels say so through the tour.
- `ceil` on exact products is wrapped in `round(x, 6)` where floating-point dust could add one (overpayments, stud wall boards).
- Password strength shows the years to guess as a power of ten, because the true figure overflows any display.
- The engine shows a calc's first output as its headline and uses it for KEEP, so every calc leads with its main answer. A small `lead()` helper in each file moves that output to the front and writes the earlier outputs it reads into its expression, so runCalc's order still holds.
- Meter Readings is a plain dated log of readings with photos. Household (the `homeadmin` screen) is the full screen for bins, bills and what is due. If the ENGINE lane thinks they overlap, Meter Readings is the one to drop.

## Checked in the preview

All 131 apps opened at `#apps/<id>` with no page or console errors. Screenshots of a log (Receipts), a board (Invoices), calcs (Take-Home Pay, Paint Calculator, Length), a checklist, a guide, a counter and a timer looked right at 440 wide. After that pass:
- board rows no longer repeat their column name;
- collections with no sample photos open as a list rather than a gallery.
