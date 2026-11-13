# FINAL ROUND: BODY AND KITCHEN (lane-body)

The lane's screens: BODY (water, sleep, steps, weight, mood, reps, the running coach, breathe, stretch, your Health week), KITCHEN
(timers, shopping, meal plan, and now the pantry and the recipe book) and OUTSIDE (walk, nearby, my car, lost, split). Proved by
`tests/bodylane.spec.mjs` at 440 × 956 and 390 × 844, its word `bodylane` last in check.yml's `all=`.

## What was wrong

- **Water was a counter, not an app.** One key, "+1 glass", always 250 ml, a fixed goal of eight glasses, no history, no streak,
  no chart, no cup sizes. And it was kept in my brain, not on his phone, so with no signal or a slow brain the screen said
  "I can't count your glasses" and the glass was lost.
- **Water's promise didn't match what it did.** The catalogue said "I nudge you when you are behind"; the nudge was a brain
  setting with no hours, no quiet hours and no "stop once on track".
- **Sleep, steps, weight and mood had no screens.** Steps and sleep only existed as the average of a Health export; weight
  only by chat; mood not at all. Nothing could be logged by tapping.
- **The Health export's numbers went nowhere on the phone** once read: no day-by-day history to look back on.
- **The kitchen had no pantry and no recipe book.** "What can I cook" lived only in the brain's chat; his own recipes had no home.
- **My car** said "paid until" but never how long was left, and gave no way back to the car.
- Small: "0 h 30 min" style wording; the Body card ("Move and breathe") never said today's water.

## What I made

### BODY: five trackers, each an app of its own (features/body/track.ts, trackcore.ts)
BODY's pills are now Move, Water, Sleep, Mood, Weight and Health, because a screen holds at most six pills:
- Move holds the camera's reps, the running coach and steps. It comes first, as Reps did, so the camera's START is within reach when the screen opens;
- Mood holds the mood log, breathing and the stretch set.

`#body?run` and every chat door still open each room on its own.
All kept in the phone's own storage only (`ghosty.body.track`); none of it is sent to my brain or anywhere else. Every goal and
number is labelled a first estimate, never medical advice.

- **Water**
  - The day's goal is worked out from his body and the day's weather: about 33 ml for each kilo he weighs (2,000 ml until he
    tells me his weight); +250, +500 or +750 ml on a 20, 25 or 30°C day; +350 ml on a 10,000-step day. It is kept between
    1,500 and 4,000 ml. The screen shows each line of the working, and his own goal wins when he sets one.
  - Quick keys: a glass (250 ml), a mug (350), a bottle (500), a pint (568), any amount in ml, and up to six cups of his own
    (name and size, for example "Flask, 400 ml"). Each of his cups becomes a key and a word ("I drank a flask").
  - A day ring that fills and turns to the accent once the goal is met.
  - History: the week or the month as a bar chart with the goal's line, and the average said underneath.
  - Streaks: days in a row, and his best run. An unmet today never breaks yesterday's run.
  - Today's drinks listed with their times, each with TAKE BACK, plus UNDO.
  - **Nudges.** Off until he turns them on. They come only inside his nudge hours (09:00 to 21:00 by default), never in his
    quiet hours (22:00 to 08:00 by default), and at most every 90 minutes (he picks 30 minutes to 3 hours). Each nudge comes
    only when he is behind the day's pace, and they stop once he is on track or the goal is met. A nudge is a toast, plus a
    phone notification when Ghosty is in the background and notifications are allowed.
- **Sleep:** GOING TO BED, then I'M UP keeps the night. He can also tap 6, 7, 7½, 8 or 9 hours. The goal starts at 8 hours
  and he can change it. Ring, week and month chart, streak.
- **Steps:** +1,000, +2,500, +5,000, or any number. The goal starts at 8,000 and he can change it. The days from a Health
  export are added automatically, but never over a day he logged himself. Ring, chart, streak.
- **Weight:** kilos, stone and pounds, or pounds alone ("13 st 4", "182 lb"), shown in kilos and stone. The trend compares the
  last week's average with the same week two weeks earlier. His height gives BMI as a first estimate, with the warning that BMI
  doesn't account for muscle. He can set a weight to aim for. The chart is scaled to his own range.
- **Mood:** five keys (Awful, Low, Okay, Good, Great), one a day, with the week and the month on the chart. The chat logs a
  mood only when he says so plainly ("my mood is good", "log my mood as low"). "I feel low" on its own still goes to my brain
  as a conversation, never as a number.
- **Every state is said in his words:**
  - empty: what it is and the one next thing to do;
  - loading: "Reading today's weather for your goal…";
  - error: the phone's storage is full or switched off;
  - offline: "No signal: everything here works on the phone."
- **The Home card.** The Body card's line now starts with today's water and last night's sleep, for example "Water 1.2 litres
  of 2.25 litres, slept 7 h 30 min · 3 active days this week…".
