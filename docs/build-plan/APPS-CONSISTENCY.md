# THE APPS ROUND: CONSISTENCY, 14 November 2026

My flagship this round is **THE APP KIT**: one frame that every app in Ghosty is built from, so a hundred apps look and feel made
by one company. The kit's core was merged at 14:07 UTC, inside the corrected 14:45 deadline. After it I built section 2's first item:
one Accessibility switch.

## What I built
**The App Kit** (`apps/web/src/ui/appkit.ts`, its styles in the "THE APP KIT" block of `styles.css`). One call builds a whole app:
- **its own header:** the app's icon and name, a search key and a settings key;
- **one scroll area:** only the list scrolls. The page never scrolls sideways or twice, which fixes the scroll fights at the root;
- **keys at the bottom,** in thumb reach: the app's own, then Undo and Redo;
- **one calm place for notices:** a small line right under the header that leaves after four seconds or with a tap. It never
  flashes up mid-screen, which fixes the big white text at the root;
- **every state in plain words:**
  - loading shows skeleton rows, so nothing jumps when the content lands;
  - empty says what to do;
  - an error comes with its fix key;
- **a first run that is never empty:** sample data and a three-step tour;
- **search inside the app,** with its own "No items match…" words and CLEAR SEARCH;
- **undo and redo for every change,** and every delete kept in **Recently deleted** (put back from Settings);
- **share and export:** CSV and JSON, through the phone's Share sheet where it has one, otherwise saved on the phone;
- **a settings sheet:** the app's switches, its exports and Recently deleted;
- **a Home card and a list row,** for any screen to use on their own.

**How it keeps the house rules:**
- **On the phone:** everything is kept on the phone (`ghosty.app.<id>`).
- **Share is his choice:** only his tap, and he picks where the file goes.
- **Every look:** every class is `ak-` and every colour a world token, so it is right in all seven looks.

**The guide:** `docs/build-plan/APP-KIT.md` shows every part and a whole app in thirty lines. Its worked example is `kitDemo()`,
a packing list.

**One Accessibility switch** (section 2's first item, his "reading and accessibility"):
- **Where:** THE LOOK → THEMES → Switches. Accessibility is the first row: ON or OFF.
- **What ON does:** it sets every reading switch at once:
  - body text at its biggest (21 points);
  - nothing moving;
  - no glow, and no floor behind the words;
  - the phone's own type;
  - colours anyone can tell apart (the colour-blind-safe set).
  His look and his colour stay as they are.
- **OFF puts back his own switches,** exactly as they were before (kept on the phone), never the defaults over his choices.
- **By words, with no model:** "accessibility on", "make it easier to read", "accessibility off".
- **Where it shows:** it is in the catalogue, so "can you…?" knows it. The Switches header now counts its rows truly (10).

## How to try it
- **Accessibility:** say "accessibility on" (or open THE LOOK → THEMES and tap ON beside Accessibility). The words grow and
  everything holds still. Say "accessibility off" and your own switches come back.
- **Open the demo:** on the phone, open the console and run `__ghosty.appkit.demo()`. The Packing app opens with three sample
  items and its tour.
- **Search and delete:** tap the search key and type "boot". Delete Passport with ✕: the notice says it is in Recently deleted,
  and UNDO puts it back.
- **Settings:** open the settings key to find a switch, the two exports, and Recently deleted.

## Checks
- **New spec `appkit`** (appended to check.yml's `all=`). It drives the example through:
  - the first run, its tour and search;
  - a delete with its notice, undo, redo and Recently deleted;
  - settings and both exports;
  - the three states, and a reload.

  Then, in **all seven looks at 440 and 390**, it checks:
  - one scroll area;
  - nothing sideways;
  - no word under a key;
  - every key 44 pt;
  - the keys at the bottom.

  It passes in about 30 s.
- **New spec `access`:** the Accessibility switch in all seven looks at 440 and 390. ON sets every reading switch, the words grow,
  nothing pokes out sideways and every key stays 44 pt; OFF gives back his own switches. It also checks the chat's "accessibility
  on" and "off". The look test checks the words and the round trip.
- **Other specs re-run with it:** look and routec pass.
- **Brain suite:** 2,364 of 2,364 on the merged tree.
- **Other checks:** the ratchet and look tests pass, and the web typecheck is clean.

**Also this round:** the eyehud fix (the eye's ground under software rendering), merged before the round as `aaedf86b`. The jump
bar opens at once again on CI's software GL.

## What's left
- **Moving an existing screen onto the kit.** Ghosty's list screens are built on the older sheet pages. Moving one means moving
  its specs' words too, which didn't fit the 70 minutes safely. The kit's own example app stands in for now. The first app each
  lane builds this round should be its first real user.
- **Voice entry to an exact screen** ("open Packing at the passport"), and a kit app's own entry in the Jump bar and on its hub.
  Both need an app registered as a screen (deck, catalogue and hub card), which is each app's lane's part.
- **The rest of section 2, reading and accessibility:**
  - VoiceOver reading order;
  - a colour-blind-safe switch;
  - Speak screen;
  - captions.

  None of these started.
- **Version history** for things an app makes (the kit has undo and Recently deleted, not saved versions).
