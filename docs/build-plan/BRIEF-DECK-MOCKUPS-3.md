# Mock-ups, round 3: a deck that makes you want to tap (OWNER-ISSUES 33)

The owner, 24 Oct, on rounds 1–2: "Like this you can't tell what the purpose of each thing is, like you don't have a
reason to click on things and find out all the crazy things Ghosty has to offer." So the deck's job is DISCOVERY:
every screen must say what it does for him, in words that make him want to open it, and show it. Live readings may
stay where one exists, but purpose comes first. Same rules as BRIEF-DECK-MOCKUPS.md (route C `style.css`, the real
glyphs, 440 × 956, British English, no app-icon squares, nothing outside `docs/build-plan/mockups/deck/`), files
`f.html/png`, `g.html/png`, `h.html/png` and `contact3.png` (F, G, H and, for comparison, C2).

## The words are the design
Every capability named must be REAL: read MAP.md (the interface map and the tools) and each `features/*/index.ts`
blurb before writing. Plain words, exciting but honest, British English, no jargon: "Point it at a plant, a bird or
an insect and he names it", "Every plane, ship and satellite over the UK, live", "Say 'remind me at 6 to call Mum'",
"Sit a real GCSE paper and get it marked", "Tell him what to build and he changes his own code", "Build a website
from one sentence", "Measure a room from one photo", "Translate a sign through the camera". Write one PROMISE line
per screen (the reason to open it) and two or three "You can…" examples each; a "Did you know" for the surprising
ones (the Mind, Night School, the weekly training on a free GPU, the offline brain).

## The three
- **F, the showcase**: one full-width card per screen, in groups under kickers: on the left a miniature of the real
  screen in a thin glass frame (use the route C screenshots from
  /tmp/claude-0/-home-user-Ghosty/6a05925c-6839-5546-8e68-c6df376dadfa/scratchpad/design-build-2/ and
  /tmp/claude-0/-home-user-Ghosty/6a05925c-6839-5546-8e68-c6df376dadfa/scratchpad/hero-build/ scaled to about
  96 × 208), on the right the name, the promise line in 17 pt semibold, the "You can…" examples in grey, and a live
  reading in small figures when there is one. Like a feature page, not a menu. Show the top and a `f-scrolled.png`.
- **G, superpowers**: organised by what HE wants to do, not by screen: groups SEE · ASK · MAKE · LEARN · PLAN · KEEP
  SAFE · ME, each a glass card listing capabilities as tappable lines (the capability in white, an example or the
  screen it lives on in grey, a chevron); about 45 lines in all; a TRY THIS NOW strip at the top with three daily
  picks as small cards ("Point the Lens at tonight's dinner: calories and what's in it"); the search pill filters the
  lines. Show the top and a `g-scrolled.png`.
- **H, tap to find out**: compact cards two per row (glyph, name, the promise line in two lines, a live reading
  when one exists); tapping a card expands it in place into the full story (the miniature, the promise, three "You
  can…" lines, a DID YOU KNOW, and an OPEN button); the mock-up shows Lens expanded among the compact ones, and a
  TRY THIS NOW strip at the top. Short page, curiosity is the mechanic.

## Finish
Commit on the worktree branch (do not push, do not merge). Report: PNG paths; the promise lines you wrote for all
20 screens (I will check them against what the app really does); a paragraph per option on discovery versus speed on
a 6.9-inch phone; your pick; the app change for each (files, size).
