# BRIEF-DEPTH — the UI depth pass: one look, one voice, nothing baffling, the small moments right (batch ⑧, last of all, 1 Nov 2026)

Worktree from the LOCAL tip of claude/ghosty-ai-training-idwhp9 (at or after the commit that adds this brief; never reset to
FETCH_HEAD or origin, only to the local branch). Your preview port: 8666. This is the LAST batch of the week: every other
batch (①–⑧, OWNER-ISSUES 99–118) is merged under you. Read first: OWNER-ISSUES 91 (a) — his words on the Workbench: "loads of
different information and stuff im not familiar with and is baffling … it should be very user friendly … even the dumbest
user could use it", and his rule SHOW ME, DON'T TELL ME; 91 (c) "Abilities tab being better and UI in general … more depth";
74 (the depth architecture: (6) ONE SELF EVERYWHERE + CRAFT IN SMALL MOMENTS — "superior is felt in tiny moments more than
feature count"); 76 and docs/build-plan/SMALL-GAPS.md (the families: one fix per family — a rule, a shared helper, a test
that catches new instances); 99 (the catalogue rules); the build records 100–118 for what landed this week and the LIMITS
each builder left. HELD, not yours: the twelve themes and the Cinematic touch-up (the owner wants his say first) — change
no theme colour, no boot cinematic.

## What this pass is

Eleven batches landed in two days, each by a different builder on the same shell. The owner will open Ghosty on Monday night
and feel the seams before he finds the features. Your job is the seams: make every screen, sheet and card built this week
read as ONE app, in one voice, with nothing baffling, on his iPhone 18 Pro Max (440 × 956) and a 390-wide phone, and in TV
MODE on a 1,920 × 1,080 screen. Measure first, then fix by family, then prove it. No new features; no feature removed.

## 1. MEASURE (the first hour; a report file in the scratchpad, not the repo)

Open every screen, every pill, every sheet and every card a batch added this week on a fresh preview and on one that has
been used (run `tests/abilities.spec.mjs` and `tests/cards.spec.mjs` first on the same preview, so the chat and the wall are
full). For each: a screenshot at 440 and 390; the words on it read aloud as VoiceOver would; the first thing a stranger
would not understand. Keep a list by FAMILY, not by screen.

## 2. FIX BY FAMILY (each with its rule, its shared helper where one is missing, and a test that catches a new instance)

(a) THE SHEETS: the packs (money, body, kitchen, people, work, creative, outside, home, learning), the social queue, the
Morse sheet, the converter and documents, the house, the coach, SHAPES — every sheet opens the same way (over the current
screen, a title in the same case, the same close, the same scroll, the same bottom clearance above the dock), reads in the
same voice (his words, no field labels in capitals that mean nothing, no technical names), and nothing is sideways at 390.
(b) THE CARDS: the chat's cards from this week (a draft, a thought, a car, a pack's result, a design, a thought of mine)
share one shape: name, line, acts, WHY — the same paddings, the same button height (44 pt), the same way a second card
stacks; the Home wall's cards too, and the wall's late-rendered cards no longer move the end under a thumb that scrolled
there (render the wall's cards eagerly once their facts are in, or keep the scroll pinned when the wall grows at the end).
(c) THE WORDS: every line the week added that a stranger would not get — a tool name, a code word, a jargon word (CAD, UCI,
Glicko, ZIM, Kiwix, BOM, WebGL2, DPR, Ed25519) — gets the plain words with the term in brackets where the term must stay;
one glossary pass over the catalogue entries added this week (`packages/shared/src/catalogue/*.ts` from app1 to the latest).
(d) THE DUPLICATES: three drawing features (the creative pack's prompt, the coach's DRAW lesson, the learning pack's
drawing class), two typing things (the coach and the learning pack), two "learn a skill" places, two tuners if any — make
each ONE front door that leads to the others ("the coach has the lesson, the pack keeps your streak"), with the phrases
settled so the first match is the right one (phrases.ts: the first matching entry wins), and the catalogue saying which is
which; nothing deleted, everything reachable.
(e) THE BUTTON ROW BUG from ⑥a's record (OWNER-ISSUES 100): an `!important` font rule in SCHOOL's button row doubles the
words of any button made with `named()` ("SIT ON THE FREE GPU"); fix at the rule, and sweep for the same pattern elsewhere.
(f) THE FIRST MINUTE: a fresh phone's first open with everything installed — the boot, the first three things said once,
the first offer — must not be louder than before this week: count the things that speak or toast in the first minute on a
fresh preview and keep it to what the sideways batch set (OWNER-ISSUES 101); the social and packs toasts wait their turn.
(g) THE EVERYTHING TAB: with about 700 registry items now, the search and the chips must still find a thing in two taps;
the counts at the top true; the new ones badged; "TRY IT" lands for every entry added this week (the abilities spec checks
a sample — make it check every entry from this week once).
(h) TV MODE: every sheet and card added this week in TV mode at 1,920 × 1,080 driven by the keyboard — focus visible, reading
order right, nothing that needs touch; where a sheet cannot work on a TV (the camera ones) the one plain line.
(i) ACCESSIBILITY: every control added this week has a name VoiceOver reads; every target is 44 pt (the specs' probes: fix
the control, never the probe); contrast of the new text on the dark glass at AA.

## The lines that hold

No theme or cinematic change (HELD); no feature removed or renamed in the catalogue without its old words kept as `say`;
nothing that bills; the plain prompt untouched (5,500); no test skipped or weakened (a probe that finds a real 40 pt
button is right: fix the button); the guard job untouched; no model names anywhere; the smoke loop runs every spec against
ONE preview brain in order, so a changed spec must not assume a fresh brain and must default BASE to 8788; a new panel on
LINKS, SETTINGS or SYSTEM is matched in both `shell/layout.ts` GROUPS and the screen's `sections(...)`; anything a hub card
counts means running `tests/hubcards.spec.mjs`.

## Tests

Extend, do not add noise: `tests/depth.spec.mjs` (new) walks every sheet and card added this week at 440 and 390 and in TV
mode, checks the family rules above (one close, one title case, 44 pt, named controls, nothing sideways, the wall's end
stable after a scroll, the drawing front door), and prints a one-line summary per family; `apps/edge/test/depth.test.mjs`
checks the glossary pass (no catalogue line from this week carries a bare jargon word from the list without plain words)
and the phrase order (the week's phrases against the sentences the specs send, first match right). Every existing spec
still passes: run the full smoke list from `.github/workflows/check.yml` on one preview in the loop's order at the end
(hours; do it once, at the end, with the machine otherwise quiet — nothing else of yours running), and fix what it finds
at cause.

## Working lean

Ranged reads; `tail -30`; the brain suite once at the end under low priority; no narration. Commit per family.

## The report (one message)

Base SHA, HEAD SHA, the worktree branch; commits; files; the measure report's counts (screens, sheets, cards, words changed,
duplicates fronted); the full smoke list's result (every spec, time, first-try or retry); LIMITS; DESIGN PICKS THE OWNER MAY
CHANGE; NEEDS HIS PHONE; WHAT THE MERGE MUST KNOW.
