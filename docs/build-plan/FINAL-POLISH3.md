# FINAL ROUND: SYSTEM AND SETTINGS (POLISH 3), the lane's report (13 Nov 2026)

Branch `claude/new-session-4erjve-lane-polish3`, merged into `claude/new-session-4erjve-final`.

## What was wrong
- POLISH 3 (one sentence a screen, the Agenda and System passes, SMALL FIXES 2) was finished on its own branch but left out of
  the combined landing. CI went red: about twenty specs still read the old, longer words.
- In a few places the new words had dropped a promise:
  - the voice model's "it is never a lock" was hidden behind a WHY;
  - the Lens's eyes' "nothing of what it sees is ever sent" was hidden the same way;
  - MEASURE THE BRAIN no longer said that nothing is downloaded;
  - HEALTH's KEYS line counted the missing keys but no longer named them.
- Some of the work was left undone:
  - the photo editor's edits and the video editor's projects were not in the daily backup;
  - the 40 px touch rule had not been measured against 44 pt;
  - the jump bar's ten runs had not been done;
  - polish3.spec exited 0 even when it printed red lines;
  - the money pack still had its own tick in the brain's agent file.
- Smaller things:
  - Reverse's line was too long for its card on the Make hub;
  - a browser that blocks service workers threw a page error about `pushManager` on every screen;
  - the Gym's game review said "Your the odd threat…".

## What I made
- **POLISH 3 is in.** I applied all 21 of its commits on top of the final tip and kept both sides of every conflict:
  - WORKSPACE is on the Ghosty plate once;
  - phonehw counts the seven standard eyes packs;
  - THE LOOK's top line and look.test agree: "This is how I draw everything from here; tap a mark to see it work.";
  - the clean-state fixture has no placeholder comment;
  - every spec still defaults to port 8788.
- **Every spec that went red was checked against the new words.** Where the new words are right, the spec now reads them and is
  exactly as strict as before. Where a fact moved behind a WHY, the spec reads the whole row and also checks the WHY is there:
  - speaker
  - offline2
  - meaning
  - character
  - undo
  - bigbrain
  - selftrain
  - offlinebrain
  - offlineeyes
  - faces
  - phonehw
- **Where a promise was lost, I fixed the app instead of the spec:**
  - "It is never a lock" is the voice model panel's first, visible sentence;
  - "nothing of what it sees is ever sent" (Lens) and "nothing you say is sent" (voice) are on screen;
  - the phone card says "Nothing to time and nothing downloaded";
  - HEALTH's keys line reads, for example, "2 of 20 added: Gemini, Groq; not yet: Tavily, TomTom, Brave and 15 more (as of 10:00)."
- **The daily backup now carries the editors' work.** It holds each edited photo's recipe (with the brush masks it uses), your own
  saved looks, and each video project. It never holds the photos or clips themselves: those stay on the phone. RESTORE puts each
  one back where the backed-up copy is newer, and says what it did, for example: "Put back in the editors: 1 photo edit, 1 look
  of your own, 1 video project." An edit whose photo is not on this phone is counted and said, never invented. polish3.spec's
  section h proves it in a real browser database.
- **44 pt.** I measured every screen at 390 and 440. Ten keys sat at exactly 40 because of the global touch rule: three on System
  (the links line, REBOOT HIM, FORGET OWNER KEY), five on the interpreter, one on rehearse and one on photo. The rule now uses
  the 44 pt token, so all ten are fixed in one place. Keys drawn at their own fixed size keep their own rule.
- **The money pack's tick** (agent.ts, protected; changed under your "full permission"): only the comment changed. The follow job is
  the home pack's planning watch plus a one-time move of any old price watch into WATCHERS. The money pack no longer sets its own
  beat (money.test checks this). WATCHERS is the only thing that reads a price, so a drop is told once.
- **The rest:**
  - polish3.spec exits 1 on any red line;
  - Reverse's line is "Paste a link and I take it apart, piece by piece", the same on its page and its card;
  - push no longer throws when the browser blocks service workers;
  - the Gym's review reads "Your odd threat on the third row of column 5.";
  - `polish3` is the last word in check.yml's `all=`.
- **The jump bar (item 8).** tabs.spec's opening, run ten times on its own, each a median of five:
  - at normal speed: 56, 50, 56, 51, 47, 58, 52, 52, 54, 50 ms;
  - with the CPU slowed four times: 81, 74, 80, 86, 87, 92, 76, 85, 95, 84 ms.

  Every run is under 250 ms, with the 300 ms budget untouched. tabs.spec passes on its own (it read 371 ms only while four other
  specs ran beside it).
- **Merging the final branch:**
  - the WATCHERS rows keep POLISH 3's time-first layout and gain the recall lane's DRAFT A CHASE;
  - School keeps the voice lane's written-out working and still says "I";
  - the meanings test accepts the phone's "open a screen" table when it opens the same screen the meaning would ("open the arcade"
    opens the Arcade either way);
  - the selftrain test builds with the Worker's sockets marked external, as the suite's own build steps already do. It was red on
    the final tip too: a school file now reaches the mail code.
- **The second merge:** the money pack keeps the one-watcher system and gains the security lane's address guard. What's New keeps
  the consistency lane's lines plus POLISH 3's lines that say something different, newest first, none twice. The memory lane's
  new System line now says one sentence: "Recall index: empty; it builds while the phone sits idle."
- **polish3.spec's own race:** section c slows the brain to check System's waits. It now does so from the first request and waits
  on the real condition, the page built and its three waits said together, instead of a fixed sleep. Before, an answer Home had
  already fetched could reach System first.
- **Decided, as the brief said:** School and the Gym speak as "I" and keep doing so.

## How to try it on your phone
1. Settings → VOICE MODEL: the first line says it is never a lock. Tap WHY to see the licence and the 27 MB.
2. System → THE BRAIN: the KEYS line names what you have and what is missing.
3. Edit a photo, make a short video project, then System → BACK UP NOW. On another phone (or after a reset) use RESTORE: the
   project comes back, and the photo edit comes back on any phone that still has the photo.
4. System: REBOOT HIM and FORGET OWNER KEY are full-size keys.
5. Make → Reverse: the card's line fits in two lines.

## What is left
- The jump bar's ten runs were measured in this container, with the CPU slowed to stand in for the runner. The runner itself
  cannot be measured from here.
- homepass's house line hangs on its first tap in this container, on the untouched final tip as well, so it is not from this lane.
  CI will show whether it happens there too. Its BRIEF section, the one CI had listed, runs clean.
- The Gym's "opens on the page of the game played last" check was red once, while four specs ran at the same time. It was green
  when the Gym spec ran again with less load.
- The specialist pass on System, Settings, Me, THE LOOK and the chat core went as far as this list shows. Each of those screens was
  measured for 44 pt and sideways scrolling in the default look, Glass and Ink. The other four looks and BODY 21 were not swept
  screen by screen before the deadline.
