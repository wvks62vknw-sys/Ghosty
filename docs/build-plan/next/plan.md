# NEXT ROUND: PLAN AND HOME

Your lane: **Plan & home**. Read `docs/build-plan/NEXT-ROUND.md` first: the rules, how the code is checked, and the protocol. This file is your work, in order.

## The big moves you are part of

- **One list and one morning page** (you LEAD it: make the pieces meet as one thing). You get one to-do list and one day-and-week timeline that every screen reads and changes, so there are no more separate copies. Each morning the Brief picks up a live line from every room, so one page tells you your whole day. Yours: `plan.u1`, `plan.u2`, `plan.u3`, `plan.u4`, `plan.s10`, `plan.s3`, `plan.s11`.
- **Talk to it your own way** (led by VOICE). Every screen gets one name and answers lots of everyday wordings, and when Ghosty misses one, it learns it from the screen you tap. You can also make your own one-word routines, like 'goodnight' or 'morning', that run several things at once, and anything that sends or posts still waits for APPROVE. Yours: `plan.c6`.
- **The camera as the front door** (led by LENS). Whatever you point the Lens at, it offers the next useful step: a receipt goes to Money, a poster to the diary, a book to the shelf, a letter into an editable document. The camera becomes the quickest way into every room. Yours: `plan.c3`.
- **Everything works with no signal** (led by POLISH3). One number shows how much of Ghosty works offline right now, and which single download would help most. Each download happens only when you tap, on Wi-Fi, with its size shown, and journeys, translation, plant names and screens keep working when the signal drops. Yours: `plan.s7`.

## 1. The next round: build every one, whole and specialist-grade

- **One to-do list everywhere** (`plan.u1`, M). Have one to-do list that the Agenda, Work, the Brief, Home and the chat all read and change, instead of two.
  - Their words: One to-do list for everything. Why: No more two lists: the Agenda, WORK, the Brief, Home and the chat all read and change the same list. Builds on: Agenda TO-DO and WORK's to-do list in the brain.
  - Why now: Two to-do lists cause confusion. One shared list unlocks reminders, promises, timelines and the Brief. This also finishes the To-do list.
- **A day timeline with free gaps** (`plan.u2`, M). See today and tomorrow as hours, with your events laid out and the free gaps easy to spot.
  - Their words: A day timeline in the Agenda. Why: See today and tomorrow as hours with free gaps, like the best calendar apps. Builds on: Diary, Month and This week.
  - Also covers `plan.s12`: Plan my week. Lay out the week's events and to-dos together and see the free slots, all worked out on the phone.
  - Why now: Finishes the month view with a day and week timeline, so you see free gaps at a glance. After: plan.u1.
- **Say goodnight to wind everything down** (`plan.c6`, M). Say 'goodnight': lights off, radio sleep timer set, sleep tracking started and tomorrow's first event said; locks still need your tap.
  - Their words: Voice: 'goodnight' does the house, the radio timer and tomorrow's brief. Why: One phrase: lights off (with confirms), radio sleep timer, tomorrow's first event said. With: voice (build it into their area, small and additive).
  - Also covers `boot.s1`: A goodnight wind-down. Say 'goodnight' and a three-second wind-down dims the feeds, rests the orb and switches on the night look.
  - Why now: The biggest wow on the list, and the first built-in routine that proves the routine engine works. After: consistency.s2.
- **Podcasts from free public feeds** (`plan.s5`, M). Follow podcasts by link or search and play them like the radio; downloads only when you tap, on Wi-Fi, with the size shown.
  - Their words: Podcasts from free public feeds. Why: Subscribe by link, play like the radio, downloads only on your tap on Wi-Fi with the size said. Builds on: The radio player and Media Session.
  - Why now: Podcasts join the radio on the same player, from free public feeds, downloaded only on your tap.

## 2. Moved back by a skeptic: build the safe, real version only if it stands

