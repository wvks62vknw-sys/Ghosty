# Undo on anything that changes something, and translation that works offline (PLAN ideas 12; Wave F)

Read BRIEF-W0.md, MAP.md, `ui/components.ts` (`undoBar`, toasts), where UNDO exists today (Memory's timeline, Agenda's
events and reminders), `offline/brain.ts` and `offline/prompt.ts` (the brain on the phone), `tools/translate` (the
`translate_text` tool and the Lens Translate path), `tests/memory.spec.mjs`, `tests/agenda.spec.mjs`, `tests/lens.spec.mjs`.

## A. UNDO everywhere
Make a list of every action in the interface that deletes or changes something the owner would miss (library document
removed, a widget deleted, a site unpublished, a learn course or card removed, a GYM reset, a memory edited, a setting
with a big effect such as switching the offline brain off, a chat cleared, a spending rule changed, a place forgotten:
grep every `delete`, `remove`, `reset`, `clear`, `unpublish`, `forget`), and give each one the UNDO bar (12 seconds,
puts it back exactly, says so) where the data can be put back, or a one-tap confirm with the consequence in plain
words where it cannot (a site's link gone for good). Nothing destructive happens on a single tap without one of the
two. The list, with each action's choice, goes in MAP.md's row for `ui/components.ts`.

## B. Translation offline
"Translate this to Spanish" with no signal: the brain on the phone translates (the 0.6B can, roughly; the words say
"rough, offline"); Lens Translate falls back to it too; Spanish, French, German, Italian, Portuguese, Polish, Arabic
and Urdu are tried and the result is shown with "offline translation: check the important bits"; online it is the
same tool as today. Also READ ALOUD of the translation in the target language's voice where the phone has one.

## Tests (each must fail on the old code)
Specs: `tests/undo.spec.mjs` at 440 × 956 walking the list (each action undone or confirmed), and the offline
translation in `tests/offlinebrain.spec.mjs` (the fake engine returns a translation; the rough-offline words show).
Edge: nothing, unless a tool changes. `npm run check`; keep memory, agenda, lens and library specs passing.

## Finish
Commit per part (do not push, do not merge). Report: the full list of actions with the choice made for each; files;
screenshots; every check's exact result; anything not done and why.
