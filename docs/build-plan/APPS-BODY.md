# THE APPS ROUND: BODY: Health Hub

The flagship this round is **HEALTH HUB**. It shows everything your iPhone and Watch measure on one page that fills itself
each day. It's kept on your phone, and nothing in it goes to your brain. Every number is what your devices recorded:
highlights say what happened in your own history, never advice and never a forecast, and none of it is medical advice.
It's proved by `tests/healthhub.spec.mjs` at 440 × 956 and 390 × 844, and its word `healthhub` is at the end of check.yml's
`all=`.

## What I built

### HEALTH HUB (BODY → Health, first room)
- **It fills itself every day.** You make a Shortcut once (its four steps are on the page, with COPY THE LINK). Each evening at
  21:00 it sends the day's totals: steps, active energy, exercise and stand minutes, resting heart rate, HRV and sleep. It
  never sends a route or where you were. If you'd rather, the Shortcut can copy the totals and you paste them in with one tap.
- **Your history, read once.** READ MY HEALTH EXPORT reads every type the hub shows:
  - steps and distance (from whichever of iPhone and Watch counted more, never both added together);
  - active energy, exercise and stand minutes;
  - heart rate, resting heart rate, HRV and VO2 max;
  - weight, blood pressure and breathing rate;
  - sleep with its deep, core, REM and awake stages;
  - workouts, with their time, distance and energy.

  Next time, it reads only the days since the last read.
- **Today:**
  - activity rings for move, exercise and stand, with your own goals;
  - COUNT STEPS NOW, which counts with the phone's motion sensor while Ghosty is open;
  - a card for each measure, with its last value and the month as a small line.
- **Charts.** Tap a card to see its chart. A range key covers a day, a week, a month, six months, a year or all time, and you
  can pinch the chart to zoom in or out. Each chart shows the average, the lowest and the highest. Weight has a smoothed trend
  line that evens out day-to-day swings.
- **Highlights.** For example: "Resting heart rate averaged 57 bpm over the last 30 days, 3 bpm lower than the 30 days before."
  These come from your own numbers, said as what happened.
- **Sleep stages** for last night, and your **workouts**.
- **SUMMARY FOR AN APPOINTMENT** saves a one-page PDF of your last 30 days beside the 30 before, with what changed.
- **Your Steps and Sleep trackers** get the days too, never over a day you logged yourself.
- **The first run** shows sample numbers, clearly said to be a sample, and a three-step tour. CLEAR THE SAMPLE empties it,
  and your own numbers replace it as soon as they arrive.
- **Chat:** "open health hub", "my resting heart rate", "my HRV", "health summary for my appointment".

### Kitchen timers on a locked phone
- A timer of a minute or more now rings on your lock screen too. It's a one-off reminder on your brain's clock, and only its
  end time and its name go there. CANCEL or STOP takes it back. If the timer is about to ring while Ghosty is on screen, the
  lock-screen ring is taken back, so it never rings twice.
- **Presets:** one tap each for a soft egg (6 min), pasta (10), rice (12), tea (4) or a roast (1 hour).
- **+1 MIN** on a running timer moves its lock-screen ring with it.
- **A stopwatch** with laps, kept on the phone so a reload carries on.

### The Body card on Home
- Once your own numbers arrive, the Body card's line includes your latest resting heart rate from the hub (never the sample's).

### On the App Kit
- The hub's workouts use the kit's list rows, and while your export is read the kit's skeleton rows hold the page's shape so
  nothing jumps when the days land. The hub lives as a room inside BODY rather than as a whole kit app.

## How to try it on your phone
1. BODY → Health: HEALTH HUB opens with the sample and the tour. Tap a card, then try the range keys or pinch the chart.
2. Open THE SHORTCUT, MADE ONCE and make the automation.
3. Tap READ MY HEALTH EXPORT once and pick the export you saved from the Health app.
4. Tap SUMMARY FOR AN APPOINTMENT for the PDF.

## What's left
- Workout routes (the GPX files in the export) aren't drawn on the hub yet. Runs you record in Ghosty already keep their
  routes under the running coach.
- Hour-by-hour views within a day.
- The rest of the BODY list in `docs/build-plan/apps/body.md`: shopping by aisle, pause and an across-the-room
  timer view, and the new apps (Food Log, Birds, Nature ID). Run Plans, Form Coach, Meds and the Workout Log already have their
  first versions from the last round.
