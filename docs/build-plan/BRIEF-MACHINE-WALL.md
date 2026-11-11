# BRIEF: PHONE IN HAND, MACHINE ON THE WALL (the Machine on a TV or a laptop screen, the phone the remote; STARS 165)

BRIEF-MACHINE-WALL (OWNER-ISSUES 176 "do all of it" and 178; STARS 165 "talking on the phone while the TV shows what he is talking about:
the map, the plan, the car, the chart, the tune's waveform, the two as one session over the brain, the wall following the conversation with
no touch"; THE-GUIDE-11-NOV section 7; QUEUE-11-NOV item 8). One builder, one PR. TV MODE already exists (apps/web/src/tv/, big keys, a focus
ring, on by itself on a television); this brief gives that screen a reason to be on: it becomes THE WALL, a second screen of the same Ghosty
that shows whatever his phone is talking about, with nothing to touch on it. The design system is the only look; THE SCAN, ONE INK, GLASS and
the HUDs landed by then keep working; THE QUALITY RULE holds (every state designed, every word his, every wait said, every number honest,
every control 44 pt, nothing merely fine).

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. The wall's brain route goes in its own file
(apps/edge/src/wall.ts) mounted where the feature routes already mount (the guardian's mount, as LIFE EASIER's watchers were); if mounting needs
index.ts, it is NEEDS HIS WORD and the phone side is built to a stub. No package: the wall is served by the same app at the same address.

## What is built

