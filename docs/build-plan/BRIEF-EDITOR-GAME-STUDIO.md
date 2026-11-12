# BRIEF: THE FULL EDITORS, THE EIGHTH: THE GAME STUDIO — a game maker, honestly sized

BRIEF-EDITOR-GAME-STUDIO (PROGRAMME-EDITORS section 8; OWNER-ISSUES 127 "i want the full editors", 164, 176 "do all of it", 178 "insane
quality"; QUEUE-11-NOV item 7 and WHATS-LEFT list 4 item 1). The first version is a 2-D game maker on the app's OWN engine: THE PLATFORMER's
body-and-tile core (arcade/games/platform/core.ts, the 16-pixel grid, the tile letters of platform/levels.ts) and THE CAVE's rooms, doors and
save points (arcade/games/cave/*) from GAMES 5 (branch builder/games5, head 4511157a, not yet on main), so this build STARTS FROM THAT HEAD
and the orchestrator lands only the diff above it, after GAMES 5 is on main. It is the eighth editor: its MAKE card is a pill of the EDITORS
fold once THE WORKSPACE has landed (on its own tree MAKE is under ten, so the builder makes a plain card; the builder who rebases it onto
the fold before landing moves the card into the pills' list, one line). One builder, one PR. Read STANDARD.md, PROGRAMME-EDITORS.md,
BRIEF-GAMES-5.md (the platformer, the cave, the two/shell makeEngine and skill), BRIEF-GAMES-4.md (the kit, Learnable, the shelf's
`madeByUs`), `tests/apps.spec.mjs` (how a made mini-app is served at /s/<name> with its manifest and installed), BRIEF-EDITOR-PHOTO.md (the
shape of an editor's screen, store and export sheet), then this. THE QUALITY RULE holds (every state designed, every word his, every wait
said, every number honest, every control 44 pt, nothing merely fine).

## His words
"no i don't agree with you, i want the full editors" (4 Nov); the programme's own line: "a playable ten-minute game with a quest, an inventory
and a save, made in an afternoon on the phone", and "3-D worlds, multiplayer and monetisation are not in the first version and the brief says
so". They are not, and the screen says so in one line under "?".

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. No package added. No sprite, tile, tune or
level of anyone else's game is copied: every tile and sprite the studio ships is drawn by us in the kit's palette, and what he draws is his.
A game he makes stays on his phone until he taps SHARE or PUT IT ON MY SITES; nothing in a game ever reaches his brain except a chat turn he
asks for (a level sketch, dialogue lines), with the game's own words as the turn's data and the prompt guard untouched.

## The engine (the app's own, no package)

- **A game is data (apps/web/src/studio-game/model.ts, pure; the folder is `studio-game` so it never collides with the 3-D Studio's
  `studio/`):** a name, a kind (PLATFORMER: the platformer's body rules; TOP-DOWN: four-way movement on the same grid, the body core reused
  with gravity off), a palette (one of the kit's game palettes, never new hex), a tileset (the studio's own drawn tiles for ground, wall,
  ledge, water, door, spikes, spring, coin, key, chest, sign, save point, plus his own tiles drawn in the pixel editor), rooms (each a grid of
  tile letters in the platformer's little language extended with his tiles, a size up to 64 × 32, a name, exits as doors that name the room
  and the door they open into, a background from the theme), sprites (16 × 16 pixel frames with named animations: idle, walk, jump, hurt, talk;
  up to eight frames each), characters (the player: its sprite, speed, jump height, hearts; NPCs: a sprite, a name, dialogue lines in order
  with a "once" flag, a behaviour (stand, walk a path, follow, flee, patrol between two tiles), a shop (items with prices in coins)), things
  (items: a sprite, a name, what it does: a coin, a heart, a key for a named door, a quest item, a power that doubles the jump or breaks
  crates for a time, a sellable), quests (a quest has a name, steps in order (TALK TO a person, COLLECT n of a thing, REACH a room or a tile,
  DEFEAT n of an enemy kind), a reward (coins, an item, a door opened, a line said), and the quest line the UI shows), enemies (the
  platformer's four kinds with his sprite over them, plus a chaser for top-down), rules (lives, what ends the game (the last quest, a room
  reached, lives gone), a timer or none, coins kept across rooms), UI (hearts, coins, the quest line, a sign's text when stood on), sound
  (one of the kit's tunes per room and the kit's effects, or his own eight-bar tune typed in the kit's note language), save points (a tile;
  the save is the whole game state), progression (rooms locked until a quest or a key). A game's history for undo (sixty deep).
- **One runtime plays any game (studio-game/runtime.ts): an arcade Engine with id `studio`** (types.ts's union gains it) built on two/shell's
  makeEngine as the platformer is: the body core for movement, the tiles for collision, the dialogue box (a 44 pt NEXT), the shop sheet, the
  inventory sheet (a grid of his items, USE and DROP), the quest line, the save point's "Saved" said once, CONTINUE from the arcade's
  SaveStore, the pad (◀ ▶ A B under the thumbs, a d-pad for top-down), a controller and the keyboard, haptics on hurt and pick-up, reduced
  motion stilling the parallax; headless too (`headless(game, inputs)` steps it with scripted inputs for the node test). A game he made sits
  on the ARCADE shelf as `madeByUs: true`-shaped entry under MY GAMES with PLAY at once, its card ending in his best.
- **The store (studio-game/store.ts):** games in the phone's own database (IndexedDB, the documents' shape), saved 200 ms after a change
  ("Saved" fading once), a thumbnail (the first room drawn small); about 100 games or 200 MB, the oldest let go first and said by `room()`.
  SHARE writes a `.ghostygame` (a zip of the game's JSON and its pixel sheets as PNG, through convert/zip.ts) with the size said; IMPORT reads
  one (through the library's Add and the chat); a game from someone else is his once imported and is said to be theirs by name if the file
  names a maker.
- **AS AN APP (studio-game/app.ts):** EXPORT AS AN APP writes one self-contained HTML page (the runtime bundled by build.mjs as its own small
  script, inlined; the game's JSON and sheets inlined; a manifest with name, standalone, start_url and scope; a 512 px icon drawn from the
  first room; a security policy with no network, as the app kit's pages have) to the library with the size said (target under 400 KB; the
  measured number in the report), and PUT IT ON MY SITES sends that page through the existing sites path (the same route a made site takes
  today, so it is served at /s/<name> and Add to Home Screen works as apps.spec proves for the kit's apps). If the existing sites path cannot
  carry the page as it is (a size cap or a kit-only check in the protected Worker), the export stays the HTML file in the library and PUT IT
  ON MY SITES is NEEDS HIS WORD for KERNEL 3, named in the report with the exact line that stops it: nothing protected is edited to get it through.
- **Ghosty helps, as chat turns:** SKETCH A ROOM ("a cave with two ledges and a chest at the end") returns rows in the little language that
  land in the room editor as a draft he can paint over; DIALOGUE FOR this person returns lines he can edit; both are chat turns with the game's
  own words as context (IDEAS-ROUND-1 item 3), the prompt guard untouched, a "first draft: paint over it" line said once.

## The screen

MAKE → THE GAME STUDIO (the hub card; the catalogue entry; "my games", "make a game" in the chat; the ARCADE room's MY GAMES row lists what he
made with PLAY and EDIT). MY GAMES as a shelf of thumbnails; NEW from three templates (A PLATFORMER: two rooms, a flag, coins; AN ADVENTURE:
top-down, a village room and a cave room, one NPC with a quest; COLLECT THEM ALL: one big room, a counter) or BLANK. The editor as pills:
ROOMS (the grid at the phone's width, pinch to zoom, one finger paints the picked tile, two fingers pan; tools at 44 pt: PAINT, ERASE, FILL,
PICK, a tray of tiles with his own at the end and DRAW A TILE; the room's size and name; DOORS by tapping a door tile then the room it goes
to; PLAY FROM HERE), SPRITES (the 16 × 16 pixel editor: the palette, PEN, FILL, MIRROR, frames with onion skin, PLAY the animation, DUPLICATE,
each cell 22 pt at least so a finger lands, the whole at 390 upright), CHARACTERS (the player's sprite, speed and jump on sliders with their
numbers said; NPCs as cards: sprite, name, dialogue lines typed in the line above as the editors do, behaviour from a sheet, SHOP with items
and prices), THINGS (items as cards with what each does from a sheet), QUESTS (steps added one at a time from a sheet, the reward, the quest
line as the player will read it), RULES (lives, the end, the timer, the kind), SOUND (the kit's tunes, his own eight bars typed, effects on
or off), PLAY (test play in place with the pad; a RESET; the quest line and hearts live), SHARE (.ghostygame with the size said; IMPORT), AS AN
APP (the page's size said before; the file in the library; PUT IT ON MY SITES through the sites path with its address said after). Undo
everywhere, UNDO in the line. Every state in his voice: no game yet (one line and the three templates), a room with no exit said, a quest that
cannot be completed (a COLLECT of a thing no room holds) said before PLAY, an import that kept less than it read, offline (everything works;
PUT IT ON MY SITES waits and says so), room running out. GLASS, THE SCAN, ONE INK and the HUDs each wear it; the 44 pt and no-sideways rules
hold on the studio screens (the game itself plays upright as the platformer does).

## The benchmark (PROGRAMME-EDITORS 8; timed on the preview and said in the PR)

The spec makes a game as he would in an afternoon and times each step: NEW from AN ADVENTURE; a third room painted with FILL and twenty
taps; a door placed and linked; one tile drawn in the pixel editor and placed; the player's sprite's walk given a second frame; one NPC added
with two dialogue lines and a shop selling a key for five coins; a quest made (TALK TO the NPC, COLLECT three coins, REACH the cave, with a
chest as the reward); a save point placed; PLAY: the quest walked through headlessly by scripted inputs to its end (coins picked, the key
bought, the door opened, the chest reached), saved at the save point, the page reloaded and CONTINUE restoring the room, hearts, coins and
the quest step; SHARE: the .ghostygame's size said and read back equal; AS AN APP: the page's size said and under the target, its manifest
parsed with name, standalone, start_url and scope, its script pinned by the policy, and (where the sites path takes it) served at /s/<name>
and installable as apps.spec checks. Playing it ten minutes on a real phone NEEDS HIS PHONE.

## Tests (each fails on the code before this brief; run against it once and say so)

- apps/edge/test/gamestudio.test.mjs (new; imported from an existing test file as kernel-yes was, one import line, since the test list is
  protected; NEEDS HIS WORD names it): the model's validation (a door to a room that does not exist, a quest for a thing no room holds, a
  room over 64 × 32: each refused with his words); the little language round trip with his tiles; the runtime headless on the template
  games (the platformer template's flag ends it; the adventure's quest completes on scripted inputs step by step; a shop refuses a buy with
  too few coins and says so; a key opens only its door; a save point's state restores equal; lives gone ends the game); the top-down body
  with gravity off; the .ghostygame writer and reader round trip; the app page's parts (manifest fields, the policy line, the inlined data
  equal, the size under the target); undo depth.
- tests/gamestudio.spec.mjs (new; `all=` word `gamestudio` at the END of the list in check.yml, nothing else in .github touched), at 440
  and 390: (a) MAKE → THE GAME STUDIO in two taps (through EDITORS if folded); "make a game" opens it; (b) the empty state's words and the
  three templates; NEW from AN ADVENTURE lists its rooms; (c) a tile painted, FILL, ERASE, PICK; a door linked; pinch zoom; (d) the pixel
  editor draws a tile, mirrors it, adds a frame and plays the animation; the tile appears in the tray and paints; (e) an NPC with dialogue
  and a shop; a thing; a quest built; RULES changed; (f) PLAY in place: the pad, a coin counted, the dialogue box and NEXT, a buy, the quest
  line advancing, the save point's "Saved", RESET; (g) a quest that cannot be completed is said before PLAY; (h) SHARE's size said and the
  file read back equal; IMPORT lists it; (i) AS AN APP: the size said, the manifest parsed, the policy present, and the sites path's result
  said (served at its address, or the honest line); (j) the ARCADE's MY GAMES row shows the game with PLAY and EDIT; (k) autosave said once
  and the editor reopens on the same room; UNDO after a delete; (l) BODY 21 clips nothing, every control 44 pt, nothing sideways, the pixel
  editor's cells at least 22 pt at 390.
- games5, games4, arcade, apps, sites, hubcards, deck, nav, speed2, look, ink, thescan unchanged unless a fix lives in a screen they own.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8835:
`(nohup setsid node tests/preview-server.mjs 8835 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8835.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8835 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is never committed. In the foreground, alone, one after another: gamestudio, games5, games4,
arcade, apps, sites, hubcards, deck, nav, speed2, look, ink, thescan, layout. The brain tests in the background once at the end. A timing
budget missed under load is rerun alone before it is called red. Known sandbox reds not touched: direct, aim, radio, scroll, safari, eye's
own screenshot, tabs2, talk's cooling lines. Disk is tight: tests/.shots removed after every run.

## The owner's phone check

1. MAKE, THE GAME STUDIO, NEW, AN ADVENTURE: the village and the cave. PLAY: walk, talk to the villager, read the quest line.
2. ROOMS: paint a third room with your finger; FILL the floor; place a door and link it to the cave. PLAY FROM HERE: walk through it.
3. SPRITES: draw a 16 × 16 tile and a two-frame walk for your player; PLAY the animation. Does drawing feel right under a finger?
4. CHARACTERS: give the villager two lines and a shop selling a key. QUESTS: talk, collect three coins, reach the cave; a chest as reward.
5. PLAY the whole quest; save at the save point; close the app; ARCADE → MY GAMES → CONTINUE: where you were.
6. SHARE: the size said; send it to a friend with the app: it opens in their studio. AS AN APP: PUT IT ON MY SITES, open the address,
   Add to Home Screen, play it from the icon offline.
7. Ask "sketch a cave room with two ledges": the draft lands in the editor; paint over it.
8. Does it feel like a game maker or like a level painter? Say which, and what you wanted to add that is not there.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/gamestudio-report.md: what was built, the model's shape, the
runtime's rules reused from the platformer and the cave, the app page's measured size and whether the sites path took it (the exact line if
not), the benchmark's times, each spec's last line (before and after for the new ones), found-not-fixed, NEEDS HIS WORD (the test's name in the
list; PUT IT ON MY SITES if blocked; a `game` brain tool), the phone check as above, the commit list. One commit per step on
builder/gamestudio; the orchestrator squashes to one on landing.