- **Point at a poster to add an event** (`plan.c3`, S). Point the camera at a gig poster or ticket, check the date, and the event goes into your diary.
  - Their words: Lens scans a poster or ticket into the Agenda. Why: Point at a gig poster or ticket and the event lands in the diary. With: lens (build it into their area, small and additive).
  - Also covers `lens.u2`: Understand 'next Tuesday at 3'. Point at a poster or note saying 'next Tuesday at 3' and it goes in your agenda on the right day and time.
  - Also covers `lens.c4`: Event poster to agenda and journey. Point at a poster and the date, the place and when to leave home go in your agenda in one go.
  - The skeptic: Already built: the Lens reads a date off any printed text and ADD TO AGENDA puts it in the diary (tested with a poster-style notice in lens2.spec).

## 3. Finish what is half done

- **Change or remove an event** (S). Missing: A change is a delete then an add, with no all-day or reminder choice. Fix: Add a brain edit route that changes the event in place and moves its reminder; add all-day and reminder pickers.
- **Month view** (M) (picked for this round). Missing: Only this month and next; no week or day timeline. Fix: Let the arrows fetch any month (the diary already takes a start date), then add a day timeline.
- **To-do list** (M) (picked for this round). Missing: Two separate lists: the Agenda's on the phone and Work's in the brain. Fix: Make the brain's list the one store both screens use, with a phone copy for when there's no signal.
- **Sleep timer** (S). Missing: A reload ends it, and it isn't shown in the top bar. Fix: Keep the stop time on the phone so a reload offers to carry on, and show the time left in the top bar.
- **Stocks and indices** (M). Missing: Not built: the only free source now wants a key. Fix: Leave it off until you add a market-data key yourself; then read prices with it and say when they were read.
- **The house, room by room** (S). Missing: Shows only the linking steps until your Home Assistant is linked. Fix: Nothing to build: link your own free Home Assistant in SYSTEM, KEYS and the rooms fill in.
- **Scenes and scripts** (S) (picked for this round). Missing: A script runs on one tap with no confirm. Fix: Ask for one confirm before any script runs, since the phone can't see what it does.
- **Follow and unfollow** (S). Missing: Only the chat can make a follow draft. Fix: Add a follow box on the Social screen that puts a follow draft in the queue for your APPROVE.
- **Test a connection** (S). Missing: Email has no TEST key. Fix: Add a brain check that signs in to your mail and reports pass or fail, plus a TEST key for it.

## 4. Soon: build them all once 1 to 3 are whole

- **Edit an event properly** (`plan.u3`, S). Change an event's time, end, place, reminder or all-day setting in place, without it being deleted and added again.
  - Their words: Real event editing. Why: Change an event's time, end, place, reminder and all-day in place, without delete-then-add. Builds on: Diary's change box and the brain's agenda route.
- **To-dos that ring at their time** (`plan.u4`, S). Give a to-do a time, like 'call the bank at 3', and it rings then like a reminder.
  - Their words: To-dos with a time and their own alert. Why: 'Call the bank at 3' rings at 3 like a reminder, then ticks off. Builds on: To-do list + Reminders.
- **A habits tracker with streaks** (`plan.s2`, M). Track daily habits with a tick and a streak, kept on your phone.
  - Their words: Habits tracker. Why: Daily habits with streaks, kept on the phone. Builds on: Repeating to-dos.
- **Countdowns on Home and in the Brief** (`plan.s3`, S). Pin 'days until the holiday' to Home and the Brief from any event in your diary.
  - Their words: Countdowns. Why: 'Days until the holiday' on Home and in the Brief. Builds on: Diary events + Home's Today card.

## 5. Later: build the best of these, as many as stay whole and green; list the rest in your report

- **Put the Brief in your own order** (`plan.u6`, S). Drag the Brief's sections into the order you like; it can show which you open most, but you choose. *Reshaped to keep his rules: Learning your habits to guess for you brushes 'no prediction about any person'; reshaped so you set the order.*
  - Their words: Brief that learns your morning order. Why: Puts what you open first at the top, from what you actually tap (kept on the phone). Builds on: The Brief's sections.