- **The chat, with no model, in many wordings:**
  - water: "I drank a pint", "log a glass of water", "had 500 ml", "a bottle of water", "how much have I drunk?", "am I
    drinking enough?", "how much water this week?", "undo the water", "remind me to drink water", "stop reminding me about water";
  - sleep: "I slept 7 and a half hours", "going to bed", "I'm up now", "how did I sleep this week?";
  - steps, weight and mood: "walked 6,000 steps", "how many steps today?", "I weigh 82.5 kg", "what do I weigh?", "my mood is
    great", "how has my mood been?";
  - opening a tracker: "open my sleep tracker".
  - Each answer has an OPEN IT key. "Remind me to drink water at 5" stays a reminder on the agenda. Beer, coffee and the like
    are never counted as water.

### KITCHEN: the pantry and the recipe book (features/kitchen/larder.ts), kept on the phone
- **Pantry:**
  - fridge, freezer and cupboard, each thing with its use-by date;
  - USE SOON at the top (two days or less), with plain words like "use by tomorrow" or "2 days past its date";
  - USED UP takes a thing off and offers ADD IT TO SHOPPING;
  - "You could cook: …" from what is there;
  - chat: "add milk and eggs to the fridge", "put chicken in the freezer", "what's in my fridge?".
- **Recipes:**
  - his own recipes beside Ghosty's own twelve, ordered by how much of each the pantry has;
  - his own recipes scale with − and +;
  - COOK IT, STEP BY STEP, with a timer key on any step that says its minutes (it starts a real kitchen timer);
  - ADD THE MISSING THINGS TO SHOPPING;
  - PUT ON TONIGHT, for the meal plan;
  - ADD A RECIPE (its ingredients one per line, its steps one per line) and DELETE;
  - chat: "open my recipes".

### OUTSIDE
- **My car** now says the time left on the ticket and has WALK ME BACK TO IT. That key opens his maps app with walking
  directions to the spot he kept. The tap is his, and nothing is sent from Ghosty.

### The checks kept honest
- **lifepass B10** used to require water to fail with no brain. Water now lives on the phone, so the check is just as strict
  the other way: with my brain cut off, the amount is drawn at once (never "…"), there is no error, and a glass is kept.
- **tabs.spec** lists the new pills and pages: BODY's six (Water, Sleep, Move, Mood, Weight, Health) and its ten pages, and KITCHEN's Pantry and Recipes. **lifepass** opens the camera, the run, breathing and stretching through their new pills, Move and Mood, with every check as before.
- **The ratchet** gains rows for the new screens' states (body.sleep, steps, weight and mood; kitchen.pantry and recipes).
- **The catalogue** describes water and the trackers as they really are now, and the pantry beside the recipe book.
- **The voice lane's meanings.** A drink logged in any of its wordings ("please log a cup of water", "hey ghosty log a glass") lands on the `water` table, as the voice lane's meanings test expects. That table now keeps the drink on the phone through the tracker. Every other tracker wording goes to the `track` table.

## How to try it on his phone
1. Open BODY, then Water. Tap Pint and the ring moves.
   - Open "Your goal" to see how the goal was worked out.
   - Open "Nudges" and turn them on.
   - Tap Month to see the chart.
2. Weight: type "13 st 4". Then go back to Water: the goal has changed to suit his weight.
3. Sleep: tap GOING TO BED tonight and I'M UP in the morning.
4. In the chat, say "I drank a pint", "how much have I drunk?", "I slept 7 and a half hours" or "my mood is good".
5. KITCHEN, then Pantry: add milk and chicken with today's date, and they show under USE SOON. In Recipes, open one, tap COOK
   IT, STEP BY STEP, then the timer key.
6. OUTSIDE, then My car: tap I PARKED HERE with a paid-until time. Reopen it to see the time left and WALK ME BACK TO IT.

## What is left
- **The shopping list and the meal plan are still kept in my brain**, his own Cloudflare, as before. Moving them onto the
  phone would break the brain's kitchen tool and the specs built on it. They stay where they are, and the screens say so.
- **My brain's own `body` tool still keeps water and weight** when he talks to the model, rather than to the phone's words.
  The phone now answers every water, sleep, steps, weight and mood wording itself, so this is reached only by unusual phrasings.
  A later pass could point that tool at the phone's numbers.
- **Nudges come while Ghosty is open,** or in the background while the page lives. A nudge while the phone is locked would
  need the brain's push, and that means sending his water to it. I kept it on the phone instead.
- **The pantry has no barcode scan.** The brain's kitchen tool already reads a barcode by chat. A key on the pantry for it
  would be next.
- **Notifications code outside my lane** (`assistant/push.ts`) throws "reading 'pushManager'" when a browser has no service worker, for example a spec that blocks them. That belongs to SYSTEM AND SETTINGS. With service workers blocked, the browser gives back no registration, and push.ts reads `pushManager` from it. That turns tabs.spec red on its own in this container, with no red from my lane. The bodylane spec leaves service workers on rather than hiding the error. The fix, "no registration means unsupported", is one line in that lane's file.
- **Outside's walk, nearby, lost and split** were audited and found whole, with their four states in place. They were not
  rebuilt this round.
