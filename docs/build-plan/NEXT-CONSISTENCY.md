# NEXT ROUND: CONSISTENCY (chat and rooms), 14 November 2026

This round I built the plan in `docs/build-plan/next/consistency.md`: section 1 whole, section 2's small part, section 3's names,
section 4 whole, and two of section 5. Everything is kept on the phone, answered with no model, and follows his rules. Anything
that would send or post still stops at APPROVE.

## What I built

**One name for every screen** (u1, and section 3's "names that mean one thing")
- **The learn screen is Courses everywhere.** Learn is the room it sits in.
- **The interpreter is Interpret everywhere.** It was "Interpreter" on its own screen but "Interpret" in the bar; the short name fits its card at 390.
- **The game maker is GAME STUDIO.** It was "THE GAME STUDIO" on its own screen.
- **The first screen is Home in every list.** The deck called it "Core".
- **FACES is the Lens mode.** PEOPLE is now only the birthdays screen, and FACES matches Settings → PRIVACY → FACES.
- **Memory's pill is ABOUT YOU.** Me is now only the room. This includes "Memory → ABOUT YOU → PLACES" everywhere it is said,
  including the brain's own replies.
- **The Theme gallery's row is "The world".** THE LOOK is the separate screen.
- **How it stays that way.** The bar has no second names left, and the consistency spec now fails whenever a screen's own title
  and its deck name differ, or the bar gives a screen another name. Every spec that read the old words was updated to the new ones,
  as strict as before.

**His own one-word routines** (s2, and voice.s7)
- **Where:** Settings → ROUTINES.
- **What a routine is:** a word of his ("Morning", "Movie time") and up to eight steps in turn. A step can be a screen, a panel,
  one of the deck's own YOU CAN lines, or words he says to me. He finds steps by typing a word ("radio"), and puts them in order
  with ↑ and ↓.
- **Starters:** MORNING and GOODNIGHT can each be added in one tap.
- **Running one:** say or type the word, or "run morning". The reply lists the steps, then they run in turn, a screen at a time,
  with his words going to me as his own message.
- **It can never send anything by itself.** A step can only move him around or say words. Words that would send reach the brain
  like any message of his, so APPROVE stops them there.
- **Refused words:** a word that already means something everywhere ("stop", "cancel", "reboot"), or one he already has, is refused
  in his words.
- **Changing them:** EDIT, DELETE and RESTORE.
- **Where it shows:** the routines are kept on this phone, listed in Abilities, and have their own spec, `routines`.

**Room readings in the Brief** (c6, built into PLAN AND HOME's screen, small and additive)
- The Brief's day now shows the next kitchen timer running on this phone ("TIMER · Pasta: 9 minutes left"). A tap opens the
  Kitchen. This was the one room line the Brief lacked.

**The search understands whole sentences** (u5, and voice.s4)
- Type "where do I paste a bank statement" and Money heads the jump bar. "Put some tunes on" finds the Radio, and "how do I count
  my squats" finds Body.
- It reads the chat's own meanings first, then his words against what every screen and panel says it does.
- A word or two stays the bar's own search.

**The help desk** (s1, and voice.s3)
- **"How do I paste a bank statement?"** is answered at once on the phone, with the taps ("Life → Money"), what it does, a way to
  say it and TRY IT.
- **Real questions are left to the brain.** It only answers when most of his words land on one screen, so "how do I fix a
  squeaky door?" still goes to the brain.
- **"What can I say here?"** gives that screen's own best wordings, each a key. This also works when asked from the search's
  "Or ask me" on any screen.

**WHAT'S NEW writes itself** (u2)
- Every ability carries the day it arrived in the catalogue. WHAT'S NEW now adds, by itself, a line a day for the last fortnight:
  "3 new things I can do: …".
- Hand-written lines stay, and an ability that already has a line that day is said only once.

**A guided tour of the house** (u4)
- "Show me around" lists the seven rooms, each with one line, one thing to try and a key into it. It then walks through them a
  few seconds each and ends on Home.
- Any new word stops it.

**Sums in the search** (my sweep against Spotlight and Raycast)
- "12*7", "15% of 80" and "2^10" are answered as he types, with COPY.
- There is no eval: it uses its own small parser.
- A lone number is still the room's thing.

## Not built, and why
- **c2, the Lens's next step.** The skeptic found it mostly built already: Lens cards offer ADD TO AGENDA, CALL, ON THE MAP,
  TRANSLATE, REMIND and FILE. Receipt-to-Money is LENS's own item (lens.c1). I left it to that lane.
- **u3 (TRY IT ticks), u6 (abilities sorted by use) and s5 (a one-page "what Ghosty can do").** All three were written for an
  Abilities page, and that page was withdrawn on the owner's own word ("get rid of the abilities page"). What answers him instead
  is "can you…?", the help desk and the tour. A one-page summary could be made from the catalogue later, if he wants a page again.
- **u7, a "what changed for you" card.** WHAT'S NEW now writes itself. Narrowing it to his screens is left.
- **u11, the deck as a magazine.** Left, M-sized.
- **u12, arranging room cards.** Left: the hubs' specs pin every card's order, and it needs his yes on the default.
- **s4, one switch for easiest reading.** Left: it belongs with THE LOOK's switches, which are POLISH 3's.
- **c3, locks on rooms.** Left: saying truly what stays on the phone, room by room, needs SECURITY's own audit first. Some rooms
  keep things in his brain, not on the phone.
- **c5, the usual room after the film.** Left: it needs an hour-by-hour record of what he opens, which doesn't exist yet.
- **"Or say" lines on screens without one (voice.s3).** Left. The help desk answers for every screen that has catalogue
  wordings.

## How to try it on his phone
1. **Routines:** ME → Settings → ROUTINES → ADD MORNING. Then type or say "morning" to Ghosty: the Brief opens, and two questions
   follow.
2. **Make your own:** NEW ROUTINE → "Movie time" → find "radio" → add the words "what's on tomorrow?" → SAVE. Say "movie time".
3. **Help desk:** ask "how do I paste a bank statement?" and tap TRY IT. On the Kitchen, open the search, type "what can I say
   here?" and tap "Or ask me".
4. **Sentences:** open the search and type "where do I paste a bank statement", then "15% of 80".
5. **Tour:** say "show me around".
6. **The Brief's timer:** start a kitchen timer ("timer 10 minutes for the pasta") and open the Brief.
7. **One name:** LEARN's first card is Courses; in the Lens, MORE → FACES; Memory's first pill is About you.

## The specialist sweep (this lane: naming and navigation, the search, the help)
- **Apple's naming (one name per thing, the same everywhere):** done, see above. Left: Me still names both the room and the
  sheet you open by tapping your initial. They are the same idea (his own things), and the sheet is the room's door.
- **Raycast and Spotlight (the search):**
  - Done:
    - sentences;
    - sums;
    - one-word routines (Raycast's aliases and quicklinks);
    - numbers and favourites were already there.
  - Left:
    - unit conversion in the bar (the converter screen does it);
    - a recent-searches row.
- **Notion's help centre ("how do I"):**
  - Done:
    - the exact taps;
    - TRY IT;
    - "what can I say here?";
    - a tour.
  - Left: short how-to cards with pictures.

## Checks
- **Brain suite:** 2,313 of 2,313 on the merged tree (05:00 UTC). The typechecks and the catalogue, ratchet, knowledge, look and
  meanings tests passed again after the last merge.
- **New specs:** `routines` and `helpdesk`, at the end of check.yml's `all=`. The consistency spec now also has the one-name check.
  All three pass on the merged tree (consistency 147 s, routines 27 s, helpdesk 32 s here).
- **Specs that read the renamed words were updated to the new words, as strict as before, and run here green:**
  - nav, tabs and tabs2;
  - memory and planmepass;
  - look and settings;
  - lens, faces, restc and awareness;
  - places, brief, machine, guardian and foresight;
  - planlane, deck and hubcards;
  - gamestudio and eyehud2;
  - homepass, further and makepass;
  - voicelane.
- **The voice lane's screen sentences follow the one names:** "Opening Interpret.", "Opening Game Studio.", "Opening Courses.".
- **Fixed in passing:** the TRY IT check measures once the reply's entrance has ended, and WHAT'S NEW keeps one list name that every
  lane adds to.
- **Timing:** the worker restarted at about 03:35, so the first merge landed at 04:53 instead of 03:30. The last merge was at 05:08
  (b5704d80).
