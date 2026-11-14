# APPLIB CAT-D: Health & food, and Family & life

Files: `packages/shared/src/applib/catalogue/body.ts` (BODY) and `packages/shared/src/applib/catalogue/life.ts` (LIFE).

## Count

| Family | Apps | From the owner's list | Invented | Archetypes |
|---|---|---|---|---|
| Health & food (`body`) | 74 | 27 apps answering 26 list entries | 47 | 31 log, 19 calc, 9 timer, 5 guide, 4 deck, 3 checklist, 3 counter |
| Family & life (`life`) | 64 | 32 apps answering 30 list entries | 32 | 44 log, 9 checklist, 4 guide, 4 timer, 3 counter |
| **Total** | **138** | **59** | **79** | |

Every app passes `apps/edge/test/applib.test.mjs` (format, lengths, field references, calc tests, glyphs, British spelling,
brand deny list).

## How the rules are kept
- **Estimates.** Every body and food calc carries `estimate: true` and a named public source, with two tests worked out by
  hand from that source: BMI and healthy range (NHS), waist-to-height ratio (NHS), daily energy (Mifflin-St Jeor 1990 with
  standard activity factors), protein (UK Reference Nutrient Intake, 0.75 g per kg), hydration (EFSA 2010 adequate intakes),
  macro calories (UK labelling energy factors 4/4/9/7), alcohol units (NHS formula, CMO 14 units), caffeine (NHS per-drink
  figures, EFSA 400 mg), oven and gas-mark temperatures, kitchen units (SI definitions), recipe scaling, baker's
  percentages, raised-bed soil volume, one-rep max (Epley and Brzycki), plate loading, exercise energy (Compendium of
  Physical Activities 2011), pace and treadmill pace (international mile).
- **No dosing, diagnosis or prediction.** Meds, Emergency Card, Parent Care and Pet Care say "exactly as the label,
  pharmacist or vet wrote it" and hold only what he types. Blood Pressure, Symptoms and Sleep Diary are logs with no
  verdicts. Baby Tracker and Growth Log never forecast. Pace Tools never predicts a race time.
