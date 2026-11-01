# BRIEF-LIBRARY — the arcade screen and the DOS library: the free classics running as they are (batch ③ part 5, 1 Nov 2026)

Worktree from the branch tip (claude/ghosty-ai-training-idwhp9 at or after the merge of the arcade's first half: see
`apps/web/src/arcade/` — shelf.ts, levels.ts, zip.ts, store.ts, scores.ts, input.ts, learnable.ts — and
`apps/edge/test/arcade.test.mjs`; read them first, they are yours to build on). Your preview port: 8855. Read also:
BRIEF-ARCADE.md (the bar, the lines, the screen, the tests: all still binding), OWNER-ISSUES 93 (a), 94 (b), 95, 96, 97.
Other builders run in parallel (the chat's cards and shell, the offline brain, the packs): touch none of `features/core`,
`shell/*`, `offline/*`, `school/*`, `features/settings/*`, `features/money|body|kitchen`. Yours: `apps/web/src/arcade/*`,
`apps/web/src/features/arcade/*`, `apps/web/public/vendor/dos/*`, `tests/arcade.spec.mjs`, `apps/edge/test/arcade.test.mjs`,
one import line in `apps/web/src/features/index.ts`, a CSS block at the END of `apps/web/styles.css`, `arcade` at the end of
the smoke loop in `.github/workflows/check.yml`, and `apps/web/public/_headers` connect-src for the one data host.

## Sources for this batch

The npm registry (`npm pack emulators@8.5.2` into a scratch directory: the DOSBox builds compiled to WebAssembly, GPL-2;
`js-dos@8.5.3` for reference only) and archive.org's `/cors/` path for game data, as the store already uses. Nothing else is
needed. Game data is never in the repo; engine code is vendored with LICENCE and SOURCE.md (npm name, version, integrity).

## What to build (a commit each)

1. THE DOS ENGINE in the arcade player: the `emulators` package's fastest backend in your preview (measure two), vendored
   under `apps/web/public/vendor/dos/`; a bundle per game built on the phone from the game's archive (fetched by the store
   with size and checksum) plus our `dosbox.conf` and autoexec; our touch layer (stick → arrow or WASD as the game needs,
   buttons where the thumb rests → the game's keys, drag → mouse) and the gamepad layer through the emulator's input API;
   saves through the emulator's persistence into IndexedDB (a game's own save files survive a reload); sound on; PAUSE →
   QUIT · SOUND · CONTROLS. A per-game `controls` block in the shelf entry says which keys the buttons are, with labels.
2. THE ARCADE SCREEN (`features/arcade/index.ts`, a TabDef like the GYM's): the shelf and the player exactly as BRIEF-ARCADE
   describes, rendering from `shelf.ts`; GET on Wi-Fi (his tap, size first; on mobile data it says so and waits); PLAY;
   best score and Ghosty's line; VoiceOver labels; nothing sideways at 390 × 844 and 440 × 956. The shelf lists only what
   plays today.
3. THE DOS SHELF, each entry from the Archive with its checksum and the permission line from its own text file, each
   measured in your preview and kept only if it runs at full speed with sound: DOOM (the free episode, id's shareware
   package: this is the way DOOM plays in this batch), One Must Fall 2097 (freeware since 1999), Tyrian 2000 (freeware),
   Jazz Jackrabbit shareware, Commander Keen 1 and 4 shareware, Duke Nukem 1 and Duke Nukem 3D shareware, Rise of the Triad
   shareware, Heretic shareware, Blake Stone shareware, Descent shareware, Terminal Velocity shareware, Raptor shareware,
   Wacky Wheels shareware, Epic Pinball shareware, Hocus Pocus shareware, Jill of the Jungle shareware, and Bethesda's
   free Elder Scrolls Arena only if it runs well. Twelve or more on the shelf is the aim; say the fps and load time of each.
   Freedoom needs an engine the DOS route does not give it: leave its entries off the shelf (keep the registry rows and
   `levels.ts` for the engine that comes later) and say so in the report.
4. `tests/arcade.spec.mjs` and the node test extended: the tab opens from the deck and #arcade; the shelf lists the games with
   sizes and GET; GET on stubbed mobile data waits with its line; with the store stubbed to serve a tiny valid fixture
   bundle (a minimal DOS program you assemble or a public-domain one, kept in tests/fixtures with its licence), PLAY opens
   the player, two canvas snapshots differ, the touch layer shows, PAUSE → QUIT returns and the best score is written;
   VoiceOver labels on every control. Keep `deck`, `nav`, `gym` green. The CI line last.

## The lines that hold

As BRIEF-ARCADE: nothing commercial bundled or fetched; only data its own licence allows anyone to pass on, named per entry;
downloads only on his tap on Wi-Fi with size and checksum; nothing that bills; the plain prompt untouched; no test skipped
or weakened; the guard job untouched; no model names anywhere; the games run entirely on the phone.

## Working lean

Ranged reads; test output through `tail -30`; the full brain suite once at the end under `nice -n 10`; no narration.
Validation: brain typecheck + suite; web typecheck + build; on one fresh preview: websites, apps, deck, nav, gym, arcade.

## The report (one message)

Base SHA, HEAD SHA, the worktree branch; commits; files (vendor sizes); validation numbers; the shelf with fps and load
times; LIMITS; DESIGN PICKS THE OWNER MAY CHANGE; NEEDS HIS PHONE; WHAT THE MERGE MUST KNOW (the shared one-liners,
new registry items for the catalogue).
