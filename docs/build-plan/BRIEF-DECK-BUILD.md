# Build the Every screen deck the owner picked, and the icon language without app icons (OWNER-ISSUES 32–34)

The owner's pick, 24 Oct: "H with F's pictures and G's information and prompts; other than that pretty good, could
just be a little bit better." So: the deck is H (tap to find out: compact cards that expand in place), each expanded
card carries F's picture (a miniature of the real screen) and G's information (that screen's capabilities as tappable
lines and its example prompts), with a TRY THIS NOW strip and the "Go to, or ask…" pill. Mock-ups and copy to start
from: `docs/build-plan/mockups/deck/h.html`, `f.html`, `g.html`, `build3.py` (the promise lines and "You can" lines,
checked once against MAP.md: check them again as you wire them), `style.css` (route C). Read BRIEF-W0.md, MAP.md,
`apps/web/src/shell/launcher.ts` (the deck today), `shell/areas.ts`, `shell/tabs.ts` (TabDef), `tests/nav.mjs`
(openDeck/openPanel: every spec goes through them; they must keep working), `ui/components.ts`, the "one icon
language" block in `apps/web/styles.css` (around the comment "tinted-glass squircles"), and the Me sheet code.

## Part 1: the icon language (the owner's complaint 32: "like app icons")
No filled tinted squares behind glyphs anywhere: the deck, the Me sheet rows (`.merow .sq`), hub tiles (`.hubtile
.sq`, `.hubhero .sq`), recents (`.recent .sq`), row icons (`.rowic`), Search results (`#palette .gic`). Glyphs become
bare thin lines (stroke 1.6–1.8) in `--l2`, 22 pt in rows and cards, the accent only for the live or selected one.
`shell/areas.ts` `squircle()` becomes a plain glyph span (keep its signature so callers compile); the tint colours
drop out of rendering. Delete the squircle CSS block. Write new CSS WITHOUT the `[data-look="pro"]` prefix (route C is
becoming the only look in a parallel job) in one new, clearly delimited section at the end of styles.css, and do not
edit other existing blocks beyond the deletion, so the merge stays clean.

## Part 2: the deck (`shell/launcher.ts`, new `shell/deckcopy.ts`, CSS)
Header: kicker EVERY SCREEN, "At your service, {name}" (the name as typed), one line "Tap any screen to find out what
it can do." TRY THIS NOW: three picks for today (rotating daily by date, no repeat within a week, from the examples in
deckcopy), each a small glass card: the screen's kicker, the prompt in 17 pt, a cyan action line ("Open Lens ›" opens
the screen in the right mode; "Ask Ghosty ›" sends the words to the chat as a message from the owner, `session.send`).
Groups as kickers (Ask and see · Make · Learn and plan · Me). Cards two per row, 44 pt+ targets: the glyph, the name,
the promise (≤ 2 lines, never cut: shorten the words, not the card), and one live line when the screen has one (the
cyan pulse for "you are here" and anything due within the hour). One expanded card at a time: it opens in place
below its row, full width, with a spring (transform and opacity only; a cross-fade under reduced motion): the
miniature in a thin glass frame on the left, the promise, YOU CAN as rows (each tappable: a deep link into the right
screen and mode — Lens Translate/Measure/Aim/Scan, God's eye cameras, Space Design review, Learn a course, Agenda
reminders — or, for an example prompt, the words sent to the chat), a DID YOU KNOW line where one is true, OPEN as the
filled pill, and a collapse chevron. The pill "Go to, or ask…" floats above the home indicator: typing filters cards
AND capability rows (title, blurb, capability words); Enter on a match opens it; Enter with no match asks Ghosty;
the mic button starts dictation as the chat's does. Escape and the ✕ close the deck as today.

Live lines: an optional `TabDef.now?(): string` in `shell/tabs.ts`, implemented only where the data already sits in
a store (Core: online · ms from the stopwatch; Brief: temperature · sky; God's eye: aircraft · satellites; Agenda:
next · in n min; Markets: BTC change; Threats: signals · level; Library: passages · on this phone; School: stage ·
papers; Gym: mastered; Memory: count; System: database %; Radio: playing or off air; Workshop: self-edit on/off),
each ≤ 10 lines, nothing fetched for the deck itself.

The pictures: a spec `tests/deckshots.spec.mjs` that opens each screen on the preview server at 440 × 956 (fresh
server, so the screens show their own default state, not test leftovers) and writes `apps/web/public/deck/<id>.jpg`
at 220 × 478 px, quality 70 (about 15–25 KB each); run it once and commit the pictures; the deck loads them lazily;
a MAP.md row says how to regenerate. Not in CI (it writes files).

## Part 3: words
`shell/deckcopy.ts`: for all 20 screens the promise, 3–5 YOU CAN lines (each with its deep link or example prompt),
the DID YOU KNOW where true. Every claim real (MAP.md, the feature's own header comment): no plant/bird/insect naming
claim (Lens names from everyday-name lists), School is HIS exam (he sits the papers), no calories from a dinner photo
(Lens Ask sends the photo to the brain), no "Night School" (planned, not built). British English, plain words.

## Tests
New `tests/deck.spec.mjs` at 440 × 956 (en-GB, Europe/London): the deck opens with every group and all 20 cards;
tapping Lens expands it with the picture, ≥ 3 YOU CAN rows, DID YOU KNOW and OPEN; only one card is expanded at a
time; a YOU CAN row deep-links (Lens → the Translate mode, read from `window.__ghosty.lens`); the Try strip has three
picks and an "Ask Ghosty" pick puts its words in the chat; typing "ag" in the pill leaves Agenda showing; Enter on no
match sends the words to the chat; no glyph wrapper anywhere on the deck or the Me sheet has a filled background
(computed background-color alpha 0 on `.sq`, `.rowic`, `.gic`, the card glyphs); the Me sheet still opens and its
rows still navigate. Keep `tests/nav.mjs` openDeck/openPanel working (same hooks or updated there), then run EVERY
spec in the CI loop (`for s in ...` in .github/workflows/check.yml) except scroll and safari, one at a time, on your
own port (`node tests/preview-server.mjs 8850 &`, `BASE=http://localhost:8850 node tests/<name>.spec.mjs <dir>`), and
`npm run check` in apps/web. Say the one line to add `deck` to the CI loop (protected file; I add it).

## Finish
Near the end, merge `claude/ghosty-ai-training-idwhp9` into your worktree branch (a plain merge; keep both sides'
intent in styles.css: the one-look job removes `[data-look="pro"]` prefixes and the classic looks' CSS). Commit per
part (do not push, do not merge into any other branch), each message ending with the two attribution lines. Final
report: what changed (files), the copy for all 20 screens as wired, every spec's exact result, screenshots at
440 × 956 of the deck closed, expanded (Lens), filtered ("ag"), and the Me sheet, anything not done and why.
