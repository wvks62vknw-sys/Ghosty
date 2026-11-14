# NEXT ROUND: BODY AND KITCHEN (lane-body)

This round, the kitchen and the body work as one coach. Recipes, pantry, shopping list, water, sleep, workouts and tablets now
feed each other, and patterns from your own numbers are told as what happened, never as advice or a forecast. Every health or
food number is a rough estimate. All of it is kept on your phone, except the few things that have to go to your brain, which
are named below. It is proved by `tests/bodynext.spec.mjs` at 440 × 956 and 390 × 844, and its word `bodynext` is last in
check.yml's `all=`.

## What I built

### 1. The meal plan writes the shopping list (body.u10)
- **KITCHEN → MEAL PLAN**
  - Each day suggests the names in your recipe book as you type.
  - **FILL THE EMPTY DAYS** plans the days you left blank from your book. The ones your pantry covers most come first, then the
    ones that use something going off soon. No dinner appears twice, and the days you planned yourself stay as they are.
  - **SHOPPING FOR THE WEEK** puts everything the week's recipes need on the shopping list, each thing once, leaving out what
    the pantry already has. It tells you what the pantry covered, and names any dinner that isn't in your book.
  - Each planned dinner shows its rough calories per serving, plus the week's average (see 9).
- In the chat: "plan my dinners", "shopping for the week", "put the week's meals on the list".

### 2. Tablet and supplement reminders that reach a locked phone (body.s1)
- **BODY → Health → TABLETS**
  - Add a tablet with its dose, its times ("8am, 8pm") and how many are in the packet.
  - Today's doses are listed in time order, each with TAKEN and SKIPPED, plus the last seven days' count.
  - **Refill countdown:** how many days the packet lasts at your times, and the date it runs out. "Refill soon" shows at seven
    days, and REFILLED adds a new packet.
  - **Lock-screen reminders:** an iPhone pauses Ghosty when it's hidden, so each time of day is a daily reminder on your brain's
    clock, which arrives as a notification. Your brain gets only the time and "Time for your tablets". It never gets the
    tablet's name unless you turn on NAME IN THE REMINDER, and it never learns what you took or skipped.
- In the chat: "I took my tablets", "skipped my evening tablet", "did I take my tablets?", "open my tablets".

### 3. Finished from last round
- **Water nudges on the lock screen** (body.u1). With nudges on, your brain gets the rest of today's nudge times (inside your
  nudge hours, never in your quiet hours, none once you're on track) and the line "Time for a glass of water." It never gets an
  amount. Each drink you log takes back the old times and sends new ones. LOCK SCREEN is a switch in the Nudges fold.
- **Steps from Health each evening.** Steps now has a fold, STEPS FROM HEALTH, EACH EVENING: four steps to make a Shortcut once
  in Apple's Shortcuts app, and a COPY THE LINK key. Each evening the Shortcut opens `…/#body?steps=8421`. The number becomes
  today's steps from Health, replacing the Shortcut's earlier number that day and never adding to steps you typed.

### 4. Hands-free cooking (body.u12, ci.s1)
- In a recipe, tap HANDS-FREE. Each step is read out, and you can say "next", "back", "repeat" or "timer" with messy hands.
  A step that names its minutes starts its timer as it is read, and "stop listening" ends it. Your phone's own speech
  recogniser does the hearing, only while hands-free is on, and it is paused while a step is read so Ghosty never hears itself.

### 5. Your week (body.u4, u3, u5): BODY → Health → YOUR WEEK
- **The Sunday review.** The last seven days of water, sleep, steps, weight, mood and tablets side by side, with your best day
  picked out (the most goals met; a better mood breaks a tie). On Sundays it's headed "Your Sunday review".
- **Sleep score.** One rough number out of 100: half from how long you slept against your goal, 30% from how regular your
  bedtimes are, and 20% from the week's sleep debt. Each part is shown separately.
- **Wind-down nudge.** Half an hour before your own usual bedtime (worked out from your GOING TO BED nights), it arrives as a
  daily reminder on the lock screen. Only the time goes to the brain.
- **Patterns.** For example: "On the 10 days you walked 8,000 steps or more, you slept 60 min longer that night on average than
  on the 10 days you walked less." These come only from your own last 60 days, and only when each side has at least three
  days. They are always said as what happened, never as advice or a forecast.
- In the chat: "how was my week?", "my sleep score", "any patterns?".

### 6. Mood with tags and a line (body.u13)
- **Mood** now has tags (work, family, friends, exercise, outdoors, slept badly, stressed, unwell, rest) and a line of your own
  for the day. Underneath, it shows which tags came with your good days this month, and Patterns says it too.

### 7. Coffee, tea, juice and drinks (body.u2)
- **Water → COFFEE, TEA AND MORE**
  - Coffee, tea, juice and cola count towards your water. Caffeine is added up (a mug of coffee is about 95 mg), and a cup
    after your set hour (15:00 to start) gets a gentle flag.
  - Beer, wine and spirits never count as water. Their units add up over seven days, shown beside the UK's public low-risk
    guide of 14 a week, as a fact rather than advice.