1. **PAIRING, ONCE, IN HIS OWN BRAIN.** On a television or a laptop, Ghosty's address opened in TV MODE (or Settings → TV MODE → THIS IS THE
   WALL) shows one screen: the orb, "I am the wall." and a six-letter code in the Machine's type (letters only, no look-alikes, new every two
   minutes until paired). On the phone: Settings → THE WALL → PAIR, type the code (or say "pair the wall, <code>"); the brain joins the two
   under his own account (the brain's existing auth; a code pairs only a screen that already has his address and his brain) and the wall
   says "Paired with your phone." then fades to the resting face. One wall at a time; the pairing kept until LEAVE on either side or thirty
   days. Nothing of this is a new key; the code never leaves his brain; a wrong code three times waits a minute and says so.
2. **THE WALL FOLLOWS THE CONVERSATION.** Whatever the phone's Stage would draw (SHOW ME's kinds: chart, map, document, room, part, car,
   place, the tune's waveform where the player is open, the plan's day, the Lens's named thing when he says "show that on the wall") is sent
   by the phone to the brain as the same data the Stage uses (kind + data, never a picture of the screen, never the camera frames, never a face)
   and the wall draws it full-screen with the same renderers (show/*, the maps, the isometric room, the 3-D engine's scene where landed), at
   television scale (the Machine's type at 2× its phone size, labels never clipped, one picture at a time, the sentence it answers along the
   foot in one line). The wall receives through one long-poll or server-sent stream from its own route (`GET /wall/stream`), no schedule of
   its own; the phone posts through `POST /wall/show`; both carry the pair. The wall's picture changes within 1.5 s of the phone's (measured
   on the preview and said in the report). With nothing to show, the wall rests: the orb, the hour, the day's first thing, the weather at
   Home if saved, in the Machine's marks, nothing moving but the orb's breath.
3. **THE PHONE IS THE REMOTE.** On the phone, when a wall is paired, the Stage's own picture gets a WALL key (44 pt) that sends it; "on the
   wall" after any ask sends the answer's picture there and keeps the phone's chat clear; "wall off" / "clear the wall" rests it; swiping the
   wall's thumbnail on the phone's THE WALL page changes nothing on the TV but what is sent. The wall itself has two keys and no more:
   PAIR (before pairing) and LEAVE (a long press anywhere, 1 s, with a count ring, so a brushed remote cannot unpair). A controller's d-pad or
   the arrow keys do nothing the wall needs; TV MODE's focus ring is kept for the two keys.
4. **WHAT THE WALL NEVER SHOWS.** No camera, no Lens frames, no face, no stranger, no live position (a place is a named saved place or a
   public place), no spending line, no message text of another person, no notification body; the wall shows pictures and their one sentence.
   A kind not on the list above is refused at the phone with "That stays on the phone." The wall shows nothing when the phone has been silent
   for an hour (it rests), and nothing after LEAVE.
5. **OFFLINE AND LOST.** Wall without the brain: "I lost my brain. The phone's picture will come back when it does." in the Machine's voice,
   the last picture kept dim. Phone without the brain: the WALL key says "No wall right now" and the picture stays on the phone. Pairing
   without a signal: said once, nothing retried in a loop. Reduced motion: no fade, the picture appears where it lands.

## What must not change

The first-screen budget and every other budget (the wall's own first screen under the hero budget too); GLASS pixel-equal; ONE INK's page;
every control 44 pt; nothing sideways on the phone at 440 × 956 or 390 × 844; the wall right at 1920 × 1080 and 1280 × 720; the finding rule;
the ratchet ceiling (hex 506, rgba 1016, radiusPx 470, total 1992: equal or lower); the prompt guard; no new key; the brain never gets live
GPS; TV MODE's existing behaviour where no wall is paired.

## Tests (each fails on the code before this brief; run against it once and say so)

- tests/wall.spec.mjs (new; `all=` word `wall` at the END of the list in check.yml, nothing else in .github touched): two pages, one at
  1920 × 1080 as the wall, one at 440 × 956 (and once at 390 × 844) as the phone, both against the preview's mock brain: (a) the wall shows the
  code in the Machine's type; the phone pairs with it; the wall says it is paired and rests; a wrong code three times waits and says so; (b)
  "show me a chart of my bills" on the phone with seeded statements, then WALL: the wall draws the chart within 1.5 s, labels inside the
  screen, the sentence along the foot; (c) "where is Lisbon?" then "on the wall": the map on the wall, the phone's chat clear; (d) a refused
  kind (the Lens with a face fixture, "show that on the wall") stays on the phone with the refusing words; (e) "clear the wall" rests it;
  LEAVE by long press unpairs both; a short press does not; (f) the wall with the brain route failing says its lost line and keeps the last
  picture dim; (g) the wall at 1280 × 720 clips nothing; reduced motion: no transition class on the picture's arrival.
- apps/edge/test/wall.test.mjs (new; imported from an existing test file as kernel-yes was, one import line, since the test list is
  protected; NEEDS HIS WORD names it): a code pairs once and expires; show stores the last picture under the pair and the stream delivers
  it; a kind off the list is refused by the brain too; LEAVE clears; thirty days clears.
- showme.spec, tv (or the spec that owns TV MODE: restc), settings, speed2, look, ink unchanged unless a fix lives in a screen they own.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8820:
`(nohup setsid node tests/preview-server.mjs 8820 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8820.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8820 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is never committed. In the foreground, alone, one after another: wall, showme, restc, settings,
speed2, look, ink, thescan, talk, layout, nav. The brain tests in the background once at the end (rebuild the preview's brain bundle first:
`npx esbuild src/index.ts --bundle --format=esm --platform=neutral --external:cloudflare:sockets --outfile=test/.build/brain.mjs` in
apps/edge). A timing budget missed under load is rerun alone before it is called red. Known sandbox reds not touched: direct, aim, radio,
scroll, safari, eye's own screenshot, tabs2, talk's cooling lines.

## The owner's phone check

1. Open Ghosty on your TV's browser (or a laptop): TV MODE comes on by itself on a television; "I am the wall." and a code.
2. Phone, Settings, THE WALL, PAIR, type the code: the TV says "Paired with your phone." and rests with the orb and the hour.
3. "How have my bills gone this year?" then tap WALL on the picture: the chart on the TV within a breath, readable from the sofa.
4. "Where is Lisbon, on the wall": the map on the TV, your phone's chat stays clear.
5. Lens on a face, "show that on the wall": it stays on the phone, and says so.
6. "Clear the wall": the TV rests. Hold anywhere on the TV for a second: LEAVE, both sides unpaired.
7. Turn the brain's Wi-Fi off at the router for a minute: the TV says it lost its brain and keeps the last picture dim.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/wall-report.md: what was built, the measured phone-to-wall
time, stills of the wall at both sizes with each picture kind, each spec's last line (before and after for the new one), found-not-fixed,
NEEDS HIS WORD, the phone check as above, the commit list. One commit per step on builder/wall; the orchestrator squashes to one on landing.
