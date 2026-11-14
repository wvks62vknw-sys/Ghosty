# NEXT ROUND: PLAN AND HOME (14 November 2026)

The lane for Home, the agenda, the brief, the radio, markets, the house, social and links. This round's big move, which this lane
leads: **one list and one morning page**. Branch `claude/new-session-4erjve-lane-plan`, merged into
`claude/new-session-4erjve-next`. Nobody was there to ask, so each decision is written here with its reason.

How the work was done: specialist builders, each in its own copy of the code with its own preview. Every builder's work was read
by two independent reviewers whose job was to break it, and a fixer took what they proved. Every finding the fixers did not fix is
written down under What is left.

**What happened to waves 2 and 3.** Wave 1 was built, reviewed, fixed and checked. Waves 2 and 3 (seven builders) started at 03:16
and 03:31. All seven stopped at about 03:40, when the account reached its five-hour usage limit; the limit reset at 04:30 and this
session came back at 04:47. Two builders had committed the brain's half of their item (below). Nothing else of waves 2 and 3 was
whole, and half a feature is never merged, so none of it is in. Starting again at 04:47 could not have finished whole features by
the 06:00 stop, and another fan-out risked stopping this session too before the merge, so I spent the time on the merge and its
checks instead.

**Why wave 1 reached the integration branch at 05:09, not 03:30.** At 03:14 this container's disk filled up with 26 GB of old
builders' copies. That crashed the checks running then, so they had to be run again. Then the usage limit stopped this session from
03:40 to 04:47. Wave 1 went in at `f08f3703`, after its checks passed on the merged branch.

## What was built

### What is in (wave 1)

**One to-do list (u1).** There is now one list, the brain's. The Agenda's TO-DO pill, the chat, the Brief, Home's Today card and
the WORK screen all read and change that one list.
- The brain's to-do list learned what the Agenda had: a star, a day, a repeat (daily, weekdays, weekly, monthly), changing the
  words, and removing one by its id. Ticking a repeating to-do makes the next one.
- Every change shows on the phone at once. With no signal it waits on the phone and goes when the signal is back. The list says
  how many changes are waiting.
