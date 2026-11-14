# THE APPS ROUND: PLAN: Calendar and Tasks (14 November 2026)

The flagship of the PLAN AND HOME lane this round: **Calendar and Tasks**, measured against Fantastical and Things 3. Branch
`claude/new-session-4erjve-lane-plan`, merged into `claude/new-session-4erjve-apps`.

How it was done: two builders in parallel, each in its own copy of the code. One built the tasks side and one the calendar side,
and I checked and merged their work. The round was cut short: the stop moved from 17:00 to 16:15 to stay inside your weekly
allowance, and section 2 (your other apps against their leaders) and section 3 were skipped, as asked.

## What I built

### Tasks (against Things 3 and Todoist): Agenda › To-do, the one list WORK and the chat use too
- **Quick add that reads plain words:** type "Call the bank tomorrow at 3pm p1 #Home @phone" and chips show what it understood
  before ADD: the day, the time, the priority, the project and the tags. It also reads "every Monday", "next Friday",
  "in 3 days", "by the 20th" and "daily". Tap a chip to keep those words as plain words instead.
- **Timed to-dos that ring:** a to-do with a time rings then, through the brain's own reminder (Web Push, so it rings with the
  phone locked).
  - Ticking or removing it cancels the ring, and a new time moves it.
  - "Call the bank at 3pm" works in the chat too.
  - A time with no day rings today if it is still ahead, otherwise tomorrow.
  - The row says "Due today · rings at 15:00". If this phone has notifications off, the list says so.
- **Priorities P1 to P4:** each to-do has a coloured flag. A tap sets or clears P1, with UNDO. The list keeps late first, then
  priority, then day and time. The old star is P1, so WORK and the Brief read it as before. The Starred view is now **P1**.
- **Upcoming:** the next 14 days from tomorrow, each day with its diary events and its to-dos, then Later. Quiet days fold into one
  line, and a tap opens the event in the diary.
- **Subtasks and notes:** tap a to-do to open its notes and a checklist (add, tick and remove, each with UNDO). The row shows its
  progress ("1/3"). A repeating to-do's next copy starts with its steps unticked.
- **Projects with sections, and tags:** "#Home/Kitchen" puts a to-do in a project and section. **Projects** lists every project
  and tag with its count, and a project's page groups its to-dos by section.
- **The last round's open ends on the one list, fixed:**
  - the first join keeps the phone's star, day and repeat, and never doubles a to-do;
  - the 300 cap drops the oldest done ones first;
  - a tick sent late uses the day it was made.

### Calendar (against Fantastical): Agenda › Diary
- **Drag to move:** on the day timeline, hold one of your events and drag it to a new time.
  - It moves in 15-minute steps, with a ghost showing the new time, and the page holds still under your finger.
  - It is changed in place: the same event, its length kept, its reminder moved with it, and UNDO.
  - A swipe always scrolls: the hold has to be still for 0.3 s before a drag starts.
  - A calendar feed's event says it is read only.
  - In the event's sheet, EARLIER, LATER and A DAY LATER keys do the same with a tap.
  - With no signal, the move waits on the phone and goes when Ghosty reaches the brain.
- **The week by the hour:** WEEK in TIMELINE shows seven days side by side, today first, with free time shaded. Drag across days as
  well as hours.
- **Any year:** YEAR shows twelve small months, with a dot on each day that has events and today marked. ‹ › steps years without
  limit, THIS YEAR comes back, and a tap on a month opens it.
- **Colour calendars to show or hide:** CALENDARS lists your diary and each linked calendar.
  - Each has a colour (six, all from the design tokens) and a SHOWN / HIDDEN switch, kept on your phone.
  - Hidden calendars leave the timeline, month, year and diary, and each view says what is hidden.
  - The colours mark events everywhere they are drawn.

**Its front door:** the Jump bar finds the Agenda by "calendar", "to-do list", "tasks", "upcoming" and "projects". New lists
(Upcoming's rows, the calendars sheet's states) are built from the shared App Kit's parts.

**Also fixed this round:** WORK's to-do list now says when a tick is waiting on the phone ("1 change kept on this phone: it goes to
your one list when Ghosty's brain answers again."). Before, a tick made with no signal waited without a word. The lifepass check
for it now proves the tick stays, says it waits, reaches the brain once it answers, and is sent once only.

## How to try it on your phone

1. **Quick add:** Agenda › To-do. Type "Call the bank tomorrow at 3pm p1 #Home" and look at the chips, then ADD. At 3pm it rings
   with the phone locked (if notifications are on).
2. **Priorities and P1:** tap a to-do's flag, then the P1 view. Tap a to-do to add notes and three steps; tick one and the row
   says 1/3.
3. **Upcoming and Projects:** open the Upcoming view, then Projects, then your project.
4. **Drag:** Agenda › Diary › TIMELINE › TODAY. Hold one of your events and drag it an hour later, then UNDO. Try WEEK and drag one
   to tomorrow.
5. **Year and colours:** MONTH › YEAR, step back a year, and tap a month. Open CALENDARS, give a feed a colour and hide it.

## Checks

All run on the merged lane branch:
- **`tests/planlane4.spec.mjs`**, this round's spec, with its word in check.yml's `all=`, has two parts: `tasks` and `calendar`.
  - Together: 290 checks, 0 problems, in 94 s.
  - Each covers 440 × 956 and 390 × 844, BODY 21, the seven looks, every state in your words and the chat's wordings.
  - Drags are real mouse and touch drags, and every move is read back from the brain.
  - The two parts run one after the other, because the calendar's events would otherwise show in the tasks part's Upcoming.
- **The lane's other specs:**
  - planlane2's timeline part: 88/0; its onelist part: 41/0;
  - planlane's agenda part: 157/0;
  - agenda.spec: clean;
  - lifepass: clean, 407 checks, including the new W9.
- **Brain:**
  - Both typechecks pass.
  - The brain tests for these screens (agenda, work, ratchet, catalogue, knowledge, look and meanings): 117/117.
  - The full brain suite: 2,395 of 2,396. The one failure is another lane's new app-library catalogue: "episode-planner: a keyword
    names a brand", in packages/shared/src/applib/catalogue/create.ts. This lane never touched that file.
- **Two problems found by the checks, fixed:**
  - The to-do list's ring line made the timeline's pure check load the notifications file, which listened for a window event at
    load time and broke in Node. That listener is now only set where there is a window.
  - One colour read in the calendar's seven-looks check could land on a block the timeline had just redrawn. It now reads again
    from the block on screen, and the check is as strict as before.

## What's left

- **His own repeating events with exceptions** (repeat daily, weekly, monthly or yearly; skip one; change only one): not started,
  because the round was cut short.
- **Chat wordings** for YEAR, WEEK and one project's or tag's list.
- **Sorting:** dragging to reorder sections, and "every other Tuesday" repeats.
- **Attachments** on a to-do.
- **Home and the Brief:** a Home card for priorities and projects.
- **The calendar's offline queue:** the phone saves its queue about 200 ms after a change. A reload straight after a queued change is
  sent can send it a second time. Sending the same move again does no harm, but a late duplicate could undo a newer change made
  elsewhere.
- **Moving the Agenda wholly onto the App Kit** (its own header, bottom keys and settings): it uses the kit's rows and states for
  the new lists, but the Agenda's frame is still the older sheet page.
- **Section 2 (Mail, Shortcuts, Focus, THREATS, Radio and Headlines) and section 3:** skipped this round, as asked.
