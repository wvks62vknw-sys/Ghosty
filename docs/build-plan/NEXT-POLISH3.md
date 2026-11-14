# NEXT ROUND: SYSTEM AND SETTINGS (14 November 2026), the lane's report

Branch `claude/new-session-4erjve-lane-polish3`, merged into `claude/new-session-4erjve-next`. Spec: `systemnext` (its word at
the end of check.yml's `all=`).

## What I built

### Everything works with no signal (this lane leads it)
- **How ready I am offline** (polish3.u10, with c4). System → Status → OFFLINE READY:
  - one number for how much of Ghosty works with no signal right now, with a bar;
  - each piece (the offline brain, the offline map, the Lens's eyes, the namer, search by meaning, measure, people, the voice
    model and the three photo tools), marked HERE, TO GET with its size, or CAN'T when this phone cannot run it;
  - the one download that would help most, with its size, what it keeps working and the new number once it is here.

  How it counts: each piece weighs what it carries. The brain is 34, the map and the Lens's eyes 15 each, the namer and search
  by meaning 8 each, measure and people 5, the voice model 4, and each photo tool 2. Anything the phone can't run is left out of
  the count and said.

  GET IT IN SETTINGS opens the panel that fetches it; the download itself still only starts on your tap, on Wi-Fi, with its
  size said.

  In the chat, "how ready are you offline?" (and other wordings) answers on the phone and opens the panel.
- **A saver switch** (polish3.s1, reshaped). Settings → SAVER: while it is on, the offline packs, the offline brain and search
  by meaning don't start downloading, and the background feeds stop refreshing on their own. Anything it holds back is said in
  plain words and listed. "Turn on the saver" and "saver off" work in the chat. An iPhone web app can't read the battery or
  tell mobile data from Wi-Fi, so it is a switch you flip.

### Safe, private and in your hands
- **Your backup as a file** (polish3.u5). System → Backup:
  - SAVE AS A FILE keeps the same locked copy in Files or iCloud Drive;
  - OPEN A BACKUP FILE brings it back on any phone of yours, opened with your owner key;
  - a file that isn't a backup is refused in plain words.
- **See what a restore brings back** (polish3.u4). Before any RESTORE, from the brain's list or from a file, a sheet lists each
  thing in the backup:
  - each one either comes back, is joined with yours (the newer of each part wins), or is already the same here;
  - you untick anything you would rather keep as it is;
  - RESTORE N THINGS writes only what is ticked.
- **Everything I keep about you, one place** (polish3.s2, with memory.s6). Settings → Privacy → WHAT I KEEP ABOUT YOU, each kind
  with its own key:
  - **Memory** and **places**, counted from your brain: OPEN TO FORGET opens Memory, where each one goes with UNDO.
  - **Faces** and **voices**, yours and the people you introduced, counted on this phone: FORGET ALL, asked first.
  - **EXPORT MY MEMORY** saves everything I remember as one plain document.
- **Your comics and games are backed up** (polish3.c1, built into the COMIC and MAKE areas, small and additive):
  - the daily locked backup carries each comic you made as its script, and each game from THE GAME STUDIO whole;
  - a restore puts back what this phone doesn't have, or has an older copy of.

### Keys, training and speed
- **A heads-up before allowances run out** (polish3.s9). I tell you once a day, with what to do, when:
  - a key stops working;
  - a free AI provider is nearly out, or out, for the day;
  - the database is nearly full.

  The line also stays at the top of System → AI ROOM while it lasts.
- **Watch the offline brain improve** (polish3.u3). System → Training draws every finished week's test scores, the average and
  each area, kept on your phone as each report arrives. Nothing is drawn until a week has really finished.
- **Screens that got slower are flagged** (polish3.u11). System → Status → SPEED names a screen that opens slower on your phone
  since the last update. It needs three opens on each side, at least a quarter slower and 80 ms more, so one slow moment is
  never called a slowdown.

### Section 3: finishing what was half done
- **Offline brain training, the daily GPU and night school:** what is missing is your two free keys (Kaggle and Hugging Face).
  I can't add them for you. The Training page already says exactly which keys, where to make them, and that no week has been
  tried for real yet. Once you add them, TRAIN NOW runs the first week, and the new chart starts filling.
- **Offline eyes:** the screen already says plainly that one size is all for now, with the reason behind its "?". There is
  still no larger free model with a clear licence to add.

## How to try it on your phone
1. **Offline readiness:** say "how ready are you offline?", or open System → Status → OFFLINE READY. Tap GET IT IN SETTINGS,
   then GET on Wi-Fi. The number goes up.
2. **Saver:** Settings → SAVER on, then try any GET in Offline eyes: it waits and says why. Say "saver off".
3. **Backup:** System → Backup → SAVE AS A FILE, then Save to Files. Later, OPEN A BACKUP FILE, pick it, look at the list,
   untick something, then RESTORE.
4. **Privacy:** Settings → Privacy, then WHAT I KEEP ABOUT YOU, then EXPORT MY MEMORY.
5. **Heads-up:** when a free allowance runs low, you get a heads-up once; System → AI ROOM keeps the line.

## Checks
- **Brain:** offline2.test covers the readiness scoring and wordings, the heads-ups, the saver and the slowdown rule. The full
  brain suite passed (2,229 of 2,229) before the saver and restore-preview work, and the targeted brain tests pass after it.
- **systemnext.spec:** 135 checks at 440 × 956 and 390 × 844, in all seven looks and at BODY 21, covering OFFLINE READY, the
  backup file, the restore preview, comics and games in the backup, the saver, the privacy page and the memory document, the
  slowdown flag and the heads-up.
- **Specs that read words I changed** were re-run green: backup, selftrain, polish3, settings, faces, voice, planmepass, tabs,
  health, thescan, offlineeyes and speaker.

## What is left
To be filled in at the end of the round.
