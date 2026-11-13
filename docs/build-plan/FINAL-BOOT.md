# FINAL ROUND: BOOT (the 7-second film, back and right)

Lane BOOT, branch `claude/new-session-4erjve-lane-boot`, 13 November 2026. The owner: "currently the boot-up cinematic is like non-existent?
It's definitely not the 7 second one we made".

## What was wrong

You were right: on your phone the film never played. You got about two seconds of a dim glow, then Home.

**The cause (one rule, in `apps/web/src/shell/boot.ts`):**
- Before the boot starts drawing it decides which version to play: the whole film, the short cut, or the flat cut for a phone with no 3-D.
- For the old 2.9-second cinematic it decided at 560 ms, when the orb starts to gather. If Mind (the 3-D orb) was drawing by 900 ms, you
  got the full version. If it was drawing by 1,700 ms, you got the short one. After that, the flat one.
- When the 7-second film was added (8 Nov), the decision moved to the film's orb, which comes at 2,000 ms. That is always after 1,700 ms.
- So on every real cold open the boot picked the flat cut:
  - 1.7 s long;
  - no 3-D, no descent, no scan, no orb forming, no greeting;
  - every shot "happening" at the same instant.
- The film itself was never broken. It just never got chosen.

**Why no check caught it:** every check that watched the film picked the version itself (`__ghostyBootKind = 'full'`). Software graphics
are too slow for the boot to choose fairly, so none of them let it choose the way your phone does.

On the preview, before the fix, a cold open left to choose for itself:
- `kind: flat, film: false`;
- every shot stamped at 2,833 ms;
- ended at 2,978 ms.

**The other candidates the round listed, checked one by one:**

| Candidate | What I found |
| --- | --- |
| The BOOT AND ORB pass (64304cd) | Not the cause. It changed words, the hold line and the fault; the cut was untouched. |
| THE EYE 2 (88274eb) | Not the cause. It only adds the eye's last shot, and only in the eye look. |
| Only once ever, or only on first install | No. Every new page plays it. A resume in the same page gets Mind's one breath. |
| A 'still' kind as the default | No. Still is only for the phone's Reduce Motion or MOTION set to calm, and MOTION defaults to alive. |
| The service worker serving a shell that skips it | No. It serves the same `index.html`. The manifest opens `/#core`, which counts as a cold open to Home. |
| The hand-over firing when the brain answers | No. `bootReady()` only removes the layer for the quiet and warm kinds. The film waits for the app, never the reverse. |
| Reduced motion on iOS treating every phone as reduced | No. Only the real Reduce Motion setting turns it on. |
| A look or world skipping it | Only in the sense below. The film is The Scan's (the default look). The other six looks keep their own 2.9-second cinematic, as their briefs set. |

**Two more things also cut the film short on a real phone:**
1. **It judged your phone by the app starting, not by the film.** It took the short cut when:
   - the ground's first frames stuttered (the app is starting underneath at that moment, on every phone);
   - or the page took over 2.5 s to show its first frame (the app is 5 MB of script).
2. **A lean made it faster.** When a quarter of the recent frames ran long, it dropped the trails and also ran 1.5 times faster. One
   stalled frame (the app building Home underneath) was enough to set it off. So even the full film could end at about 5 seconds.

## What I made

Everything is in `shell/boot.ts`. Nothing about the film's look or its cut changed; the shots and their times are the ones you approved.

1. **The film decides at its scan (500 ms)**, the first shot that needs Mind, not at its orb.
   - Until Mind draws, the room's light breathes, never a frozen frame.
   - Mind drawing by 1,500 ms: the whole film. By 2,700 ms: the short cut. The flat cut only for a phone with no 3-D, or Mind later still.
   - Any wait is made up by the pace (at most about a quarter quicker), so Home is still usable at 7 seconds. It never delays your first use
     beyond the film itself (or the app, if the app is slower).
2. **It judges the phone by the film's own drawing.**
   - It times two draws after a warm-up and takes the quicker. The film plays in full if one draw fits inside a 60 Hz frame, the rate Safari
     draws a page at.
   - The app starting underneath no longer counts against your phone.
3. **A lean never shortens the film.** On a phone that really cannot keep up, it sheds the trails and the refraction, as before, but keeps
   its seven seconds. One stalled frame no longer counts. Only a quarter of the frames running long does.
