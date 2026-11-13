# FINAL ROUND: CONSISTENCY (13 November 2026)

The owner asked: "audit the entire thing for anything that contradicts itself, any errors, anything wrong". This lane covered
everything that crosses screens: every claim Ghosty makes about itself (the persona and prompt, the tools' descriptions, the
abilities and "can you…?" answers, the catalogue, WHAT'S NEW, the settings and help words, the deck and the hub cards) against
what the code does, and the errors, counts and numbers across the app and the build-plan docs. His voice being recognised
in the chat was left to the VOICE lane, as the brief says.

## What was wrong, and how each was settled

Each line says what Ghosty said, what was true, and whether the words or the code changed.

### What the brain says about itself
1. **Lessons.** `learn_lesson` said a lesson "will be in your instructions from now on". In fact, lessons reach the prompt only
   when he builds or changes code (`prompt.ts`, `opts.code`). **Words changed:** "whenever you build or change code". The
   header comments in `knowledge.ts` and `permissions.ts` changed to match.
2. **"I can put on record what me expect…".** The foresight line came out as broken English in his voice, on ABILITIES, in WHY and
   in "Did you know". **Words changed:** "put on record a forecast". The new spec turns every group's line into his voice and
   checks it reads as a sentence.
3. **"I can keep your money."** This read as if Ghosty holds his money, which it never does. **Words changed:** "track his money".
   "Keep his body pack" became "track his health", and "run his kitchen pack" became "run his kitchen" (all within the prompt
   budget).
4. **"Open his camera (open_lens)".** The brain cannot switch the camera on; only his own tap starts it (`commands/builtin.ts`,
   `features/lens`). **Words changed:** "open the Lens". The catalogue now says "the camera itself starts only on your tap".
   (This needed one line in the protected `tools/index.ts`, and the commit says why.)
5. **`open_lens` said its default mode was "see".** The code falls back to the Lens home. **Words changed.**
6. **Earthquakes.** The tool and the catalogue said "magnitude 2.5+", but the code's default cut-off is 4. **Words changed:** "M4+
   by default"; the catalogue says you can ask for smaller ones, down to 2.5.
7. **`library_import`'s offset said "GitHub only".** It also continues self-imports and Gutenberg. **Words changed.**
8. **`motorway_now` said "default 15".** It is 15 around a place and 60 otherwise. **Words changed.**
9. **`set_theme` and `set_sensor_mode` left out Orbit, Grown Up and HOLO**, so the brain would have said it couldn't use them.
   **Words changed.** All seven worlds and every sensor mode are now named, inside the 6,500-character tool budget.
10. **The game said it was "kept in his library".** It is kept in his Game Studio, not on the LIBRARY tab. **Words changed.**
11. **Social said "I can use your own accounts" with none linked.** **Code changed:** social now has a "needs linking: LINKS →
    BLUESKY" entry (`GROUP_NEEDS`), so ABILITIES and "can you…?" say so honestly until an account is linked.

### The catalogue (the everything tab)
12. **Grounds, switches and presets.** Their words and TRY IT sent him to "Settings → Theme → Ground / Switches", and "the
    seventeen presets and the dials". Settings → THEME has had none of these since the gallery; it has seven looks and twelve
    colours. **Words and links changed:** grounds, switches and presets now go to THE LOOK → THEMES, and worlds go to Settings →
    THEME (the seven looks). `abilities/sources.ts` now aims each one at the screen that really has it.
13. **`set_theme`'s entry said "every screen keeps its layout".** That is true of a colour, but a world is a whole different
    look. **Words changed.**
14. **Optional keys.** "SYSTEM → KEYS → TomTom traffic" and nine others are filed under the OPTIONAL fold, which stays shut until
    he taps SHOW OPTIONAL KEYS. **Words changed:** "SYSTEM → KEYS → OPTIONAL → …". The spec checks every key path against
    `keys.ts`: the key exists, and OPTIONAL is said exactly when it is optional.
15. **The statement need on the Money screen** said "added in Agenda → SPENDING", but Money is itself where a statement is
    pasted. **Words changed:** "pasted in Money or added in Agenda → SPENDING".

### The deck and the hub cards
16. **Markets promised "the FTSE, gold, oil" and "indices".** The screen shows crypto, gold and silver, and currencies only.
    **Words changed:** "Crypto, gold and currencies, live" and "Gold, silver and what £1 buys abroad", which opens GOLD & SILVER.
17. **Settings said "seventeen presets and the dials"** (in fact nineteen presets, and none on that page) and **"three dials"**
    (CHARACTER has four, the fourth being fiery). **Words changed:** "seven looks, twelve colours" and "Four dials: dry, brief,
    warm and fiery".
18. **"Brief me: weather and headlines in 90 words" opened HEADLINES**, which is the same as the line above it. **Link changed:**
    it now opens the Brief at its top, where BRIEF ME is.
19. **"Gear ratios and an engine's power" opened GEARS only.** **Words changed:** "Gear ratios, worked out".
20. **The Arcade** was in the deck's groups with no words, so its card showed no YOU CAN lines. **Words added:** three lines,
    each opening its own panel.
21. **Two screens called "Home".** The bins-and-bills screen was titled HOME and named "Home" in the deck, which is also the
    first screen and the HOME room. **Code changed (minimal, a MONEY lane screen):** it is now **HOUSEHOLD**, and its sheet is
    "the HOUSEHOLD sheet" everywhere it is named. The tabs spec now reads the new name.
22. **The deck's header comment** said "twenty screens" and "Night School (planned, not built)". There are forty-four screens,
    and Night School is built. **Comment changed.**

### WHAT'S NEW, settings and help
23. **WHAT'S NEW stopped at 31 October.** The panel came back on every new build only to say "Nothing new". **Words added:**
    eight lines for November (the seven editors, photo and video, games of his own, working on what he has open, chat and
    Telegram, THE WALL and THE EYE, the looks, the Arcade and LIFE).
24. **WHAT'S NEW, 24 Oct, said "the new look is now the only look… Reactor or Graphite".** **Words changed:** it now notes that
    since 7 Nov there are seven looks and twelve colours.
25. **The sound comment** said "System → Look & Voice"; the switch is in Settings → VOICE & HOME. **Comment changed.**

### Errors across the app
26. **"Cannot read properties of undefined (reading 'pushManager')".** A browser that blocks service workers hands back no
    registration, and the push set-up threw an unhandled error. This failed the machine and upgrades specs in this container's
    browser. **Code changed (minimal, `assistant/push.ts`):** no registration now means "no push", said once and never thrown.
27. **The full brain suite:** 2,153 of 2,153 tests pass, before and after.
28. **Every screen at 440 and 390, and Home and every hub in all seven looks:** no console error, no unhandled error, nothing
    scrolling sideways (the new spec, `errors`). A one-off full sweep of every screen in every look is `FULL=1`.
29. **Dead keys:** none. Every visible key on every screen has something listening to it. The check plants a dead key first and
    must find it, so it cannot pass blind.
30. **The hub cards' counts** match their areas' screens (MAKE's editors folded as one card with seven pills; ASK's microphone
    being the one card that is not a screen).

### The build-plan docs
31. **WHATS-LEFT** said "twenty-seven"; there are thirty. It listed five things as "being built" or "waiting" that are in the code
    (the CHAT pass, the TELEGRAM pass, THE EYE 2, BOOT AND ORB, KERNEL 3), and a stylesheet fix already made. **A dated note was
    added at the top.**
32. **TRY-IT-NOW** said "not on your phone yet" for builds that each have their section. It had MAKE paths from before the
    EDITORS fold, "four board ratings" (there are six), "Settings, offline packs" (the panel is OFFLINE EYES), and "27 MB" for the
    voice model (about 41 MB with its runtime). **Each line was corrected.**
33. **STATUS** was headed 1 Nov, its "landed" list stopped at KERNEL 2, and its test counts mixed files with tests. **A dated note
    was added** with the landings since, the ideas now built, and today's counts.
34. **PLAN** gave its 23 Oct numbers as if current. **A "now historical" line was added** that points to STATUS and WHATS-LEFT.

## What I made
- The spec **`tests/consistency.spec.mjs`**, added as the last word of check.yml's `all=` list. It reads everything from the code
  (nothing is typed twice) and checks:
  - **claims:** every link a word gives (catalogue TRY IT, WHAT IT NEEDS, the brain's "needs a key / linking", the deck's YOU CAN
    lines) opens its screen, and the panel or pill it names is there;
  - **keys:** every key path names a real key, and OPTIONAL is said exactly when the key is optional;
  - **names:** one name per screen, and nothing else is called "Home";
  - **about:** every group's line in his voice is a sentence;
  - **counts:** every hub's cards are its screens;
  - **deadkeys:** no dead keys, with a self-check;
  - **errors:** no errors on any screen at 440 and 390, nor on Home and the hubs in the seven looks.
- The word fixes above, in the brain, the catalogue, the deck, WHAT'S NEW and the docs. There are four small code fixes: the
  social "needs linking", the theme links, HOUSEHOLD, and the push guard.

## How to try it on his phone
1. Me → Every screen: Markets reads "Crypto, gold and currencies, live", and its gold line opens GOLD & SILVER.
2. Me → Every screen: the Arcade now has three YOU CAN lines.
3. Ask "can you post on Bluesky?" before linking an account: Ghosty says it needs linking (LINKS → BLUESKY).
4. The everything tab: "Black background" → TRY IT opens THE LOOK → THEMES, where the grounds are.
5. LIFE: the bins-and-bills card opens **HOUSEHOLD**. "Home" is only the first screen now.
6. The Workshop: WHAT'S NEW lists this week's landings instead of "Nothing new".

## What is left
- **One thing, several names.** These are still named more than one way:
  - the learn screen is "Courses" in the nav but "Learn" in the catalogue;
  - "People" means the people screen, the Lens's PEOPLE mode and Settings' PEOPLE I'VE INTRODUCED;
  - "Me" is the area, the Me sheet and Memory's ME pill;
  - the Game studio is "THE GAME STUDIO", "Game studio", "GAME STUDIO" and "Make a game".

  Each is recorded here; renaming them touches many specs across other lanes, so it is left for the owner's pick.
- **Settings → THEME's gallery** is tagged "The look", while THE LOOK is a separate screen just below it. Retagging it belongs
  to POLISH 3, whose lane owns Settings.
- **Plain mentions of "SYSTEM → KEYS → Pl@ntNet"** (the Lens's no-key card) and TomTom (God's eye's toast) still leave out
  OPTIONAL, because the Lens and SEE lanes' specs read those exact words. Both keys are real and reachable there.
- **The browser suite in this container:** the restart at 18:45 stopped the full run. Before it, the first sixteen specs ran.
  Thirteen passed. Two (machine, upgrades) failed on the pushManager error, which is now fixed. The lens spec failed on "2
  tag(s) stick out of the viewfinder at 390" (LENS lane, being rebuilt). The rest is left to the combined check.
