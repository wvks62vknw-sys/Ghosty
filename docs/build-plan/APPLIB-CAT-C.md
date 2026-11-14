# APPLIB CAT-C: Learning and Travel & world

Files: `packages/shared/src/applib/catalogue/learn.ts` (LEARN) and `packages/shared/src/applib/catalogue/world.ts` (WORLD).

## What is in

**Learning (72 apps).**
- From the list, with `from`:
  - Periodic Table (learn.19): a guide to all 118 elements; group, period and block are worked out from the atomic number, not typed.
  - Music Theory (learn.36), Practice Log (learn.39), Memory Palace (learn.53), Exam Planner (learn.54).
  - Highway Code (learn.55): written from the public text and labelled as not the official bank.
  - Typing Arcade (learn.56), Course Tracker (learn.48), Listening Log (learn.50), Gallery Visits (learn.43), Coding Log (learn.33).
- Scripts: Greek, Cyrillic, Hiragana, Katakana, Arabic, Urdu, Hangul. These give the reading half of learn.4; the tracing half needs its own build.
- Maths calcs: Quadratic Solver, Triangle Solver, Circle and Sphere, Weighted Grade. Maths decks: Times Tables, Squares and Roots, Roman Numerals, Maths Formulas. Times Tables, Squares and Roman Numerals are generated in code, not typed by hand.
- Statistics: Z-Score (normal percentile by Abramowitz and Stegun 26.2.17), Margin of Error, Hardy-Weinberg.
- Physics and electronics: Ohm's Law, Resistor Network, LED Resistor, Pendulum, Projectile, Motion Equations, Energy and Power, Speed of Sound, Drag Force, Light Travel Time. Every engineering figure is marked `estimate`.
- Chemistry: Molar Mass, Dilution, Ideal Gas, Half-Life, Element Cards, SI Units (a BIPM guide), Constants.
- Music: Note Frequency, Tempo Converter, Practice Routine (timer), Clean Runs (counter).
- Knowledge decks: Planets, Bones of the Body, Morse Code, Major System, Fallacies, History Dates, British Monarchs, the four Capitals decks, Latin Phrases, Word Roots, Git Commands, HTTP Status Codes, Big O.
- Logs and lists: Reading List, Study Log, Vocabulary Book, Lab Notebook, Language Daily, Exam Day.

**Travel & world (61 apps).**
- From the list, with `from`:
  - Trips (world.13), Tickets & Passes (world.16), Car Logbook (world.45), Trip Spend (world.23), Packing (world.15).
  - Travel Papers (world.17): the document and renewal half.
  - Hikes (world.3): the record half.
  - Commute Times (world.8): his real journey times.
- Calcs, all on his own numbers with nothing sent anywhere:
  - Time Zones: IANA offsets, with summer and winter listed apart where the clocks change.
  - Currency: at his own rate, plus any card fee.
  - Tip and Split, Travel Units (Weights and Measures Act 1985 definitions).
  - Fuel Cost, Fuel Economy, EV Charge Cost.
  - Mileage Claim: HMRC approved rates.
  - Great Circle (haversine), Walking Time (Naismith), Summit Temperature (ICAO lapse rate), Wind Chill (JAG/TI index).
- Phrasebooks for 16 languages, each in its own script with a romanisation after non-Latin scripts: French, Spanish, German, Italian, Portuguese, Dutch, Greek, Turkish, Polish, Russian, Arabic, Urdu, Hindi, Japanese, Mandarin, Korean.
- Decks: Phonetic Alphabet, World Currencies, Dialling Codes, Emergency Numbers, Driving Sides.
- Guides:
  - Plug Types (IEC World Plugs)
  - Beaufort Scale (Met Office)
  - Cloud Spotter (Met Office)
  - Countryside Code (GOV.UK)
- Logs: Places Visited, Flight Log, Rail Journeys, Summits, Sky Log, Travel Journal, Bucket List, Stays, Where I Parked.
- Checklists: Hiking Kit, Before You Fly, Leaving Home, Car Check (weekly), Winter Car Kit, Camping Kit.
- Timer: Driver Breaks, from Highway Code rule 91.

No app reads location. Great Circle and Time Zones take only what he types.

## Needs its own build

These apps from the two lists have no archetype that gives them a true core. They are not faked here.