4. **THE REOPEN RULE (my call):**
   - If you had Ghosty on screen less than **three minutes** ago and the phone closed it behind you, the cold open plays **the short cut**:
     the same shots, closer together, Home at 4.8 seconds.
   - Any other cold open plays **the whole film**, 7 seconds. That includes the first open ever, and every launch after three minutes away.
   - Switching away and straight back (the app still alive) is not a cold open. It gets Mind's one breath, as before.
   - "When you were last here" is the stamp Ghosty already keeps on the phone (`state/lastopen.ts`). Nothing is sent.
   - The short cut aims to end by its own 4.8 seconds. If Mind is late it plays at most a quarter quicker to catch up, never at double
     speed, so a very late Mind ends it a little after 4.8 s instead (still well inside the full film's 7 s).
5. **bootpass was already red on the round's base.** It is on this lane's list to keep green. I fixed one part and improved the other.
   - **The orb's five states with Reduce Motion on.** Idle and attending looked almost the same: about 2.4 of 255 apart in the orb's square,
     and the check wants 5. The changes, in `features/core/mind.ts`:
     - attending's lean now tips the whole orb forward, its equator ring with it (before, only the inner constellation tipped);
     - thinking's rim and light are a step up;
     - listening's open rim is a step wider;
     - speaking's held sweep sits on the equator, where its refraction shows.

     That turned the check green at 19:20 UTC. By 19:55 it was red again on the very same build, from before and after the merge:
     the closest pair was 3.4 apart. The world drawn behind the orb (lit by the hour) or the library the preview's brain reports moves
     this measure more than the orb's own states do. I stopped tuning there, because a bigger push on light and shape barely moved it.
     The states are clearly further apart than on the base (idle and attending: 2.4 there, about 3.8 now), but the check is not reliably
     green. See "What is left". Nothing changes with motion on except these same light levels.
   - **A page error with service workers switched off.** A browser like that has no push. `assistant/push.ts` now says "unsupported" there
     instead of throwing.
6. **Unchanged, and checked:**
   - a tap skips straight to the landing;
   - Reduce Motion gets the calm still version: two frames, 1.2 s, nothing travelling, at its own unhurried pace.
   - the landing hands the orb to Home's real Mind in the hero's box to the pixel, with the house and the ask line sliding in a beat later.
   - the score, the greeting rules, "reboot", and the other looks' cinematics.

**The checks:**
- **New spec: `tests/bootfilm.spec.mjs`**, the word `bootfilm` at the end of check.yml's `all=`. It opens the app the way your phone does,
  with no version picked, and checks:
  1. a cold open at 440 × 956 and at 390 × 844 plays the film, the full cut, its whole 7,000 ms (never cut short, never longer than the film
     plus what the app needed). Every shot comes in order, and the scan, the descent and the things found run their course. Every frame is
     counted (frames, gaps, the rate it drew at, frame work).
  2. the hand-over: the one Mind in the hero, the orb's last place in the film equal to Home's hero, the HUD a beat later, and the hero in
     the same place half a second later.
  3. a tap skips it, with no greeting after the tap.
  4. Reduce Motion gives the 1.2 s still version, never hurried: one second of its own after the orb arrives, at pace 1.
  5. the reopen rule: a minute away gives the short cut (4.8 s), and so does a reload; four minutes away gives the whole film; the first open
     ever gives the whole film.

  Every check goes red on the code before this fix (it played `flat`), and green after.
- **`tests/boot.spec.mjs`** is updated to the new truth, just as strictly. Where the film leans, it must keep its whole length, not quicken.
  The old 2.9-second cinematic still must quicken.
- **Kept green:** boot, hero, polish1, octideas, thescan and eyehud2, plus the typecheck. bootpass is green except one orb check that was
  already red before this round. The results are under "The checks' runs" below.

**Timings on the preview** (software graphics, about 5 to 10 frames a second here; your phone draws at its own rate):
- before the fix: `flat`, 2,978 ms, no film;
- after, cold open at 440: `full`, the film, ended at 7,070 ms, pace 1.07;
- after, cold open at 390: `full`, ended at 7,050 ms, pace 1.03;
- quick reopen: `short`, ended at 4,813 ms;
- Reduce Motion: `still`;
- skip: landed 0.7 s after the tap.

## How to try it on your phone

1. Close Ghosty fully (swipe it away), wait **more than three minutes**, then open it from the Home Screen. You should get the whole film:
   - the eye opens;
   - the scan grows over your desk and the city lights up;
   - the descent from the sky;
   - the things locking in;
   - the orb forming;
   - the stamp typing;
   - the feeds;
   - the recognition and GHOSTY;
   - "Good evening, <your name>.";
   - the search locking on tonight's thing;
   - the landing on Home at about 7 seconds, with the orb staying exactly where it is.
2. Swipe it away and open it again straight away. You get the short cut, about 5 seconds.
3. Open it and tap the screen during the film. It lands on Home at once.
4. Settings, Accessibility, Motion, Reduce Motion on, then open it cold: two calm frames, about a second, nothing moving.
5. Say "reboot" any time: the whole film again over Home.

If it still looks short, tell me which step and roughly how long it lasted. (On a computer, the page's `window.__bootState` holds the
version it chose (`kind`), whether the film drew (`film`), its length (`ended`) and its frames.)

## What is left

- **The other six looks (Map, Eye, One Ink, Glass, Orbit, Grown Up) keep their own 2.9-second cinematic.** The 7-second film draws The
  Scan's world (the city, the street, your desk) and lands on The Scan's Home. Giving each look its own 7-second film is a design round of
  its own; the Eye's brief only added its last shot. If you use one of those looks and want the long film there too, say which, and it is
  the next thing for the boot.
- **The frame rate on your iPhone is measured on the phone, not here.** The preview draws in software at about 5 to 10 frames a second,
  so the checks prove the length, the order, the counting and the hand-over, not 60 frames a second. Each frame's own work is in
  `__bootState.budget` on your phone.
- **bootpass's orb check is not reliably green, and was red before this round.** It measures how far apart the orb's five states look
  with the motion off, and the world drawn behind the orb (it changes with the hour) moves that measure more than the states do. The
  real fix is either to make the check measure only the orb's own pixels, or to hold the world still for it. That is a change to a check
  this lane does not own, and must not be weakened, so I left it for the round, with the numbers above.
- **The app still builds Home underneath during the film.** That can cost a frame or two near the start on a slow open. Moving more of
  that work until after the landing would make the first second smoother, but it touches the whole start-up, so I left it for a round that
  owns `main.ts`.

## The adversarial review

An independent review of the change (a fresh reader given the code, not my conclusions) found two real bugs. Both are fixed, and bootfilm
checks both now:
1. **Reduce Motion was hurried.** I had capped the still version at its own 1.2 s, so a slow orb made it race through its words, and the
   greeting could vanish. It is back to its original, unhurried pacing.
2. **A quick reopen could play at double speed.** When the orb was late, the short cut sped up to fit 4.8 s. It now catches up at most a
   quarter quicker.

The words also go quiet during a hold at the original 7-second point again. The reviewer checked the rest and found it sound: the clock
never runs backwards when the version changes, the skip, "reboot", the slowdown, and the other looks unchanged.

## The checks' runs

All on the preview, Chromium with software graphics, at 440 × 956 (and 390 × 844 where the spec has it):

| Check | Result |
| --- | --- |
| bootfilm (new) | Green. Red on the code before the fix: every check failed, and it played `flat`. |
| boot | Green, with the updated lean check. |
| bootpass | Every part green except THE ORB's "five states told apart with the motion off". That part was red on the base too; it was green with my change at 19:20 UTC and red again at 19:55 on the same build. The `pushManager` page errors that were red on the base are gone. |
| hero, octideas | Green. |
| thescan, polish1, eyehud2 | Green, rerun after the orb change. |
| boot, bootfilm after merging the final branch | Green (2,204 brain tests by then). On the very first run after the preview starts, boot.spec's photographed strip twice found no feed lines at 4,300 ms (the preview's feeds not answered yet); the next run on the same build was green. In CI, boot runs well after the preview has warmed up. |
| The brain suite | 2,204 of 2,204, after the last merge. |
| ratchet, knowledge, look tests | 43 of 43. |
| Typecheck | Clean. |