- The first time your phone meets the brain's list, the two lists are joined once, and a line says so.
- WORK now ticks a to-do by its id, so two jobs with the same words can't be mixed up. With no signal, a tick waits.
- "Add to my to-do: send the invoice by Friday" (the WORK wording) and "add buy milk to my to-do list" (the Agenda's wording) now
  go to the same place.

**Your day, by the hour (u2, with "plan my week").** A TIMELINE panel in Agenda › Diary has three keys: TODAY, TOMORROW and
PLAN MY WEEK.
- TODAY and TOMORROW lay the day out by the hour. Events that overlap sit side by side, and an event that began yesterday shows
  too. Your free gaps are named ("Free 13:00–15:30"), and your to-dos due that day sit beside them.
- PLAN MY WEEK shows the next seven days. Each has its events, its to-dos and up to three free slots. One line sums up the week:
  "9 events and 4 to-dos in the next seven days; 31 h free in the daytime. Freest: Thursday (12 h)."
- With no signal it is laid out from the phone's copy, and it says so. With no copy at all it never guesses your free time.
- By chat: "plan my week", "when am I free today", "when am I free tomorrow", "show my day by the hour".

**Any month, and changing an event in place.**
- MONTH steps back and forward without limit, with "Last month" and THIS MONTH. Each month reads its own days from the brain.
- Changing one of your own events no longer deletes it and adds a new one. The brain changes it in place: its title, times,
  place, notes, all day, and its reminder. The change box gains an end time, ALL DAY, and a reminder (none, at the start, 10, 15
  or 30 minutes, 1 or 2 hours, 1 day before). UNDO puts it back.
- With no signal, a change waits on the phone, and it says so.

**Goodnight (c6).** Say "goodnight" (or "good night", "night night", "time for bed", "bedtime") and Ghosty winds the house and the
phone down. The screen dims for three seconds first, then each step runs and says what it did.
- **The house:** the lights that are on go off. Lights only: never a switch, never a TV, never a lock. A door that is unlocked,
  or a garage that is open, gets a LOCK UP key for you to tap. A lock that isn't answering is said as not answering, never as
  locked.
- **The radio:** if a station is playing, a 30-minute sleep timer is set. If you already have one that ends sooner, yours is
  kept.
- **Sleep:** the body screen's GOING TO BED starts, unless a night is already being tracked.
- **Tomorrow:** your first event is said ("Tomorrow: Dentist at 9:30, then 1 more").
- Then the night look stays on until you reload, or until sunrise if your look follows the day. It is never saved over your own
  look.
- Each step that can't run says why, and the others still run. No step waits more than 8 seconds. Nothing is sent or posted.
- The Brief has a GOODNIGHT key from 18:00 to 05:00. Said to the microphone, "goodnight" ends the conversation and then runs.

**The sleep timer survives a reload (u7), and is in the top bar.**
- After a reload, the Radio says the timer was set, and offers PLAY AND KEEP THE TIMER. By chat: "carry on with the sleep
  timer".
- While a timer runs, the top bar reads "♪ Radio 4 · stops 23:10". A long station name is cut, and the time never is.

**The house: scripts ask first, every time.** Home Assistant doesn't say what a script does, so a script now always asks: "Run
Warm the house? I can't see what a script does, so I ask first." In the chat, it says to tap RUN and then RUN IT. A "yes" never
runs it.

**Social: FOLLOW OR UNFOLLOW (u13).** The SOCIAL queue has a box to follow or unfollow someone from a linked Bluesky or Mastodon
account. It makes a draft that waits for your APPROVE, like a post. Nothing is sent without your tap.

**Links: email TEST (u14) and one health line.**
- Email has TEST. It signs in to your mail with the app password you linked, and answers "works" or the one reason it doesn't:
  sign-in refused, the server busy for now, the servers not found, and so on. It never shows the server's raw words.
- At the top of LINKS, one line says either "Everything you linked is fine: all 6 work." or "Fix Spotify first: …", with SHOW ME.

### Built but not merged (half a feature)

Two builders committed the brain's half of their item before the limit. Neither has its phone half, so neither is merged. Each is
kept as a patch in `docs/build-plan/next/plan-left/`, ready to apply with `git am` (both apply to this branch):
- **`podcasts-brain.patch`, podcasts (s5), the brain's routes.** GET /api/podcast/search uses Apple's free, keyless iTunes
  Search. GET /api/podcast/feed reads a show's RSS, capped. GET or HEAD /api/podcast/audio streams one episode with its size said,
  refused past 600 MB. Every fetch goes through the network guard: never a private or local address, and every redirect is
  checked. It needs one import and one route line in the protected `apps/edge/src/index.ts`. Its tests are run from
  security.test.mjs. Left to build: the PODCASTS screen, the player's speed, skips and resume, and DOWNLOAD (only on your tap, on
  Wi-Fi, with the size said).
- **`onelist2-brain.patch`, the one list's open ends, and to-dos that ring (u4), the brain's half.** The first join keeps the
  phone's star, day and repeat, keeps two jobs with the same words on different days, and never doubles one. The 300 cap drops
  the oldest done ones first. A late offline tick uses its own day. A to-do with a day and a time gets one reminder job (Web Push,
  so it rings locked), which a tick cancels and a new time moves. The home pack's bin days come with the list (s10). Left to
  build: a time in the to-do's change box, and the bins on the Agenda's days.

### Already built elsewhere

- **Poster to the agenda (c3)** was already built by the LENS lane: point the camera at a poster and its card has ADD TO AGENDA
  (`features/lens/cards.ts`, checked in `tests/lens2.spec.mjs`). Nothing was added here.