### Learning
- learn.1 Language Path: a full course needs placement, exercise types, audio and grading (Ghosty's own Learn screen covers it; the ENGINE lane lists it).
- learn.8 Dictionary: needs downloaded Wiktionary and WordNet packs, plus hold-to-look-up across Ghosty.
- learn.12 Maths Solver: symbolic algebra needs a computer-algebra engine. Quadratic Solver and Triangle Solver cover the closed-form cases.
- learn.11 Graphing Calculator: needs a live plotting canvas.
- learn.28 How Things Work: 3-D animated mechanisms.
- learn.46 Offline Libraries: multi-gigabyte pack downloads and search.
- learn.52 Card Maker: needs reading of photos, PDFs and pages, then a review step.
- learn.2 Speaking Partner: needs live speech and the brain in the loop.
- learn.3 Graded Reader: needs tap-a-word text parsing and per-word state.
- learn.4 Script Trainer (tracing half): stroke-order data and handwriting marking. The reading half is the seven script decks.
- learn.5 Pronunciation: needs on-phone speech scoring and pitch contours.
- learn.6 Sign Language: needs camera hand tracking.
- learn.13 Geometry: needs a construction canvas.
- learn.14 Maths Path: needs generated questions and a skill map. Times Tables and Squares and Roots are the drill part.
- learn.16 Statistics Lab: needs simulations and reading of his sheets. Z-Score and Margin of Error are the calc part.
- learn.17 Physics Sandbox: needs a physics engine. The physics calcs are the formula part.
- learn.18 Circuit Lab: needs a circuit simulator. Ohm's Law, Resistor Network and LED Resistor are the formula part.
- learn.20 Molecule Lab: needs 3-D molecules and an equation balancer. Molar Mass, Dilution and Ideal Gas are the calc part.
- learn.21 Anatomy 3D: needs 3-D models. Bones of the Body is the naming part.
- learn.23 Atlas: needs the globe and map quizzes. The Capitals decks are the fact part.
- learn.24 Life Science Lab: needs simulations. Hardy-Weinberg is the calc part.
- learn.25 Sensor Lab: needs live motion, microphone and camera readings.
- learn.26 Wind Tunnel 3D: WebGPU flow. Drag Force is the formula part.
- learn.30 Learn to Code: needs code run against hidden tests.
- learn.32 Algorithm Visualiser: animated algorithms. Big O is the fact part.
- learn.37 Ear Trainer: needs audio playback and pitch detection.
- learn.38 Sight Reading: needs generated notation and note detection.
- learn.39 Practice Room (metronome, tuner, drone, looper): live audio. Practice Log, Practice Routine and Clean Runs are the log part.
- learn.42 History Atlas: needs a map with a year slider and live Wikidata. History Dates and British Monarchs are the fact part.
- learn.44 Archive Explorer: live archive search.
- learn.45 History Around Me: region packs and on-phone place matching.
- learn.47 Textbooks: book downloads and a reader.
- learn.49 Daily Bites: a daily illustrated lesson made fresh.
- learn.57 Knowledge Graph: a graph built from all his data.
- learn.58 Skill Tree: prerequisite trees from public curricula.
- Partly covered here, with the rest needing its own build:
  - learn.43 Museums: live open-collection browsing and deep zoom.
  - learn.48 Lecture Hall: lecture video and transcripts.
  - learn.50 Audiobooks: the catalogue and player.
  - learn.33 Code Challenges: running his code against tests.
  - learn.56 Typing Arcade: the word-shooter game. The engine's typing kind is the core.

### Travel & world
- world.1 Navigate: live turn-by-turn routing.
- world.26 News: live feeds and a reader.
- world.4 Live trains: live departure data.
- world.49 Offline atlas: map packs and on-phone routing.
- world.35 Night sky: a live sky chart from the phone's orientation. Sky Log and Planets are the log and fact parts.
- world.2 Road trip: routing, places within a detour, weather along the way. Fuel Cost and EV Charge Cost are the cost part.
- world.5 Bus times: live countdowns.
- world.6 Line status: live line data.
- world.7 Bike share: live dock feeds.
- world.9 Flights: live aircraft tracking.
- world.11 Ships & ferries: live vessel data.
- world.12 Tides & sea: live tide gauges and forecasts.
- world.19 Offline guide: the downloaded guide and its map.
- world.20 Audio guide: nearby landmarks, which need position matching on the phone.
- world.24 Price lens: live camera text reading. Currency is the conversion part.
- world.28 News globe: live event data on a globe.
- world.32 Scores: live sports feeds.
- world.33 F1 live: live timing.
- world.34 World webcams: live camera feeds.
- world.36 Launches: a live launch schedule.
- world.37 Aurora & dark sky: live space-weather and cloud data.
- world.38 Solar system: 3-D bodies at their real positions.
- world.39 Space today: live picture of the day and crew lists.
- world.44 Where can I go: timetable reach maps and climate data.
- world.48 Peak finder: terrain rendering matched to the camera.
- world.50 Earth now: live satellite imagery.
- Partly covered here, with the rest needing its own build:
  - world.13 Trips: the map, travel times and weather.
  - world.16 Tickets & Passes: crisp barcode redraw from a PDF.
  - world.17 Travel Advice: live FCDO summaries and change alerts.
  - world.23 Trip Spend: who-owes-whom settling.
  - world.3 Trails: route planning and follow mode.
  - world.8 Commute: live comparison and push.
  - world.45 Car Logbook: the public MOT history look-up.
  - world.15 Packing: a list built from the forecast.

## Checks
- `npx tsc --noEmit --strict` over `packages/shared/src/applib/index.ts`: clean.
- A local check of the brief's rules ran over both files: lengths, Title Case, labels, fields referenced, sample choices, British spelling, no "!" or emoji. It also evaluated every calc test from its expression. All clean.
- The ENGINE validator test (`apps/edge/test/applib.test.mjs`) runs once it lands on the integration branch.