- In the chat: "I had a coffee", "a pint of beer", "how much caffeine today?", "how many units this week?".

### 8. Four more rooms on BODY, each kept on your phone
- **FASTING** (Sleep pill): START A FAST and END THE FAST, the time so far against your target (16 hours to start), your streak
  and your past fasts. Chat: "start a fast", "end my fast", "how long have I been fasting?".
- **MEASUREMENTS** (Weight pill): waist, chest, hips and arms in centimetres or inches, each with its own trend line. Chat: "my
  waist is 84 cm".
- **GYM LOG** (Move pill): sets, reps and weight for each exercise, today's session with the total lifted, and personal bests
  (the heaviest, and a rough one-rep max). Chat: "squat 3 sets of 5 at 80 kg", "my personal bests".
- **SYMPTOM DIARY** (Health pill): what it was, how bad (1 to 10) and a note. SAVE A PAGE FOR THE DOCTOR saves one tidy page of
  the last 30 days. It never guesses a diagnosis. Chat: "headache 6 out of 10", "my symptoms".

### 9. The kitchen, further
- **Rough calories and protein per serving** (body.s7) on every recipe, worked out from its own lines and a built-in table of
  common foods. It always says it's a rough estimate and names anything it left out.
- **Import a recipe from a link** (body.u9). RECIPES → IMPORT FROM A LINK: your brain reads the page once, on the public web
  only, and takes just its recipe (name, serves, things, steps). The recipe lands in your book on the phone. A page that
  publishes no recipe says so.
- **A leftovers shelf** (body.s8). The pantry has a Leftovers shelf, and anything put there is eaten-by two days on unless you
  give a date. Chat: "add the curry to the leftovers".
- **Batch cook** (body.s9). Every recipe has BATCH COOK, which puts that many portions on the freezer list with a use-within
  date three months on.

### 10. Outside
- **The best hour for a walk today** (body.s10) is at the top of WALK. It is worked out on the phone from the forecast it
  already reads: the least rain, then the nearest to a mild 15°C, in daylight still to come, plus the air now. Chat: "best time
  for a walk today".

### Rough edges fixed
- The shopping list's tick boxes were 24 pt; they are 44 pt now.

## How to try it on your phone
1. KITCHEN → MEAL PLAN: type "Tuna pasta bake" on Monday, tap FILL THE EMPTY DAYS, then SHOPPING FOR THE WEEK. Open SHOPPING to
   see the list.
2. BODY → Health → TABLETS: add "Vitamin D, 8am, 30". Allow notifications (Settings, Notifications) and lock the phone at 8.
3. BODY → Water → Nudges: turn them on and leave LOCK SCREEN on.
4. A recipe → HANDS-FREE: say "next" and "repeat".
5. BODY → Health → YOUR WEEK after a few days of logging.
6. Steps: open the STEPS FROM HEALTH fold and make the Shortcut once.

## What is left
- **Pantry by barcode or receipt** (body.u11, with lens.c2). A camera barcode reader on the pantry needs a decoder that works in
  Safari, which has no built-in barcode reader. The brain's barcode reader still works by chat. Not built this round.
- **Form tips while counting reps** (body.u6), **six-week plans** (body.u7) and **run history with routes drawn** (body.u8).
  Not built this round.
- **Groceries budget on the shopping list** (body.c1) and **the family dinner rota** (body.c6), both with MONEY AND PEOPLE.
  Not built this round.
- The gym log stays on the phone. The brain's workout log isn't fed from it yet.

## The specialist sweep (screen by screen against the best apps of each kind)
| Screen | What the best apps have | Ghosty now |
|---|---|---|
| Water (WaterMinder) | drink types, caffeine, reminders that reach a locked phone | built: drinks, caffeine, units, lock-screen nudges |
| Sleep (Sleep Cycle) | a sleep score, regularity, bedtime reminder | built: sleep score, wind-down nudge |
| Steps (Strava / Health) | automatic counting | built: the evening Health Shortcut |
| Gym (Strong) | sets, reps, weights, PBs, one-rep max | built: gym log with PBs and a rough one-rep max |
| Recipes (Paprika) | import from a link, scaling, cook mode, timers | built: import, hands-free cook mode |
| Meal plan (Mealime) | plan from recipes, auto shopping list | built: fill the week, shopping for the week |
| Tablets (Medisafe) | reminders, taken/skipped log, refill alerts | built: lock-screen reminders, ticks, refill countdown |
| Food (MyFitnessPal) | calories and protein per meal | built: rough calories and protein per recipe and per planned day |
| Mood (Daylio) | tags and notes, what goes with good days | built: tags, a line, good-day tags |
| Pantry (Paprika / NoWaste) | leftovers, freezer portions, barcode | built: leftovers shelf, batch cook; barcode left |
| Runs (Strava) | route history, pace bands, PBs | left (body.u8) |
