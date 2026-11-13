# FINAL ROUND: SITES (KERNEL 3 item 6, a game on your sites as an installable page)

Lane `lane-sites`, branch `claude/new-session-4erjve-lane-sites`. Built by the mid tier. Nobody was there to answer questions, so
every decision is written down below.

## What was wrong
- The Game Studio's PUT IT ON MY SITES key only said "I can't put this on your sites yet: that needs a change to my server, which
  needs your word." It was a dead key.
- A page on your sites (/s/<name>) is shown inside a locked frame that has no storage. A game shown there could not keep its saves,
  could not be added to your Home Screen, and could not play offline.
- The game tool's own words said a studio game is "never published". Once this was built, that would have contradicted itself.

## What I made
1. **The studio hands the game over to wait. It publishes nothing.** Tapping PUT IT ON MY SITES (or typing "put Fox Run on my sites"
   in the chat while the game is open in the studio) sends the open game to the brain (`POST /api/sites/game`). This needs your
   sign-in like every brain call.
   - The brain reads the game back with the studio's own reader and checks it with the studio's own list of problems.
   - The size limit is 350 KB.
   - It is kept as THE GAME WAITING: one game, the latest, for two hours.
   - Nothing about this step makes anything live.
2. **One chat turn and your APPROVE, every time.** The key sends "Put Fox Run on my sites" to the chat. The brain's new tool,
   `publish_game`, is a confirm tool, so the chat stops at an approval card:
   > Put your game "Fox Run" on your sites at …/s/fox-run/? Anyone with the link can play it (15 KB). It installs to a Home Screen,
   > plays offline and keeps its saves on the phone that plays it; it reaches nothing on the network and asks for no camera,
   > microphone or location.
   - The approval puts a copy of the game into a **one-time ticket**. The publish step only publishes a ticket's game, once, and only
     within 30 minutes.
   - So a publish that did not come through your APPROVE is refused. That covers no ticket, a made-up ticket, a used one and an old one.
   - What goes live is exactly what you approved, even if the game changes on your phone after you saw the card.
   - There is only ever one ticket, the latest card's. A card you declined leaves no copy of the game behind, and an older card
     cannot publish once a newer one exists.
   - The same game again updates its own link. Another page's link is never taken over: the game gets `-2`.
3. **Served straight at /s/<name>/, as its own page.**
   - **The page is built fresh on every visit.** It is made from the stored game and the studio's own player as your deployed app
     serves it (`/studio-player.js`, from the same build). The game is inside the page only as data, never as code.
   - **Strict security policy.** It allows exactly that one script and one style, each pinned by its hash. It allows no network at all
     (`connect-src 'none'`), no forms and no frames, and the page cannot be put inside anyone else's frame. It also blocks camera,
     microphone and location.
   - **Its manifest, icon and offline worker** come from `/s/<name>/page`:
     - the manifest says standalone, with its own start and scope;
     - there is one icon, the first room drawn flat;
     - the offline worker is the one the mini-apps already use, and it keeps only this page.
   - **Its saves** are kept under its own key on the phone, `ghosty-site:<name>`, and the player touches no other key.
   - **UNDO:** "take <name> down" (unpublish_site) stops the link working.
4. The studio's key now shows the sentence from the brief: *Ask me in the chat: "put Fox Run on my sites" and I'll ask your APPROVE.*
   Under it is the tap that does it. Offline, it says it waits for a connection.
5. The words now match what it does:
   - The game group's line in the brain says a game reaches your sites only by publish_game and your APPROVE.
   - The catalogue has "Put your game on your sites".
   - The chat's narration says "putting your game on your sites…".

### Decisions I made, and why
- **One line in `index.ts` (your yes for this route).** When a page stored in KV is a game, it goes to `gamesite.ts`. The exact diff:
  ```diff
  +import { gameSiteResponse } from './gamesite';
  …
  +        // [sites] A game from his studio (gamesite.ts): its own page, manifest, icon and offline worker, served straight.
  +        if (site?.game) return gameSiteResponse(site, env, url.origin, url.pathname, pub[2] ? (dest ?? '') : null);
           if (site) return pub[2] ? siteFrameResponse(site, dest) : siteResponse(site);
  ```
