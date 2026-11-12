# BRIEF: THE SMALL FIXES FOUND THIS WEEK (small fixes pass 1) — the chat log in ONE INK, Home's book title, the first screen's budget, the Theme page at the biggest text

BRIEF-SMALL-FIXES-1 (OWNER-ISSUES 168 and 170's "SMALL FIXES FOUND, not fixed, for your fix-up pass", the SHOW ME report's "Found, not mine", the
kernel report's speed2 reading). Each item is a thing a builder met on the way and left alone on purpose; this pass takes them one at a time,
each with a check that FAILS on the code before it and PASSES after, in the spec that already owns the screen. No new look, no new spec, no new
`all=` word unless a fix has no owning spec (none here). The design system is the only look: tokens.css and THE SYSTEM in styles.css.

## What is fixed

1. **THE CHAT LOG IN ONE INK (OWNER-ISSUES 168, 170a; showme-report "Found, not mine").** With the world ONE INK and the chat open (the LOG key, the
   ask line's own words, the gallery's "Say a look"), `.convo` and its `.log` measure 0 × 0: the log lives in the left column (`.cside.l`), and the
   ink rule that clears the HUD for the chat (`.hud.core.logopen > :not(.inkframe, .ccenter)`) hides that column, so no sentence is drawn
   (the Stage, which is not in that column, still is). The fix draws the column over the printed page between the one key at the top and the ask
   line, as The Scan draws it, and gives the messages the ink's own plain look (a hairline box, square, no glass, no glow). Phone only (the
   rule is under 900 px); Glass and The Scan are untouched.
2. **HOME'S BOOK TITLE (OWNER-ISSUES 168 (b); scratchpad ink-uncommitted-home.patch).** The thing of the hour, when it is a book, says the
   document's id turned into words ("Alices adventures in wonderland"). The patch lends the shelf's own title. JUDGED: right in aim, wrong as
   written: (a) it only learns titles when the shelf was read before Home was drawn, and nothing on Home reads it (the LEARN room's loader does),
   so on a fresh start the id stays; (b) it learns once at enter, not when the shelf arrives later; (c) it was never tested. FINISHED, not
   dropped: titles come from the shelf when it is there, follow it when it arrives (a subscription, ended on leave), and when nothing has read it
   Home reads it once, 2.5 s after the page is drawn (never on the first screen, at most once in five minutes, only when the thing is a book
   whose title is not known), from his own brain and his own shelf. THE SCAN's room still says the id: that is the Scan's own Home, out of this
   pass; named in the report.
3. **THE FIRST SCREEN'S BUDGET (kernel-report: speed2 853 to 988 ms of 1,000 on the merged tree).** The budget is held (never moved); the cost
   since SPEED-5 is found by measuring the first screen on SPEED-5's last build against this tree, and taken out of the boot path. What is
   found and what is changed is written into the report with the two readings.
4. **THE THEME PAGE AT BODY 21 (look.spec "at BODY 21 the Theme page cuts words or sticks out", 390 and 440; red in this sandbox, green on the
   runner).** Reproduced first. If a word is really cut or something sticks out at the biggest text size, the layout is fixed (a wrap, never a
   smaller size); if it is only this sandbox's fonts, the measurement says so and the spec is left exactly as it is.

## What must not change

Glass's and The Scan's Home, chat and Theme page; ONE INK's Home (the printed page: its masthead, orb, entry, lists, ask line and foot); every
control 44 pt; nothing sideways at 440 × 956 or 390 × 844; the first-screen budget (1,000 ms at 150 ms a request, median of five) and every other
budget; the finding rule; the ratchet ceiling in ratchet.test (hex 506, rgba 1016, radiusPx 470, total 1992: equal or lower); the prompt guard
(never raised); no new key, nothing that costs money, a model never named; protected files (apps/edge/src/agent.ts and index.ts,
tools/{index,types,repo}.ts, .github/*, apps/*/package.json) are not edited: a fix that needs one goes under NEEDS HIS WORD.

## Tests (each fails on the code before this brief; run against it once and say so)

- ink.spec, a new section f: with the chat open in ONE INK at 440 and 390, a sent "hello there" lands in a log that is drawn (wider than the
  screen less 80 px, taller than 200 px, inside the screen), at least two messages shown, the log clear of the way-back key and the ask line, the
  last sentence not behind the ask line, nothing sideways. (Before: 0 × 0, no messages.)
- ink.spec section b (the book): the entry's name is exactly the shelf's title (the spec serves his shelf), at 440 and 390. (Before: the id.)
- speed2.spec: unchanged (the budget is the test); the fix is proved by its median going down on the same machine, both readings in the report.
- look.spec: unchanged unless a layout fix is needed; then its BODY 21 check is the proof (red before, green after, nothing loosened).

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build (tsc, then build.mjs); the brain tests in the background; then in the foreground, alone, one after another: ink, look, speed2, speed,
showme, thescan, tabs, ui, layout, library, deck, nav, settings. A timing budget missed under load is rerun alone before it is called red.
Known sandbox reds not touched: direct, aim, radio, scroll, safari, eye's own screenshot, tabs2, talk's cooling lines.

## The owner's phone check

1. ONE INK on, on Home, tap the LOG key (or type to the ask line and send): your sentences and mine are drawn on the printed page, in hairline boxes,
   square, nothing glowing, the last one clear of the ask line; the arrow at the top takes you back to Home.
2. With a book on the go: Home's one entry names it as the book is called (with its capitals and apostrophes), a few seconds after opening if
   you have not been to the shelf this session.
3. Close Ghosty completely and open it: the first screen arrives as before or a little sooner.
4. Settings, Theme, bigger text twice: every key, tile and row on the Theme page says its words whole.

## Report

fixes-report.md in the scratchpad: each fix with its source, cause, change and the check that proves it (red before, green after); what was
judged not a bug with the measurement; each spec's last line and verdict; NEEDS HIS WORD; the phone check in plain terms.
