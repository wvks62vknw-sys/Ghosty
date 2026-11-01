# BRIEF-EVERYTHING — the Abilities tab rebuilt as a complete, tappable catalogue (batch ①, 1 November 2026)

Worktree from the branch tip (claude/ghosty-ai-training-idwhp9 at or after da4dc79 = main 9340874). Your own preview port:
8877. Read HANDOFF.md from "- 31 Oct 23:00 UK" and OWNER-ISSUES 68, 81, 86, 91, 92 first. Never push, never open a PR,
never touch main or the session branch; commit per item; hand back ONE report in the shape at the end.

## The owner's words (the whole brief in two lines)

"a lot of the stuff is unfindable, and by him telling you once you'll still forget, you should be able to like click on
every single thing he is able to do in one tab and it like explains it there." And of the tab as it is: "even with the
abilities tab it's just not like clear enough." He rejected nudges, one-time hints and scenes-only. The fix is
COMPLETENESS and PLAIN WORDS: every single thing, tap it, it explains itself, with a button that does it.

## The lines that hold

- GENERATED, never written as a claim: every entry comes from a registry the code already runs on (below), so nothing
  can be listed that Ghosty cannot do, and nothing he can do can be missing. A node test enumerates every registry and
  asserts every item is in the catalogue with a plain line, an example and a way to try it. Adding a tool, a screen, a
  panel, a game, a mode or a phrase later appears by itself — or the test fails and names it.
- PLAIN WORDS: no tool names, no code words, no underscores or camelCase anywhere he reads. "I can look up a live train
  time for you", not `transit_departures`. His voice ("I can…"), one line each, 140 characters at most; the sheet 2–4
  lines; an example he could actually say or tap. A test fails on any visible word matching a tool name or `[a-z]+_[a-z]+`.
