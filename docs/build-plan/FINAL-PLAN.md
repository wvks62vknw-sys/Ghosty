# FINAL ROUND: PLAN AND HOME (13 November 2026)

The lane for the agenda, the brief, the house, markets, the radio, social, links and Home. Branch `claude/new-session-4erjve-lane-plan`.
Nobody was there to ask, so each decision is written here with its reason.

## What was wrong

- **Agenda:** it was a diary and a reminders list, not a calendar or a to-do app. It had no to-do list and no month view.
  Deleting an event or cancelling a reminder with no signal threw an error that nobody saw: nothing on screen said it had failed.
  The empty diary said "connect a calendar below", but on the phone the calendars are under their own pill, not below.
- **Radio:** it had no sleep timer and no list of stations played lately. The lock screen and AirPods could play, pause and stop,
  but next and previous did nothing. A station's line in the lists was cut off with "…" when it was long.
- **Brief:** "Your day" left out the things he had to do that day (there was no to-do list for it to read).
- **Social:** there was nowhere on the screen to write a post. A post could only start in the chat.
- **Links and Social:** UNLINK for email, Spotify, Bluesky, Mastodon, Discord and the Telegram channel always said "unlinked",
  even when the unlink had failed and the account was still linked. That is a promise the code did not keep, and it matters for
  privacy. Discord's COPY THE ADDRESS did nothing when the phone refused to copy.

## What I made

- **Agenda → To-do** (a new pill, and the panel `TO-DO`). Add a to-do and, if you want, the day it is due. It says "Due today",
  "Due tomorrow", "Due Fri 20 Nov" or "2 days late". Late ones come first, then by day, then the ones with no day, and done ones go
  to the bottom. Tick a to-do off with a 44 pt round key, remove it with ✕, or clear all the done ones with CLEAR DONE. Every removal
  has UNDO. The list is kept on the phone. The agenda's top line counts the to-dos ("3 to do").
- **Agenda → Month** (under the Diary pill). The month as a calendar, Monday first. A dot marks a day with an event, a ring marks
  a day with a to-do due, and today is lit. Tap a day to see its events and to-dos listed under the grid. ‹ and › move between this
  month and next month. A day that has gone, or one further ahead than the diary reads, says so instead of looking empty.
  The diary now reads 42 days ahead (the brain allows 62). The diary list still shows the next 14 days, as its title says.
- **Agenda:** a failed delete or cancel now says so in plain words, and the event or reminder stays on the list.
- **Radio → Sleep timer.** While a station plays: 15 MIN, 30 MIN, 45 MIN, 1 HOUR or 90 MIN. The line says "Goes quiet at 23:10
  (in 30 min), then stops." The radio fades out over its last 20 seconds, then stops. The key you chose stays lit, and TIMER OFF
  cancels it. The timer only lasts while the page is open: a reload is treated as a new night.
- **Radio → Recent.** The last eight stations he played, newest first, each one tap from playing again. CLEAR RECENT has UNDO.
- **Radio → Lock screen and AirPods.** ⏭ and ⏮ now step through his favourites, or through the recent stations if he has fewer
  than two favourites. The screen's `describe()` now mentions the sleep timer, so the chat can see it on screen.
- **Radio:** a long station line wraps onto a second line instead of being cut off.
- **Brief → Your day.** It now shows a TO-DO row for the to-dos due today or late (tap it to open the To-do list). BRIEF ME
  includes them in the briefing it asks for.
- **Social → Write a post** (under the queue). It offers only the accounts he has linked and counts letters against what each
  account takes ("212 of 300 letters"). MAKE THE DRAFT calls only the brain's draft route. The draft then waits in the queue above
  with APPROVE · EDIT · NO, like every other draft. The page never approves or sends anything itself; the spec checks this.
- **Links and Social:** a failed unlink now says so in plain words. "Unlinked" is said only when the account really was unlinked.
  A copy the phone refuses now says to press on the address and copy it from there.
- **The catalogue** names the new panels (TO-DO, MONTH, RECENT) and the To-do pill, with honest ways to say each.
  I did not list "turn the radio off in 30 minutes" or "what do I need to do today?" as things he can say: the chat cannot do
  them yet (see What is left), and the catalogue promises only what works.

## Decisions taken alone

- **To-dos are kept on the phone, not in the brain.** That needs no protected brain files and no new tool. It works offline, and
  it is his own data on his own phone. The cost is that the chat cannot read the list yet (see What is left).
- **The month view covers this month and the next only**, because that is what the brain's agenda route reads (from today, up
  to 62 days). It does not offer past months it would have to show as empty.
- **Markets and House: no new features.** I audited both. Markets already says every state in his words, and House already asks
  his confirm for guarded things every time and handles a brain it cannot reach. With the time left, the new work went to the
  agenda, radio, brief and social, where the gaps were real.
- **The CSS is tokens only.** No new hex, rgba() or px radius, so the colour ratchet did not move.

## How to try it on his phone

1. **Agenda → To-do:** type "Renew passport", pick today's date, tap ADD. It shows "Due today". Tick it, then tap CLEAR DONE,
   then UNDO.
2. **Agenda → Diary:** scroll to the month. Today is lit. Tap any day to see what is on it. Tap › for next month.
3. **Brief:** with a to-do due today, "Your day" shows a TO-DO row.
4. **Radio:** play a station, tap 30 MIN under it. Lock the phone: ⏭ moves to the next favourite. RECENT lists what you played.
5. **Social → Waiting** (with an account linked): write a post, tap MAKE THE DRAFT. It waits above for your APPROVE.

## Checks

- New spec `tests/planlane.spec.mjs` (88 checks). It covers the pure words, the to-do list (adding, the order, its words, ticking,
  CLEAR DONE and UNDO, the list surviving a reload), the month, the brief's TO-DO row, the radio (the sleep timer and its line,
  TIMER OFF, RECENT, ⏭ on the lock screen) and social (only a draft is ever asked for, never APPROVE). It runs at 440 × 956 and
  390 × 844 and in all seven looks, and checks that every key is 44 pt, nothing scrolls sideways and no word is cut. Its word is
  appended at the end of check.yml's `all=`.
- `tests/nav.spec.mjs`: the agenda's pills now read "Diary, To-do, Reminders, Spending, Calendars".
- The STATES ratchet has two new rows: `agenda.todo` and `radio.recent`.
- The catalogue test is green with the new entries.

## What is left

- **The chat cannot read or add to-dos yet**, and it cannot set the sleep timer. Both need a phone command, which means touching
  the brain's protected tool list together with the VOICE lane's wordings. That is the next step after this round.
- **The sleep timer does not survive a reload.**
- **Markets:** a watchlist and his own holdings ("what is my Bitcoin worth") would make it a full markets app.
- **House:** scenes ("goodnight": every light off) built from his own Home Assistant scenes.
