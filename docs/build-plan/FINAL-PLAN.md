# FINAL ROUND: PLAN AND HOME (13 November 2026)

The lane for Home, the agenda, the brief, the radio, markets, the house, social and links. Branch
`claude/new-session-4erjve-lane-plan`. Nobody was there to ask, so each decision is written here with its reason.

How the work was done: first a pass over every screen by one builder, then, at your "ultra code" word, one specialist builder per
screen, each in its own copy of the code with its own preview. Every screen's work was then read by two independent reviewers
whose job was to break it, and a fixer took what they proved. A separate review of the whole lane found 35 problems; each one was
checked by two more reviewers before it counted, and each is fixed or written down below.

## What was wrong

- **Agenda:** a diary and a reminders list, not a calendar or a to-do app: no to-do list, no month, no way to change an event.
  Deleting an event or a reminder with no signal threw an error that nobody saw. The empty diary said "connect a calendar below",
  but on the phone the calendars are under their own pill.
- **Radio:** no sleep timer, no stations played lately, no way to say any of it in the chat. The lock screen's ⏭ and ⏮ did
  nothing. A long station line was cut off with "…".
- **Brief:** "Your day" left out what you had to do. In the evening it still talked about "the rest of today". It gave two
  different instructions for where to save home and work. When the headlines failed, there was no way back.
- **Markets:** eight coins chosen for you, nothing of yours: no watchlist, no holdings, one range only.
- **House:** rooms and controls only: no glance at the whole house, no scenes, no pins, no "all off".
- **Social:** nowhere on the screen to write a post. A post could only start in the chat.
- **Links:** the top line ("1 / 7 online") did not match the rows under it. A check that had failed could still show as linked.
  UNLINK said "unlinked" even when it had failed and the account was still linked (a privacy matter).
- **Home:** the Today card did not know about your to-dos. Some looks said "nothing yet" in every free square, and some cut
  RECENT and FAVOURITES at BODY 21.
- **Push:** a phone whose browser gives no push manager threw a page error. Found by the social and homepass specs.

## What I made

**Agenda → a calendar and a to-do app**
- TO-DO, a new pill. Each to-do can have a day, a star and a repeat (daily, weekdays, weekly, monthly; ticking one makes the next).
  There are views for ALL, TODAY, UPCOMING and STARRED. Tap a to-do's words to change them or its day. Late ones come first and say
  "2 days late". Every removal has UNDO. The list is kept on the phone.
- MONTH: the month as a calendar. A dot marks a day with events, a ring marks a to-do due, and today is lit. Tap a day to hear what it
  holds. Under it is THIS WEEK, day by day. A day already gone, or further ahead than I read your calendars, says so instead of
  looking empty.
- Tap an event in the diary to see it whole. You can change one of your own: the brain has no edit, so a change is a delete and then
  an add, and it says so, with UNDO.
- The diary says when it is showing the phone's copy because the brain can't be reached. A failed delete says so and keeps the item.
- By chat, with no model: "add buy milk to my to-do list", "put call the bank on my list for tomorrow", "to-do: renew passport by
  Friday", "what's on my to-do list", "what do I need to do today", "tick off buy milk", "I've done the passport", "clear my done
  to-dos", "show my month".

**Radio → a radio app**
- SLEEP TIMER: 15, 30, 45 or 90 minutes, an hour, or AT 20:00 (the end of this hour; the key relabels itself as the hour passes).
  It fades over the last 20 seconds, then stops. The key you chose stays lit, even when the chat set the timer. The lock screen's line
  says "Stops at 23:10". TIMER OFF takes it off. After a reload it says once that the timer went with the reload.
- RECENT: the last eight stations you played. FAVOURITES in your own order, with REORDER and ↑ ↓.
- NEAR ME: your country (the UK unless you change it), kept on the phone.
- The lock screen and AirPods: ⏭ and ⏮ step through your favourites, or through your recent stations if you have fewer than two
  favourites. The list holds still while you step.
- By chat, with no model: "sleep timer 30 minutes", "turn the radio off in 20 minutes", "stop the radio at 11", "cancel the sleep
  timer", "how long until the radio stops", "next station", "previous station", "play my second favourite", "save this station",
  "what's playing". "play music", "stop the radio" and "open the radio" stay with the VOICE lane's meanings, and "play BBC Radio 4"
  with the brain. "Sleep timer" now reaches the radio before the kitchen's timers; a plain "set a timer for 10 minutes" still goes
  to the kitchen.

**Brief → a morning briefing**
- It goes in the order of your day. In the evening it looks ahead: tonight's rain, then TOMORROW, and what to wear tomorrow.
- WHAT TO WEAR comes from the forecast. Sunrise and sunset are shown. Every source is named with the time it was read.
- The headlines say when they can't be reached, with TRY AGAIN. Your to-dos due today or late are in "Your day". There is one place
  to save home and work.
- By chat: "good morning" and "what's my day look like" open the Brief and give its one line from the page's own data.

**Markets → a markets app, never advice**
- YOUR WATCHLIST: add any coin through CoinGecko's free search, move it, or remove it with UNDO. It is kept on the phone.
- YOUR COINS: what you hold, what it is worth now in your currency and how that moved today, with when the prices were read.
- A coin's sheet shows 24 H, 7 D, 30 D and 1 Y (CoinGecko's free charts) and what you have of it. A converter sits under WHAT £1
  BUYS.
- By chat: "what's bitcoin at", "how much is gold", "I have 0.2 ethereum", "what are my holdings worth", "add polkadot to my
  watchlist", "convert 50 pounds to euros". "Should I buy bitcoin" is never answered here.