- **Radio sleep timer survives a reload** (`plan.u7`, S). If the app reloads, the radio sleep timer offers to carry on instead of quietly stopping.
  - Their words: Radio sleep timer that survives a reload. Why: Re-arms after a reload and plays on with one tap, said honestly. Builds on: Radio sleep timer.
- **Station details and the song playing** (`plan.u8`, M). See a station's sound quality and website, and the song title whenever the station sends it.
  - Their words: Station detail and a now-playing song line. Why: Shows codec, quality and homepage, and the song title where the station sends it. Builds on: Radio's now playing and station rows.
- **Coin price alerts on screen** (`plan.u9`, M). Say 'tell me if bitcoin drops 5%' and it tells you on screen when it happens; never advice.
  - Their words: Price alerts while the app is open. Why: 'Tell me if bitcoin drops 5%' says it on screen when it happens, never advice. Builds on: Markets watchlist + inbox.
- **Your coins' value over time** (`plan.u10`, M). See a simple line of what your coins were worth day by day, from your own amounts.
  - Their words: Holdings history. Why: A simple line of what your coins were worth day by day, from your own amounts. Builds on: Your coins.
- **Today's house timeline** (`plan.u11`, M). See what turned on, opened and changed in the house today as a simple timeline.
  - Their words: House history of the day. Why: What turned on, opened and changed today, as a timeline. Builds on: Whole house at a glance.
- **Build scenes on the phone** (`plan.u12`, L). Make a scene like 'Goodnight: these lights off, heating to 18' by picking things on the phone; locks still ask you.
  - Their words: Scene builder. Why: Make a scene on the phone from things you pick ('Goodnight: these lights off, heating 18'), confirms for locks kept. Builds on: Scenes, Pins, ALL OFF.
- **Follow and unfollow from the screen** (`plan.u13`, S). Make follow and unfollow requests from the Social screen, each waiting for your APPROVE.
  - Their words: Social: follow drafts on the screen. Why: Follow and unfollow from the screen, each waiting for APPROVE. Builds on: Write a post and the queue.
- **Test email and one health line** (`plan.u14`, S). Test your email link like the others, and see one line saying everything's fine or naming the one thing to fix.
  - Their words: Links: Email TEST and a health line. Why: Test email like Spotify, and one line saying everything is healthy or the one thing to fix. Builds on: Connections.
- **Next thing in every Home look** (`plan.u15`, S). Show the same 'what's next' card in all seven Home looks; five of them already have it.
  - Their words: Home: the next thing at a glance in every look. Why: One unified 'next' card across all seven looks from the same facts. Builds on: Home's Today card and the hour's thing.
- **Wake up to a radio station** (`plan.s6`, M). Set it at bedtime with Ghosty left open on the charger, and your favourite station fades in at your wake time. *Reshaped to keep his rules: The iPhone won't start sound in a closed web app, so it needs Ghosty left open; said honestly.*
  - Their words: Alarm clock that plays a station. Why: Wake to your favourite station (while Ghosty is open), with a gentle fade-in. Builds on: Radio + reminders.
- **A money card for your trip** (`plan.s7`, S). Before a trip, a card with today's rate and a quick table of common amounts in their money, saved for offline. *Reshaped to keep his rules: Dropped 'what things cost there': there's no free, keyless source; rates only.*
  - Their words: Currency and travel money card. Why: Before a trip: rates, what things cost there, from free rates already read. Builds on: Markets converter.
- **Weather for your saved places** (`plan.s9`, S). See rain timing and what to wear for each place you've saved, like work or Dad's.
  - Their words: Weather for your saved places. Why: Rain timing and what to wear for each place you've saved. Builds on: The Brief's weather.
- **Bins and chores in the Agenda** (`plan.s10`, S). See bin days and repeating chores on your Agenda's days, beside your events.
  - Their words: Bin day and household chores on the Agenda. Why: Chores as repeating to-dos, bins from the home pack. Builds on: To-do repeats + home admin bins.
