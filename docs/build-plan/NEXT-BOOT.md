# THE NEXT ROUND: BOOT (the opening, your way)

Lane BOOT, branch `claude/new-session-4erjve-lane-boot`, 14 November 2026. The 7-second film stays exactly as you approved it. This
round made it yours to shape, made it know your day, and made it faster and more honest.

## What I built

**Finished from last round (section 3)**
- **The orb's five states, checked so it passes every time.**
  - The cause: the check measured the orb in front of The Scan's city, and the city changes with the hour.
  - The check now measures the orb in One Ink, where it is drawn alone on a plain ground (the same state measured twice reads exactly
    0 apart), with the same thresholds as before.
  - The states are also clearer:
    - thinking shows its thirty-six pulses a little larger when nothing moves;
    - idle is a step quieter;
    - speaking is half open;
    - attending tips forward more.
  - Every pair of states is now well apart at both phone sizes.

**Soon (section 4)**
- **An opening that knows your day (boot.u2).** As the film's search shot locks on, one line under the greeting says what matters today.
  It uses only your own records, in this order:
  1. the next thing in today's diary ("Today · 10:30 · Dentist");
  2. else a to-do due today ("Due today · Pay the window cleaner");
  3. else rain on the way ("Rain · Likely from 15:00 · 70%").
- **A faster start under the film (boot.u10).** While the film plays, the start-up jobs that can wait start a moment after it lands:
  notices, push, the library's copy, the queued sends and the trained brains. The first seconds belong to the film and to Home.

**The best of later (section 5)**
- **Choose how long the opening is (boot.u4).** Settings → VOICE & HOME → THE OPENING has three keys: FULL FILM, SHORT, or ONCE A DAY
  (the whole film on the day's first open, the short one after). You can also say "short opening", "the full film every time" or
  "opening once a day".
- **A greeting that remembers (boot.u8).** Away two days or more, it says "Welcome back, Tony. It's been three days." It uses only
  the phone's own "last here" stamp, and "reboot" never says it.
- **Your own opening line (boot.s9).** Type it in Settings, one line each; several take turns. Leave it empty for the greeting by the
  hour.
- **Greet a guest you introduced (boot.s7).** Say "Sam's turn" and the next opening greets Sam by name, once.
  - It works only for someone you have already introduced (a face or a voice kept on this phone). For anyone else it says so and
    changes nothing.
  - No camera or microphone is used at the opening.
  - "No guest" undoes it.
- **See how smoothly the opening ran (boot.u9).** Settings shows, for the last opening: which version played, how long it took, its
  frames per second and its longest pause. Say "how did the opening run?" for the same sentence.
- **The orb's lights explained once (boot.u11).** This was already there from the last round: the first time the orb listens or
  thinks, one line says what that light means. It is checked again here.
- **Step through the opening shot by shot (boot.u12).** Say "director mode", or tap STEP THROUGH IT in Settings.
  - The opening plays again over Home one named shot at a time ("3 of 10 · The edges, the things · 0.9 s"), with PREV, NEXT and DONE
    (the arrow keys work too).
  - DONE lands on Home exactly as the film does.
- **The opening's music in your colour's key (boot.u7).** The score under the film moves to your colour's key: Blue in A, Orange three
  semitones up, each colour its own. It takes the hour's texture: brighter in the morning, warmer in the evening, darker at night with a
  minor chord. It is still made on the phone, and still silent until your first tap.
- **An offline opening (boot.s10).** With no signal, one line says "Working offline" and what still works on this phone:
  - with its own brain downloaded: "I still answer from this phone";
  - without it: "answers wait for a signal".

**Your specialist sweep (section 6): the best launches, compared**

Measured against Apple's boot and the best iPhone app launches (instant, never in the way, always skippable):

| What the best have | Ghosty now |
| --- | --- |
| Skip at any moment | A tap anywhere, and now also Escape, Enter or the space bar on a keyboard. |
| Tells a screen reader what is happening | New. The boot layer says "Ghosty is starting. Tap anywhere to skip." to VoiceOver. |
| Never slows the app | The film runs while the app starts underneath, and the jobs that can wait now wait for the landing. |
| Lands with no jump | The orb lands in Home's hero to the pixel, and the bar and cards slide in a beat later (checked every run). |
| A quick relaunch is short | Under three minutes away it plays the short version, and you can choose SHORT or ONCE A DAY. |
| Reduce Motion is respected | A calm two-frame version at its own unhurried pace. |
| No sound before you touch it | The score waits for your first tap, as iPhone requires. |
| Remembers you | It greets you by name, says how long you've been away, uses your own line, or greets a guest you named. |
| Fails honestly | "I couldn't start this time. Tap to try again." Offline it says so, and a slow start says what it waits for. |

## How to try it on your phone
1. Settings → VOICE & HOME → THE OPENING. Tap SHORT, close Ghosty fully, open it: about 5 seconds. Tap FULL FILM: the whole 7 seconds.
2. Add a to-do due today, then close and open Ghosty. The opening ends on "Due today · …" under the greeting.
3. Type two lines in YOUR OPENING LINE. Each open greets you with the next one.
4. Say "director mode". Step through with NEXT and PREV, then DONE.
5. Say "how did the opening run?", or read HOW THE LAST OPENING RAN in Settings.
6. Turn on Airplane Mode and open Ghosty cold. The opening says it is working offline and what still works.
7. Say "Sam's turn" (for someone you introduced in the Lens), hand the phone over, and close and open it: "Good evening, Sam."

## The checks
- `tests/bootfilm.spec.mjs` (this lane's spec) checks everything above at 440 × 956 and 390 × 844:
  - the length keys, by tap and by words;
  - the greeting after three days away;
  - your own lines taking turns;
  - a guest greeted once;
  - a guest nobody introduced refused;
  - the run line in Settings and in the chat;
  - the start-up jobs waiting for the landing;
  - today's line;
  - the offline line;
  - the director's mode;
  - the score's key in Blue and in Orange, and its night texture.
- `tests/bootpass.spec.mjs` measures the orb's states in One Ink.
- `tests/boot.spec.mjs` allows today's and the offline line only as the very lines the boot says it showed.

## What is left
- **A full seven-second film for each of the other six looks (section 3, and boot.u1).** The Map, The Eye, One Ink, Glass, Orbit and
  Grown Up still open with their own 2.9-second version. Each needs its own drawn shots to be as rich as The Scan's, which is a design
  round of its own. Not started, rather than half done.
- **Opening lit by the hour and season (boot.u3), short films for big moments (boot.s2), saving
  your opening as a video (boot.s3), a big-screen TV opening (boot.s4), a film of your day (boot.s8), a comic-panel opening (boot.c3),
  the Eye opening on your camera wall (boot.c4), the Lens shortcut's lock-in (boot.c6), and landing straight on today's lesson
  (boot.c5).** These are listed for a later round, so the opening stays whole and green now.