- **Guides** are plain facts with an https source: Eatwell Guide, Food Labels, Activity Guide, Alcohol Guide (NHS), Food
  Safety (Food Standards Agency), After a Death, Car Seats, Register a Birth (GOV.UK), Pet Safety (PDSA; always "call your
  vet").
- **Family apps** keep only what he enters. Nobody is looked up, scored or guessed about; people in samples are invented and
  generic ("Child 1", "Aunt Maggie"). Send Later never sends: it nudges with the words ready.
- **Samples** are invented, dated around November 2026, 2 to 6 per log.

## Needs its own build (not faked)

Health & food:
- **body.2 Form Coach**: live pose estimation from the camera with joint-angle rules; no archetype can see.
- **body.57 Birds** (sound and photo ID): on-phone audio and image models. The life list is here as *Bird List*.
- **body.59 Nature ID** (live camera ID): on-phone vision models. The diary is here as *Nature Diary*.
- **body.3 Home Workouts** (animated 3-D figure, camera rep counting): the timed session is here as *Home Workout*.
- **body.4 Interval Timer** (custom coloured intervals, keep-awake, file sharing): presets are here as *Tabata*, *Boxing
  Rounds* and *EMOM Clock*.
- **body.5 Yoga Flow** (generated flows, camera alignment): a timed sun salutation is here as *Yoga Flow*.
- **body.8 Progress Photos** (ghost overlay, auto-alignment, slider and timelapse): the photo-and-measurements log is here.
- **body.9 Ride** (live GPS dashboard, auto-pause, turn-by-turn): a manual *Ride Log* is here; live tracking needs location.
- **body.16 Route Flyover**: 3-D terrain rendering and video export.
- **body.18 Night Recorder**: overnight audio capture and snore detection.
- **body.19 Soundscapes**: a multi-channel audio mixer and noise generator.
- **body.24 Food Log** (barcode, offline food table, plate photo, voice): the log with targets is here.
- **body.25 Food Scanner**: barcode lookup and label reading against a food database.
- **body.28 Dinner Timeline**: a backwards scheduler with oven and hob clash detection and self-starting timers.
- **body.30 Cooking School** (lesson tree, photo critique): the facts deck is here as *Kitchen Facts*.
- **body.31 Cocktails** ("what can I make now" matching against bar stock): *Home Bar* and *Cocktail Book* are here.
- **body.33 Diet Planner** (generated week to targets): a hand-made *Meal Planner* is here.
- **body.35 Garden Planner**: a drawn, to-scale plot with a sun model and 3-D walk-round. *Raised Bed* soil maths is here.
- **body.36 Grow Calendar** (frost dates, soil temperature from public data): the sowing log is here.
- **body.37 Houseplants** (photo naming, window light estimate): the care log with watering nudges is here.
- **body.38 Plant Doctor**: diagnosis from a photo.
- **body.43 Where Am I**: needs the phone's position, which no Library app reads.
- **body.47 Weather Maps**, **body.49 Climate**, **body.51 Tonight's Sky**, **body.52 Satellite Passes**, **body.60 Nature
  Near Me**: live public data feeds. *Stargazing Log* keeps his own observing nights.
- **body.58 Feeder Cam** (camera detection and species naming): the hour's tally is here as *Garden Bird Count*.
- **body.11 Meds** (pushes to a locked phone, adherence calendar, box reading): the taken-or-skipped log with refill
  nudges is here.
- **body.14 Run Plans** (voice cues, automatic ticking from runs): the nine-week plan and *First Run* timer are here.
- **body.21 Wind-down** (Home Assistant lights): the routine checklist is here.
- **body.22 Meditate** (guided courses in a voice): the bell timer and *Calm Breathing* are here.

Family & life:
- **life.4 Year in review**: reads across every app's data and makes story cards and video.
- **life.5 Time capsule**: true sealing (hard to open early) needs its own store; a plain log would not be sealed.
- **life.8 Family hub**: an always-on kitchen display combining calendar, chores, dinner and weather.
- **life.28 Secret Santa**: a fair draw with exclusions and pass-the-phone reveal.
- **life.30 Gift game**, **life.36 Video tribute**, **life.37 Birthday song**, **life.43 Memory films**, **life.49 3D
  gallery**: game, video, music and 3-D engines.
- **life.34 Reply helper**: needs the brain to write replies.
- **life.57 Wedding website**, and the published pages of **life.7**, **life.16**, **life.22**, **life.25**, **life.27**,
  **life.53**: publishing on APPROVE is engine work. Their working cores are here (*Family Calendar*, *Sitter Sheet*,
  *Guest List*, *Remembrance* and *After a Death*, *Wish List*, *Lost Pet*).
- **life.18 Family tree** (drawn tree, GEDCOM): the person records are here as *Family History*, honestly named.
- **life.24 Party games** (forehead tilt game, TV quiz): *Party Scores* and *Round Timer* are here.
- **life.31 Letter studio** (UK layout, signature, PDF): the sent-letters log with reply-due nudges is here as *Letter Log*.
- **life.56 Seating chart** (floor plan to scale, 3-D): guests dragged between tables on a board are here as *Table Plan*.
- **life.58 Speech coach** (teleprompter, pace and filler-word checks): the timed rehearsal is here as *Speech Timer*.
- **life.50 Travel journal** (route from photo places, map): the journal is here.
- **life.52 Dog walks** (GPS route): a manual walk log is here.

## Invented (79)
Health & food: BMI, Waist Ratio, Daily Energy, Protein Need, Hydration, Macro Maths, Alcohol Units, Caffeine Count, Oven
Temps, Gas Marks, Kitchen Units, Recipe Scaler, One Rep Max, Plate Maths, Exercise Energy, Treadmill Pace, Boxing Rounds,
EMOM Clock, Calm Breathing, Desk Stretch, Rep Counter, Five a Day, Weight Log, Blood Pressure, Sleep Diary, Health Checks,
Wine Cellar, Tea Journal, Coffee Brews, Harvest Log, Seed Box, Swim Log, Climbing Log, Hike Log, Starter Log, Cocktail Book,
Restaurant Notes, Stargazing Log, Gym Bag, Eatwell Guide, Food Labels, Activity Guide, Alcohol Guide, Food Safety, Garden
Birds, Tree ID, Muscle Map.

Family & life: Star Chart, Egg Count, Toothbrush Timer, Tidy-up Race, Growth Log, Dates to Remember, Date Nights, Story
Time, Pocket Money, Lost Teeth, Thank-you Notes, Lent Items, Gratitude Journal, Dream Journal, Kid Quotes, Fish Tank,
Volunteering, Game Nights, Film Nights, School Run, Baby Names, Clothes Sizes, Wedding Planner, Party Planner, Hospital
Bag, Moving House, Home Safety, First Aid Kit, Kids Bedtime, Pet Safety, Car Seats, Register a Birth.