- TRY IT does the real thing: opens the screen and its panel (the deck's own deep links), runs the app command, or puts
  the example in the chat box and sends it. Never anything irreversible without the usual confirm sheet; nothing that
  bills; nothing about a private person; the brain's `estimate`-style pure tools may run on the spot.
- Fast and offline: the tab renders from the phone's own registries plus the brain's catalogue kept on the phone
  (as ABILITIES already keeps `ghosty.abilities`); no model call to draw it.
- Untouched: the plain prompt (5,500; headroom 10 — do not add a tool), the CI guard, the Workshop's name; no new keys,
  no paid APIs, no new brain jobs.

## What "every single thing" means — the registries (enumerate all of them)

Brain side (served by GET /api/abilities, extended): every TOOL in `apps/edge/src/tools/index.ts` TOOLS (about 250), not
only the 13 groups — each tool its own entry under its group; the group's `about` and each tool's description are the raw
material for the plain line (rewrite them in his voice; the test only checks presence, you write the words); Telegram's
commands and the phrases it answers without a model (`telegram.ts`, `direct.ts`); the scheduled jobs he can ask for
(`schedule.ts` kinds: reminders, the digest, the walk, foresight…) as "I can…" entries; the kept-task and ON THIS PHONE
behaviours (`direct.ts`, OWNER-ISSUES 72).
Phone side (`apps/web/src/abilities/registry.ts`, extended): every tab in `features/index.ts` TABS and every panel and
section inside it (the `sections(root, id, [...])` registries, `page()` panels, Settings' panels incl. OFFLINE BRAIN and
GUARDIAN and CHARACTER, System's panels incl. the report card and keys), the deck's YOU CAN lines (`shell/deckcopy.ts`),
the Lens's TILES, the GYM's games (`gym/meta.ts` META), SCHOOL's stages and its SIT / placement / reading check, the
Workbench's panels and the wind tunnel (until batch ⑤ replaces the screen), the Studio's samples and commands, every
local phrase the chat answers with no model (`assistant/local.ts`: "can you…?", WHY, "what did you do today", foresight,
"you were right", the Machine view, the Workbench words — list the phrase tables, not one example each), the voice
commands, the hub cards' buttons, the Me sheet's rows, UNDO, the CITED toggle, the themes, the moods he can see.
If a registry does not exist for something visible (a button that does a thing but is only in a mount function), make
one — a small exported list the screen itself renders from, so the catalogue and the screen cannot drift.

## The tab

Top: a search box ("anything: 'train', 'birthday', 'scam'") over names, plain lines and examples with the simple synonym
table from the existing `searchAbilities` (keep "Can you…?" working: it is the same search); the count ("I can do 312
things, 9 of them new this week"); NEW badges for entries whose `since` is within 14 days (the build date of the entry's
registry item; for existing ones use the batch dates in STATUS.md, coarse is fine).
Then the SCENES, each a panel of cards, a thing may sit in two: IN THE MORNING · WHEN YOU'RE OUT · WITH THE CAMERA ·
MAKING THINGS · WATCHING OVER YOU · LEARNING AND SCHOOL · PLAYING · YOUR MONEY AND ADMIN · TALKING TO ME · ON THIS PHONE
ONLY · BEHIND THE SCENES (jobs, the digest, the weekly training, the guard). Keep the eight CATS as the secondary filter
chips (his way of thinking) — scenes are what you're doing, cats are what he's doing.
A card: the name (plain, 3–6 words) and the one line. Tap → a sheet: the plain explanation (2–4 lines, what it does, what
it does not do, the honest edge), SAY IT LIKE THIS (two or three phrasings), TRY IT (the button; what it will do said on
it: "opens God's Eye on the Machine view", "asks me: what's due this week?"), WHAT IT NEEDS (a key by name and where to
put it, Wi-Fi, Home and Work saved, the offline brain downloaded, a person named in GUARDIAN), WHERE IT LIVES (screen →
panel), SINCE (the date), and for a brain tool WHY I MIGHT USE IT MYSELF (the group's `when` words in plain English).
At the bottom of the tab: the existing LEARNING list (goals he set) and WHY / TODAY entries fold into TALKING TO ME.
44 pt rows, nothing sideways, works at 390 × 844 and 440 × 956, VoiceOver reads name then line.

## The words

You write about 400 plain lines and about 400 sheets. Rules: his voice; verbs he uses; no jargon (if a word needs
explaining, explain it in the line); say the limit when there is one ("about 200 m, from the public map, not your live
position"); never promise what the code does not do (read the code of each tool before writing its line). Put them in
`packages/shared/src/catalogue.ts` as a map from the registry id to `{ name, line, more, say[], needs?, scene[] }`, so
the brain and the phone share one copy and the completeness test can diff the map against the registries both ways
(an entry with no registry item fails too: nothing stale).

## Tests

- `apps/edge/test/catalogue.test.mjs`: every registry item has an entry; every entry has a registry item; every line
  ≤ 140 chars, no tool names or code words, starts "I " or "You "; every entry has ≥ 1 `say` and a `go`; counts printed.
- `tests/abilities.spec.mjs` rewritten: the tab opens from the Me sheet; the count is ≥ 250 and equals the registry
  count; search "train" finds the live departures entry; a card opens its sheet; TRY IT on five picked entries does what
  the button says (a screen+panel, a command, an ask sent to the chat); NEW badges; the eight cat chips filter; nothing
  sideways; rows 44 pt; VoiceOver labels. Keep every check of the old spec that still applies (can-you, WHY, today).
- The existing abilities tests (`abilities.test.mjs`) keep passing; `deck`, `hubcards`, `nav` too.

## Validation on port 8877

Brain typecheck and suite; web typecheck and build; specs on one fresh preview in this order: websites, apps, hubcards,
abilities, deck, nav, brief, eye, guardian. Report the counts: tools, screens, panels, phrases, games, modes, entries, and
the five TRY ITs the spec exercised.

## The report (one message)

Base SHA, HEAD SHA, commits in order; files changed; validation numbers; the catalogue counts; LIMITS (what could not be
made a registry and why); DESIGN PICKS THE OWNER MAY CHANGE (scene names, the count line, the NEW window); NEEDS HIS PHONE
OR HIS WORDS; WHAT THE MERGE MUST KNOW (protected files touched, each marked).