**House → a home app** (through your own free Home Assistant)
- THE WHOLE HOUSE AT A GLANCE: lights on, the heating, doors open and for how long, what is not answering, what changed lately.
- YOUR SCENES and scripts, run on your tap. A scene that sets a lock still asks your confirm. PINNED things sit at the top, kept on
  the phone.
- ALL OFF for a room covers lights, fans and TVs only: never a plain switch, and never the guarded set.
- By chat, with no model: "which lights are on?", "turn everything off in the kitchen", "is the front door locked?", "what's the
  temperature inside?", "is anything open?". "Turn off the lights" turns off every light that is on, instead of asking "which
  one?". "Run movie night" runs that scene by its name once the house has been read on the phone.

**Social → only ever behind your APPROVE**
- WRITE A POST: to one account or several at once (one draft each, each with its own APPROVE). Each account has its own count, the
  way it counts (Bluesky counts an emoji as one).
- A picture needs its words before it can go, and is refused for an account that takes no pictures. What you are writing is kept
  on the phone; with no signal you can still write, and TRY AGAIN appears.
- SENT TODAY shows each post your APPROVE sent, with its link. The spec proves the page never asks to approve or send anything except
  from your tap on APPROVE.

**Links → one connections screen**
- Every connection says where it stands: not linked, linked as …, linked but not working (with why and the one next step), checking,
  or paused. A check that failed is never shown as working.
- The top line is counted from the very rows. Spotify has TEST. The brain out of reach says so, with TRY AGAIN. UNLINK says so when
  it fails.

**Home**
- The Today card shows your to-dos due today, even when the diary can't be read. With nothing else next, the hour's thing in each
  look is your to-do.
- RECENT and FAVOURITES are whole words at BODY 21. A free square says once what fills it, instead of "nothing yet" in every one.

## Decisions taken alone

- **Two to-do lists, for now.** The review found that the WORK screen already has a to-do list, kept in the brain ("add to my
  to-do: send the invoice by Friday"). The Agenda's new list is kept on the phone. Joining them properly needs the brain's list to
  learn stars, repeats and edits, which could not be done safely before the deadline. So this round:
  - the WORK screen's own words still go to its list;
  - the Agenda's words go to the Agenda's list.
  One list is the first thing in What is left.
- **To-dos, favourites, watchlist, holdings and pins are kept on the phone.** That is your own data on your own phone. It works
  offline and needs no new brain tool.
- **Markets uses CoinGecko's free, keyless endpoints only.** Nothing costs money. Nothing is a forecast or a call to buy or sell.
- **The planlane spec runs in two lanes at once.** An early run took 642 seconds on a busy container, and CI stops a spec at
  480. The parts that read your diary on the preview brain run one after another in the first lane. The parts whose sources are
  all stood in run in the second.

## How to try it on your phone

1. **Agenda → To-do:** add "Renew passport" for today and star it. Tap its words to change them. Tick it, then CLEAR DONE, then
   UNDO. In the chat: "add buy milk to my to-do list", then "what's on my to-do list".
2. **Agenda → Diary:** the month and this week are under the diary. Tap a day. Tap one of your own events to change it.
3. **Radio:** play a station and tap the AT key (the end of this hour). Lock the phone and look at the line under the station; press ⏭. Say "sleep
   timer 30 minutes", then "how long until the radio stops".
4. **Brief:** open it in the morning and again in the evening. Say "good morning".
5. **Markets:** EDIT LIST and add a coin. Say "I have 0.2 ethereum", then "what are my holdings worth".
6. **House** (with Home Assistant linked): the glance at the top, a scene, ALL OFF in a room. Say "which lights are on?".
7. **Social** (with an account linked): write one post for two accounts. Two drafts wait, each for its own APPROVE.
8. **Links:** the top line matches the rows. Tap TEST on Spotify.

## Checks

- **`tests/planlane.spec.mjs`** with a part for each screen (`tests/planlane/<screen>.mjs`): 955 checks, all green on the
  integrated branch (383 s; CI stops a spec at 480 s). Each part covers:
  - 440 × 956 and 390 × 844, BODY 21 and all seven looks;
  - every key 44 pt, nothing sideways, no word cut;
  - every state in your words;
  - the chat's wordings with no model.
  Its word, planlane, is at the end of check.yml's `all=`.
- The brain suite (2,211 tests), the typechecks, and the ratchet, knowledge, look, catalogue and meanings tests: all green. The STATES ratchet has the new
  screens' rows. The catalogue lists the new panels, with only wordings that work.
- The existing specs of these screens pass: agenda, brief, social, homepass, planmepass and markets. nav's agenda pills read the
  new truth.
- **radio.spec fails in this container, and on the untouched final branch too.** The first station never plays, because this
  container's browser will not play the spec's BBC .m3u8 stand-in. It is not from this lane.

## What is left

- **One to-do list.** Teach the brain's work list stars, repeats and edits, then move the Agenda's list onto it, so the chat, the
  Brief, Home, WORK and the Agenda all read one list.
- **The chat can't change the Agenda's to-dos from the brain's side.** The phone answers the wordings above; a question that
  reaches the brain does not see the phone's list.
- **The sleep timer lives in the open page.** A reload ends it, and that is said.
- **A Home Assistant script runs on one tap with no confirm.** Home Assistant does not say what a script does, so the phone can't
  see a lock inside it the way it can inside a scene. Scenes with a guarded thing in them do ask.
- **The house:** "turn on the lights" with no room still asks "which one?"; pins are per phone.
- **Markets:** if you take a coin off your watchlist that you still hold, its price is no longer read (the screen and the chat say so).
- **Radio:** no station detail view (codec, bitrate, homepage) yet; the sleep timer is not in the top bar.
