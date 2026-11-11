# BRIEF: POLISH 2 — THE PICTURE (the Stage's charts, maps, documents and rooms made good; the Lens's tags smoothed; a drawn picture sent to Telegram)

BRIEF-POLISH-2 (OWNER-ISSUES 176 and 178; THE-GUIDE-11-NOV section 8 items 2, 3, 10; QUEUE-11-NOV item 4 and THE QUALITY RULE). Nothing new is
added. SHOW ME is right but plain; this pass makes every picture it draws something he would show a friend, steadies the Lens's tags, and lets
Telegram carry the same picture. One builder, one PR. The design system is the only look; THE SCAN, ONE INK and GLASS all keep working.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. apps/edge/src/telegram.ts is NOT protected.

## What is made right

1. **THE CHART (show/chart.ts).** Axis labels in the system's truth type, never clipped; the unit on the axis once (£, %, °C, km) and never on every
   tick; ticks at round numbers (1, 2, 5 steps); a single series gets the accent, two to four get the system's own sequence (no new hex: the
   ratchet holds); the last point labelled with its value; a title line that is the question's own words ("Your bills this year"); negative values
   below a drawn zero; dates as human words ("Jan", "last week"), never raw stamps; a chart with one point says the number large instead of a
   chart; a chart with no data says so in his words. At 390 the chart is still legible (labels thin out before they overlap).
2. **THE MAP (the Stage's map kind, ui/maplibre.ts, ui/flatmap.ts).** The zoom fits the place: a town fills the Stage, a country shows its outline,
   a street shows its block; the pin is the system's mark with the name beside it, never over it; a route is drawn whole with its ends named and
   the time on it; the offline map is used when the online one cannot load, with "offline map" said once; the first paint under 600 ms from
   the data arriving (measured; a waiting line before it, from POLISH 1's helper if landed, else the same words inline).
3. **THE DOCUMENT (the Stage's document kind).** A plan or a letter on the Stage is set as a page (the Documents editor's own layout if landed,
   else a page with margins), in the system's reading type, the first lines visible and the rest scrolling inside the Stage, OPEN taking it to
   the editor; a formula's simulation (show/sim.ts) gets its variables as dials with their units and the answer line restated as the dial moves.
4. **THE ROOM AND THE PART (show/iso.ts, show/parts.ts).** Light from above-left with a soft shadow on the ground, the system's ground colour, the
   sizes written on the edges in the unit he used, a slow turn that stops on touch, a part named where it is; the 3-D engine's scene used when
   landed, the isometric drawing otherwise, both reading the same data.
5. **THE HAND-OVER FROM THE SENTENCE.** The Stage rises under the first sentence with the system's one easing, no layout jump of the sentence
   (reserve its height when the kind is known), the pointing sentence after it is set once the picture is painted and never before; on a bad
   pick the Stage leaves as quietly as it came.
6. **THE LENS'S TAGS STEADIED (features/lens/index.ts).** A tag keeps its box for at least 300 ms after its last sighting (no flicker when the
   finder misses one frame); a box moves with an eased follow, never a jump; the namer's word replaces the finder's only when it has been the same
   for two frames; a tag leaving fades out rather than vanishing. Reduced motion: no eased follow, still no flicker. The Lens's existing budgets
   (the 4 ms text check and the rest) unchanged and re-read in the report.
7. **A PICTURE ON TELEGRAM (apps/edge/src/telegram.ts).** When a reply would draw a Stage on the phone, the Telegram reply sends the same picture as
   an image after the sentence (the brain renders the chart as SVG to PNG with the renderer the brain already uses for pictures in telegram.ts's
   photo path; the map as a static image from the free tile source the app already uses with the pin drawn; the document as a page image; the
   room as the isometric drawing); when it cannot, the sentence alone, said once. No new key; nothing fetched the phone does not already fetch.

## What must not change

The first-screen budget and every other budget; the Stage's own budget from BRIEF-SHOW-ME-1 (the picture within 2 s of the data); GLASS pixel-
equal; ONE INK's page (its Stage is drawn in ink: hairlines, no fill); every control 44 pt; nothing sideways; the finding rule; the ratchet ceiling
(hex 506, rgba 1016, radiusPx 470, total 1992: equal or lower); the prompt guard; no new key; the brain never gets live GPS (places are named
places); the Lens's privacy lines (no stranger named).

## Tests (each fails on the code before this brief; run against it once and say so)

- tests/polish2.spec.mjs (new; `all=` word `polish2` at the END of the list in check.yml, nothing else in .github touched), at 440 and 390: (a) a
  seeded chart has no clipped label (every text node's box inside the Stage), round ticks, the unit once, the last value labelled, a one-point
  chart as a number; (b) a seeded place fits (the pin inside the middle third; a country's outline inside the Stage); a seeded route is drawn whole
  with both names; (c) a seeded letter is set as a page with OPEN; (d) a seeded room has its sizes on the edges and stops turning on touch; (e) the
  sentence's box does not move when the Stage rises (its top before and after equal); (f) the Lens with a fixture feed that drops a tag for one
  frame keeps the box drawn and moves it by easing (position sampled over three frames monotone, no jump over 40 px); (g) ONE INK's Stage is drawn
  in hairlines (no filled rect in the chart).
- apps/edge/test/telegrampic.test.mjs (new; imported from an existing test file as kernel-yes was, one import line, since the test list is
  protected; NEEDS HIS WORD names it): a reply with a chart's rows sends one photo after the text; a reply that cannot be drawn sends the text alone.
- showme.spec, lens.spec, speed2, look, ink unchanged unless a fix lives in a screen they own; then that spec's check is the proof.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8815:
`(nohup setsid node tests/preview-server.mjs 8815 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8815.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8815 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is never committed. In the foreground, alone, one after another: polish2, showme, lens, speed2, look,
ink, thescan, talk, telegram, layout, nav, studio (its screenshot line is a known sandbox red). The brain tests in the background once at the
end (rebuild the preview's brain bundle first: `npx esbuild src/index.ts --bundle --format=esm --platform=neutral --external:cloudflare:sockets
--outfile=test/.build/brain.mjs` in apps/edge). A timing budget missed under load is rerun alone before it is called red. Known sandbox reds not
touched: direct, aim, radio, scroll, safari, eye's own screenshot, tabs2, talk's cooling lines.

## The owner's phone check

1. "How have my bills gone this year?" (statements added): a chart you would show someone: round ticks, £ once, the last value written.
2. "Where is Lisbon?" then "where is my work?": the first a country's shape, the second your street's block, the pin named beside it.
3. "Write me a letter to the council about the bins": a page on the Stage, OPEN takes it to Documents.
4. "Draw me a 3 by 4 metre kitchen": lit from above-left, the sizes on the edges, it turns and stops when you touch it.
5. The Lens on a table of things: the boxes follow smoothly, none flickers.
6. On Telegram: "how have my bills gone this year?": the sentence, then the same chart as a picture.
7. ONE INK on, "where is Lisbon?": the map in ink lines.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/polish2-report.md: before-and-after stills of each picture kind,
the Lens budgets re-read, each spec's last line (before and after for the new one), found-not-fixed, NEEDS HIS WORD, the phone check as above,
the commit list. One commit per step on builder/polish2; the orchestrator squashes to one on landing.