- **A morning line from your timelines** (`plan.s11`, S). A read-only morning line in the Brief of what's new on your own social timelines; nothing is posted.
  - Their words: Social digest. Why: A morning line of what's new on your own timelines (read-only, nothing posted). Builds on: Social accounts reading + the Brief.
- **Today's places on the map** (`plan.c4`, M). See today's events that have a place drawn on the map, so your day's route is clear at a glance.
  - Their words: Map shows your day's places. Why: Today's events with a place drawn on the map (no live GPS sent to the brain). With: see (build it into their area, small and additive).

## 6. Everything else, at the level of the best app of its kind (his words: "every single little feature … the absolute best", "and even more things")

Go screen by screen through your lane and compare each with the best dedicated apps of its kind (Fantastical, Things 3, Todoist, TuneIn, Overcast, Stocks and the best weather and bin-day apps). For each screen, list what they have that Ghosty lacks and build it, within his rules. Then fix every rough edge you find: a dead key, a missing state in his words, a slow open, a cut word at BODY 21, a look that breaks in one of the seven worlds. Add your own ideas too. Put the list, with what you built and what is left, in your report.

## Built into your area by other lanes (expect their small additions; keep their intent when you merge)

- `consistency.c6` from CONSISTENCY: Hub readings feed the Brief
- `voice.c1` from VOICE: Radio by meaning with favourites by name
- `memory.c2` from MEMORY: The Brief's mail line offers CHASE and shows chases due today
- `boot.c1` from BOOT: The film's search locks on the next thing in your plan
- `lens.c4` from LENS: An event poster becomes an agenda entry with the journey there
- `see.c1` from SEE: Trip mode: the agenda's next event becomes a journey with weather, road reports and cameras along the way
- `see.c2` from SEE: The world in the morning Brief: threat level, his commute's incidents and a still of his road's camera
- `make.c2` from MAKE: House: the heat-loss estimate set against his real heating from Home Assistant
- `editors.c4` from EDITORS: Due dates in Workspace databases show on the agenda and in the morning brief
- `editors.c6` from EDITORS: A post drafted from a photo or video edit, sent only with APPROVE
- `comic.c5` from COMIC: Post a comic or single panel to his social accounts, always with APPROVE
- `sites.c1` from SITES: A business site whose opening hours and closures come from his agenda
- `learn.c4` from LEARN: Brief: today's lesson, word cards due and puzzle of the day in one line each
- `body.c2` from BODY: Sleep, mood and the day
- `money.c1` from MONEY: Spending by place: what he spent near Work or Dad's, on the map
- `money.c5` from MONEY: Birthday cards and messages drafted from Coming up with one tap, in his voice, sent only on APPROVE
- `money.c6` from MONEY: A morning Brief line: bills due today, birthdays this week, today's to-do
- `polish3.c6` from POLISH3: Health watches the money pack's price watchers and the Guardian's jobs
- `security.c1` from SECURITY: Approvals in the Brief
- `ci.c1` from CI: The radio fades under Ghosty while he speaks, and comes back after
- `ci.c5` from CI: The morning brief read aloud when he says "Ghosty listen" before 9

## Left out (do not build these as written)

- `plan.s1` Shopping list in the Agenda: A second home for the same list repeats the two-to-do-lists muddle; it's already in the Kitchen and the chat.
- `plan.s4` Birthdays in the Brief: Already built: birthdays within seven days already show in the Brief.
- `plan.s8` Energy use from your house sensors: Uses only the Home Assistant you've linked.
- `plan.c2` Bills and renewals as to-dos: a weaker duplicate of plan.u1

## Merged into another idea (built there)

- `plan.u5` Search your whole plan goes into `memory.s2`
- `plan.s12` Plan my week goes into `plan.u2`
- `plan.c1` Body numbers in the Brief goes into `consistency.c6`
- `plan.c5` A comic of your week goes into `comic.s3`
