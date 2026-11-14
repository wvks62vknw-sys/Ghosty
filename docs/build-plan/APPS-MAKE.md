# THE APPS ROUND: MAKE: GAME STUDIO 3D (14 November 2026)

You asked for "the ability to make 3d games". It's here: **MAKE → GAME STUDIO → 3-D GAMES**, at the top of the Game Studio's page.

## What I built

- **Six 3-D games that play in one tap.** Each one runs on the app's own 3-D engine (three.js) with real physics (Rapier):
  - **Platformer:** run and jump across blocks and a moving platform, collect the coins, reach the flag. You have three lives, and a fall costs one.
  - **First-person explorer:** walk a walled garden and find five gems before the two-minute clock runs out.
  - **Kart track:** drive through three gates. The finish line opens only after all three.
  - **Physics puzzle:** push two real crates onto the green pads.
  - **Marble roll:** roll down ramps and off bumpers into the goal.
  - **Top-down shooter:** fly the ship and clear the enemies with FIRE.
- **Real physics.** Your player is a real physical body: it runs and jumps, walks, drives, rolls (the marble actually turns as it rolls) or flies. Crates slide and tip, platforms and enemies move along their paths, and every object has its own bounce and friction.
- **Play.** A touch stick plus JUMP or FIRE, the keyboard, or any game controller. A pale "ghost" ball replays your last run so you can race it.
- **Smooth on a slow phone.** If two frames in a row come slowly, it draws at a lower resolution, step by step, before it would skip frames. Your taps are read the moment you touch, never held up by a slow frame.
- **Describe a game.** Type, or say in the chat, something like "a night platformer with 10 coins and low gravity". It works on your phone with no AI model:
  - It picks the template and lists each change: "10 coins", "a night sky", "low gravity, like the Moon".
  - Each change is marked ACCEPTED, and one tap switches it to REJECTED.
  - MAKE IT builds and plays only the changes you kept.
- **Edit it into your own.**
  - **The world:** sky, fog, sunlight, gravity and the clock.
  - **Objects:** add blocks, ramps, moving platforms, coins, gems, crates, pads, enemies, doors, a goal and bumpers. Each lands on a 1 m grid and you can move, raise, recolour or delete it.
  - **How each moves:** it can stay put, fall and get pushed, or move along a path.
  - **PLAY FROM HERE:** starts a test run right above the object you picked.
- **Logic without code.** "When → then" rules, each one written out as a sentence, like "When the player touches a coin, add 1 to the score."
  - When: the game starts, the player touches something, a crate rests on a pad, the score reaches a number, the time runs out, the player falls, or every one of a kind is gone.
  - Then: add to the score, take it away, you win, you lose, open the goal or a door, say something, start again, or add seconds.
- **Saved on your phone.** Your games and their ghosts stay on the phone, and they're still there after a reload.
- **Opens from the chat:** "make a 3d game", "my 3d games", or a description like "make a 3d kart race for 3 minutes".
- It uses the App Kit's empty, loading and error cards, each with its next step. It's listed in Abilities and in WHAT'S NEW.

## How to try it

1. MAKE → GAME STUDIO → tap **Platformer**. Use the stick and JUMP, collect the coins and reach the flag. Then PLAY AGAIN to race your ghost.
2. Tap **EDIT** on your game. Add a coin, move it with RIGHT, add a rule, then PLAY FROM HERE.
3. Type "a night platformer with 10 coins and low gravity" into DESCRIBE A GAME, tap DRAFT IT, reject one change, then MAKE IT.

## How it's checked

- **A new spec, `game3d`** (125 checks, about a minute). It covers:
  - every rule worked out by hand;
  - all six templates starting under software rendering (as on CI);
  - the stick and JUMP being read instantly;
  - a coin and the flag reached;
  - the ghost;
  - the draft from words and from the chat;
  - the editor, PLAY FROM HERE and a reload;
  - 44 pt keys at both phone sizes, at BODY 21 and in all seven looks.
- The full brain suite passes, and so do the existing Game Studio specs.

## What is left

- **Putting a 3-D game on your sites (waiting for APPROVE).** Your brain's game-site route only takes 2-D games today, and a one-page 3-D game would have to carry the 3-D engine and the 4.3 MB physics. Same for saving a 3-D game as a single page you can install.
- **Free CC0 models and textures on the stage**, which would download only on your tap, on Wi-Fi, with the size said.
- **Shaping and painting terrain, joints, and camera zones.**
- **WebGPU.** Today it's WebGL, held smooth by the frame-rate guard.
- **The other apps on the list:** the 2-D studio's own logic blocks, the existing apps against their leaders, and the new apps (Puzzle Box and the rest).

## A note for the coordinator

`gamesites.spec` fails here at "(q) the game opens on its front page" both with and without my changes, so it isn't from this lane.