- **Two lines in `agent.ts` (a protected file, under the round's full permission; the commit says why).**
  - (a) The hand-over is answered inside the brain, so the game is in the brain's own storage before your message arrives. KV alone
    is not read back straight away everywhere, so the brain could have missed a game you had just sent.
  - (b) The brain's fallback for /s/ pages can serve a game published a moment ago, before KV has caught up.
- **`apps/edge/package.json`**: the test list only. `gamesites.test.mjs` is added at the end.
- **The player comes from the deployed interface and is never stored.** Nothing written into a game can ever run, and a fix to the
  studio's player reaches every published game.
- **"Storage scoped to that page".** Pages on your sites share Ghosty's own address, as the mini-apps already do. So the scope is the
  page's own key, and the player is the only script that can run there. A truly separate origin would need a separate host, which
  means setup and possibly cost.
- **The approval card shows the ticket** in its "exactly what I'll do" line, because that line lists every argument the step gets.
  This is harmless: the ticket is single-use and lasts 30 minutes.
- **gamestudio.spec's old check** ("PUT IT ON MY SITES says honestly what stops it") now checks the new sentence. The tap itself, your
  APPROVE and the published page are checked by the new spec, so no test was skipped or weakened.
- **The prompt guard (5,500) was not raised.** Naming publish_game in the plain prompt's tool list put two worst cases (spoken,
  Telegram voice note) 4 and 6 characters over. I condensed two always-on lines by 8 characters and kept every word other tests read:
  - "TIMES: when you pass a time to a tool**:** <you>'s local …" (was ", use …");
  - "WORK IN CHAINS: … **chain them**, each feeding the next; independent **calls** in ONE." (was "do the chain", "lookups").

  This leaves only about 2 characters spare under the guard, so any other lane that adds prompt words must cut words of its own.
- **A second tap while the key is working does nothing**, so it never asks twice.
- **The test brain** (`llm/mock.ts`, test only) learned "put <name> on my sites" → publish_game, so the spec can run without a model.

## Tests
- **Brain test** `apps/edge/test/gamesites.test.mjs`, 5 tests, all passing. They check:
  - the tool always stops for APPROVE;
  - the hand-over needs your sign-in, refuses a thing that is not a game and refuses an oversized one, and publishes nothing;
  - a publish without the approval's ticket is refused (no ticket, a made-up one, an old one, a used one);
  - the approval's exact sentence;
  - the approved copy is what goes live;
  - an update stays at the same link, and another game gets `-2`;
  - the page's exact security string and its one pinned script;
  - a game named `</script><script>` stays data and does not run;
  - the saves key, the manifest, the 512 px icon and the offline worker;
  - /page opened as a page goes to the game, and /s/<name> without the slash goes to /s/<name>/;
  - the brain's fallback serves the game while KV has not caught up;
  - with no player to be had, it says so in words (503) and never shows a broken game.

  These tests fail on the code from before this lane, which had no `publish_game` and no `gamesite.ts`.
- **The full brain suite: 2,158 tests.**
  - The first full run had 2 reds: the catalogue had no words for publish_game, and two worst-case prompts were over 5,500. Both
    are fixed.
  - The second full run had 1 red: social.test reads an earlier round's exact BUILDING THINGS wording, which I had condensed. That
    line is back word for word, and the 2 characters were found elsewhere.
  - After that, social, prompt, voiceknown, catalogue, sites, game-tool, gamesites and telegram all pass.
- **prompt.test**: the exact list of the sites group's tools now names publish_game. The game group's line is 212 characters, under
  its 220 ceiling. The prompt guard was not raised.
- **Spec** `tests/gamesites.spec.mjs`; its word `gamesites` is added at the end of check.yml's `all=`. It runs at 440 × 956 and
  390 × 844. Its last line:
  `PASS gamesites: a studio game on his sites, behind his APPROVE, installable, offline, its saves its own`.
  It runs again safely on the same brain, because a second run gets `-2` links.

## How to try it on your phone
1. In the chat: "Make me a platformer about a fox". The studio opens on Fox Run.
2. Open AS AN APP → PUT IT ON MY SITES and read the sentence. Tap **Put it on my sites**. The chat opens with "Put Fox Run on my
   sites" and an approval card.
3. Tap **Approve**. Tap the link card.
4. Add it to your Home Screen: in Safari, Share → Add to Home Screen.
5. Play until you reach a save point, then close the game.
6. Turn on Airplane Mode and open it from the Home Screen: it opens, and CONTINUE has your save.
7. To take it down: "take fox-run down" in the chat.

## What is left
- No real iPhone was used: Add to Home Screen was checked through the manifest and icon, not on a phone.
- Each "on my sites" message from the studio sends the game once more. That is one write to KV's free allowance each time, which is
  well within it, but it is a repeat.