- **Stocks** stays off (the plan's choice: no free, keyless source for share prices that holds up).

## How to try it on your phone

1. **One list:** in the chat say "add to my to-do: send the invoice by Friday", then open Agenda › To-do. It's there. Star it,
   tick it on WORK, and see it ticked on the Agenda.
2. **Timeline:** Agenda › Diary › TIMELINE › TODAY, then PLAN MY WEEK. Say "when am I free tomorrow".
3. **Change an event:** tap one of your own events, change its end time and its reminder, SAVE. It keeps its place; UNDO.
4. **Any month:** MONTH › "Last month" twice, then THIS MONTH.
5. **Goodnight:** in the evening, open the Brief and tap GOODNIGHT (or say "goodnight") with the radio on.
6. **Sleep timer:** play a station, "sleep timer 30 minutes", look at the top bar, reload, tap PLAY AND KEEP THE TIMER.
7. **House:** tap RUN on a script; it asks first.
8. **Social:** SOCIAL › WAITING › FOLLOW OR UNFOLLOW; a draft waits for APPROVE.
9. **Links:** the line at the top; TEST on email.


## Checks

All run on the integrated lane branch, after merging the integration branch into it.
- **`tests/planlane2.spec.mjs`**, this round's spec, its word last in check.yml's `all=`. It has a part for each piece of wave 1
  (`tests/planlane2/{onelist,timeline,goodnight,fixes,podcasts}.mjs`, where podcasts is the sleep timer). Each part checks:
  - 440 × 956 and 390 × 844, BODY 21, and the seven looks;
  - 44 pt keys, nothing sideways, no word cut;
  - every state in your words;
  - the chat's wordings, with no model.

  Result: 390 checks, 0 problems (382 s here; CI stops a spec at 480 s).
- **`tests/planlane.spec.mjs`** (last round's 955 checks, now covering the one list, any month and the new change box):
  957 checks, 0 problems. It took 590 s here: this container's load average was 16, from three spec runs and the brain suite at
  once. On a quiet machine it was 447 s, and last round CI ran it in 383 s; CI stops a spec at 480 s. The to-do section now empties
  the one list first. That list lives in the brain, which every spec before it in a CI shard shares.
- **Specs of the screens touched:** agenda, brief, social, media, moneylane (WORK's to-do ticks by id), packs2 and planmepass:
  all green.
- **Brain:**
  - Both typechecks pass.
  - ratchet, knowledge, look, catalogue, meanings, work, social, email and agenda: 141 of 141 pass.
  - The full brain suite: 2,316 of 2,317 pass. The one failure is the gym lane's "nothing takes over 200 ms" timing test, run here under a load
    average of 16; it is not from this lane.
- **One fix found by the checks:** the timeline's spec wrote its to-do into the phone's copy. The one list replaces that copy from
  the brain on every open, so the spec now adds its to-do the way any screen does, and takes it out after.
- **Not run here:** radio.spec, whose BBC .m3u8 stand-in this container's browser will not play (the same on the untouched
  branch). The other lanes' specs were run by their own lanes.

## What is left

**From this round's plan, not built** (in the order I would take them next):
1. **To-dos that ring at their time (u4)**, and the one list's open ends: apply `onelist2-brain.patch`, then add a time to the
   to-do's change box and to the chat's wordings ("call the bank at 3").
2. **Podcasts (s5):** apply `podcasts-brain.patch`, then build the screen on the radio's player.
3. **Countdowns on Home and in the Brief (s3)**, **the Brief in your own order (u6**, you choose the order: it never reorders
   itself**)** and **the next thing in every Home look (u15).**
4. **A habits tracker with streaks (s2).**
5. **Bins and chores on the Agenda's days (s10)**, **weather for your saved places (s9)**, and **a morning line from your own
   timelines (s11**, read only**).**
6. **Markets:** price alerts while the app is open (u9), your coins' value over time (u10), a trip money card with rates only
   (s7).
7. **Radio:** station details and the song playing (u8); waking up to a station with Ghosty left open, with a Web Push ring as
   the backup (s6).
8. **The house:** today's house timeline (u11); building scenes on the phone, where locks still ask (u12).
9. **Today's places on the map (c4):** geocoded from the diary's own place text, and never live GPS to the brain.

**Left open in what was built:**
- **The one list:**
  - The first join matches by words only, so it can drop the phone item's star, day or repeat. The fix is in the onelist2
    patch.
  - The 300 cap can drop an open job; an offline repeat tick sent after midnight uses the send day. Both fixes are in the
    onelist2 patch.
  - The phone's outbox keeps the last 200 changes rather than one per to-do, and a phone whose storage is full is not told.
  - After a brain reply that carries the to-do card, Home and the Brief catch up on their next open, not at once.
  - WORK's CLEAR DONE does not wait for the signal the way its ticks do.
- **Goodnight:**
  - Spoken, it ends the conversation first, then runs.
  - The night look lasts until a reload or sunrise.
  - The orb rests by dimming; its motion is not slowed.
  - There is no GOODNIGHT key on Home (it is in the Brief from 18:00).
- **Social:** the follow box has no chat wording of its own, because a follow by chat goes through the brain's model tool.
- **The sleep timer:** after a reload it offers to carry on; it cannot keep playing through the reload itself.
- **Stocks** stay off: there is no free, keyless source that holds up.

## The specialist sweep

What the best dedicated apps do that people rely on, set against Ghosty after this round. ✓ is in Ghosty, ◐ is partly there, ✗ is
not yet there (each ✗ is in What is left or was ruled out by your rules).

**Calendar: Fantastical**
- ✓ An event typed in plain words ("lunch with Sam Friday 1pm"), through the chat.
- ✓ Day, week and month views; the day by the hour with free gaps (TIMELINE).
- ✓ Change an event in place, with its reminder, and UNDO.
- ✓ Several calendars read together; a feed's events are read-only and say so.
- ◐ Availability: PLAN MY WEEK names your free slots, but there is no link to send to someone else (that would publish).
- ✗ Time zones per event; event templates; holiday and sports calendars to subscribe to.

**To-dos: Things 3 and Todoist**
- ✓ One list everywhere; star; a day; repeats (daily, weekdays, weekly, monthly); views for ALL, TODAY, UPCOMING and STARRED.
- ✓ Late ones first, said "2 days late"; UNDO on every removal; works with no signal and catches up.
- ✓ Added in plain words by chat, with a day ("by Friday", "for tomorrow").
- ✗ Projects and areas, headings, checklists inside a to-do, tags and filters, "every other Tuesday", a logbook to look back on.

**Radio: TuneIn**
- ✓ Live stations by name and country, favourites in your order, recent stations, the lock screen's ⏭ ⏮.
- ✓ A sleep timer at a time or after minutes, which fades out, survives a reload and shows in the top bar.
- ✗ Browsing by genre; an alarm that wakes you with a station (s6 is left open).

**Podcasts: Overcast**
- ✗ Podcasts: the brain's routes are written (above), the screen is not. Overcast's smart speed, voice boost and Up Next queue are
  the bar for it.

**Markets: Apple Stocks**
- ✓ A watchlist of your own, charts for 24 H, 7 D, 30 D and 1 Y, what you hold and what it is worth now, never advice.
- ✗ Price alerts while the app is open (u9); your coins' value over time (u10).
- ✗ Shares (no free, keyless source holds up, so stocks stay off); after-hours prices; news per coin.

**Weather and bin days**
- ✓ What to wear from the forecast; tonight's rain in the evening; sunrise and sunset; each source named with its time.
- ✗ Weather for each saved place (s9); bin days on the Agenda (s10: the brain half is in the onelist2 patch); a bin-day reminder
  the evening before.
- ✗ A rain radar map; "rain starting in 10 minutes" pushed to the lock screen (it would need the brain to know where you are
  now, and the brain never gets live GPS: only the home you saved).
