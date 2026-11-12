# BRIEF: THE WORKING ENGINE — a real 3-D engine model that turns, every part named (first estimate, never certified)

BRIEF-WORKING-ENGINE (OWNER-ISSUES 91a "i have this car and this is what's wrong with it", 164 and the audit "the working 3-D engine", 176
"do all of it", 178 "insane quality"; THE-GUIDE-11-NOV section 7 "a working 3-D engine model of a car's engine (the car has a stand-in bay said
to be one)"; QUEUE-11-NOV item 12). One builder, one PR. The mid tier. Starts from the session branch; ENGINE 3D pass 1 (OWNER-ISSUES 177) and
THE CAR (BRIEF-CAR) are on main, nothing else is waited on. Read BRIEF-CAR.md, BRIEF-ENGINE-3D-1.md, `apps/web/src/car/{spec,body,bay,parts,
scene,kit,panel,faults}.ts` (the car's own geometry, its engine bay box `bay` in body.ts, the bay's stand-in in bay.ts, the parts' sheets),
`apps/web/src/engine3d/{scene,shapes,engine,view,pane,ask}.ts` (the 3-D ENGINE's products, primitives, the pane), `apps/web/src/features/
studio/index.ts` (TAKE APART, SECTION, MEASURE, the test hook `window.__ghosty.studio`), `tests/car.spec.mjs`, `tests/engine3d.spec.mjs`,
`tests/studio.spec.mjs`. THE QUALITY RULE holds (every state designed, every word his, every wait said, every number honest, every control
44 pt, nothing merely fine).

## His words
"i have this car and this is what's wrong with it" (91a); the audit's "the working 3-D engine". Today the bonnet opens on a stand-in laid out
like most engine bays, and the engine itself is a covered block. This pass makes the engine a working model: the crank turns, the pistons
rise and fall, the valves open in time, the four strokes are named as they happen, and every part can be tapped and named, in his voice, with
the car's own number where the record knows it and "a first estimate, never certified" where it does not.

## The rules (verbatim, never broken)

"only my own data and public sources; no prediction about any person; no private person searched or profiled; faces and voices only me and
people I introduce, kept on the phone, never a stranger identified, and my voice is never a lock on its own; nothing that can cost money and no
new keys unless I add them; the brain never gets live GPS; every engineering, car or build number a first estimate, never certified; social
posting only with my APPROVE every time; downloads only on my tap on Wi-Fi with the size said. Never raise the prompt guard. Never skip or
weaken a test. The CI guard job: never touch it. Never put a model name in code, comments, tests, docs or pull request text; builders are named
by tier."

Protected files, not edited: apps/edge/src/agent.ts, apps/edge/src/index.ts, apps/edge/src/tools/{index,types,repo}.ts, .github/* (except the
one spec word at the END of check.yml's `all=` list; the guard job untouched), apps/*/package.json. No package: the model is the app's own
geometry over the three.js the Studio already loads (car/three.ts's types), as the car's body is. Physics is NOT this pass (OWNER-ISSUES 179 d:
one package at KERNEL 2): the engine's motion is kinematic, computed from the crank angle, which is exact for what it shows.

## What is built

1. **THE MODEL (apps/web/src/car/engine.ts, pure geometry and timing; apps/web/src/car/enginemesh.ts for the meshes).** A parametric
   internal-combustion engine made from the CarSpec: the cylinder count and layout (an inline three or four by default from the car's size
   and fuel; an inline six or a vee where the record's model is known to have one, from a small table in his words of the common UK engines
   with "typical for this car" said, never "yours"), the bore and stroke from the displacement when the record gives one and a typical pair
   when it does not, petrol or diesel (plugs or injectors; a diesel's higher block), a turbo where the fuel and year make one typical. The
   parts, each with an id in car/parts.ts (new ids added to the bay's list, each with its sheet: what it is, a 30-second check, DIY or
   garage, a rough cost as [low, high], where it is): block, head, head gasket line, sump, each piston and its rings, each connecting rod,
   the crankshaft with its counterweights, the flywheel, each camshaft (one or two), each inlet and exhaust valve with its spring, the
   timing belt or chain with its tensioner (belt or chain by the table, "typical" said), the inlet manifold and throttle body, the exhaust
   manifold, the turbo and its intercooler pipe where present, the alternator on its belt, the water pump, the oil filter and pump, the
   starter motor, the plugs and coils or the injectors and rail, the oil and coolant passages drawn as a SECTION shows them. The whole fits
   the car's `bay` box (body.ts) with the mounts where the stand-in's were, so the bonnet-up view puts it where the engine is. An electric
   car's bay gets the motor, the inverter, the charger and the coolant loop as the same kind of model (the motor turns; no strokes), and a
   hybrid has both, said in one line. Every size a first estimate: the ESTIMATE line (engine3d/scene.ts) appears once on the view.
2. **IT TURNS.** A crank angle drives everything: the pistons by the rod geometry (not a sine), the valves by the cam profile with the usual
   overlap, the belt and the alternator pulley at their ratios, the flywheel. A REVS dial (44 pt, 600 to 6000 rpm, idle by default; the
   drawn speed is scaled down so the eye can follow, said as "slowed 20×" on the dial), PAUSE, and STEP a quarter turn. The four strokes
   named on one line for cylinder one as they happen (INTAKE · COMPRESSION · POWER · EXHAUST) with the firing order shown under it
   (1-3-4-2 for the four, and the right one for each layout), the cylinder on its power stroke lit. Reduced motion: still at top dead centre
   with STEP working; the strokes line changes with each step. The frame budget: the engine view at 60 fps on the preview's software GL with
   the frame time printed by the spec, as car.spec prints it.
3. **TAKE APART, SECTION, MEASURE, NAME.** The Studio's slider flies the parts out from the crank's axis in layers (head and manifolds first,
   then valves and cams, then pistons and rods, the block last); SECTION cuts along the cylinders so the pistons and valves are seen working;
   MEASURE between two taps works on it; a tap on any part lights it and opens its sheet (car/panel.ts's existing sheet) with its name, what it
   does in one line, and its number where known (the bore, the stroke, the compression ratio, the belt's change interval as "typical", the
   plug gap) each marked estimate or from the record. "What is this?" with a part lit answers from the sheet without the brain.
4. **WHERE IT IS SEEN.** (a) The car's bay view ("open the bonnet", the CAR card's SHOW ME, the Studio's car) shows this engine in place of the
   stand-in's block, under its cover; LIFT THE COVER (one key) shows the working engine; the bay's existing fault lighting keeps working (the
   battery light lights the alternator and battery; "it won't start" lights the starter and battery; "misfire" the coils or injectors, through
   faults.ts's suspects). The old line "a stand-in" becomes the honest line "a typical N-cylinder petrol/diesel engine for a car like yours,
   a first estimate; not your exact engine." (b) The 3-D ENGINE's tray (engine3d/scene.ts PRODUCTS) gains a product `engine` (the same model,
   120 × 60 × 70 cm by default, resizable), so a scene can hold one and glTF EXPORT carries its meshes with its credit line. (c) SHOW ME: "how
   does an engine work", "show me the four strokes", "show me a turbo" open the Stage's part kind with this engine (show/parts.ts reading it)
   and OPEN takes it to the Studio turning. (d) The arcade's and the GYM's screens: unchanged.
5. **THE WORDS.** Every part sheet in his voice, one sentence a line; every number with its word (estimate · typical · from the MOT record);
   nothing certified; the view's one line says so once. A wait over half a second while three.js loads says "Building the engine…".

## What must not change

The car's body, wheel and under views; the 3-D ENGINE's existing products and its pane; the Studio's samples; the first-screen budget and
every other budget; GLASS pixel-equal; ONE INK's page; every control 44 pt; nothing sideways at 440 × 956 or 390 × 844; the ratchet ceiling
(hex 506, rgba 1016, radiusPx 470, total 1992: equal or lower: the engine's materials come from car/kit.ts's palette); the prompt guard; no
new key; nothing downloaded.

## Tests (each fails on the code before this brief; run against it once and say so)

- apps/edge/test/workingengine.test.mjs (new; imported from an existing test file as kernel-yes was, one import line, since the test list is
  protected; NEEDS HIS WORD names it): the model from three CarSpecs (a 1.0 petrol three, a 2.0 diesel four with a turbo, an electric) has the
  parts the layout needs and every part has an id, a name, a sheet and a size; the piston at 0°, 90°, 180° and 360° by the rod geometry (not
  a sine: the 90° position is below the middle); valve lift zero at top dead centre of the power stroke and the overlap near exhaust TDC; the
  firing order and the stroke names over 720° for the three, the four and the six; the whole inside the bay box; every number in the sheets
  carries estimate, typical or record; no word "certified" except in the ESTIMATE line.
- tests/workingengine.spec.mjs (new; `all=` word `workingengine` at the END of the list in check.yml, nothing else in .github touched), at 440
  and 390: (a) "open the bonnet" with the stubbed plate: the bay, the honest line said once, LIFT THE COVER shows the engine turning (two
  snapshots differ; the crank angle hook advances); (b) PAUSE stills it; STEP advances a quarter turn and the strokes line changes; the REVS
  dial changes the rate; reduced motion: still, STEP works; (c) a tap on a piston lights it and its sheet names it with its numbers marked;
  "what is this?" answers without the brain; (d) TAKE APART at 50 % moves the head away from the block and the pistons stay with their rods;
  SECTION shows the cylinders (the hook lists the cut parts); MEASURE between two taps gives a length in cm; (e) "the battery light is on"
  lights the alternator and battery as before; (f) the 3-D ENGINE's tray has ENGINE, placed on the ground, EXPORT's glTF names its meshes; (g)
  "how does an engine work" shows the Stage's part with the engine and OPEN goes to the Studio; (h) the frame time printed, every control 44 pt,
  nothing sideways, the ESTIMATE line once.
- car, vehicle, studio, studiomake, engine3d, showme, speed2, look, ink, thescan unchanged unless a fix lives in a screen they own.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; each spec's last line into the report as it goes)

Build: `cd apps/web && npx tsc --noEmit -p . && node build.mjs`. Preview on port 8824:
`(nohup setsid node tests/preview-server.mjs 8824 > /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/pv8824.log 2>&1 < /dev/null & disown)`
in a FOREGROUND call. Specs from the worktree ROOT: `BASE=http://localhost:8824 NO_GL_SHOTS=1 timeout 600 node tests/<name>.spec.mjs tests/.shots`;
a nogl copy as `tests/.<name>.nogl.tmp.mjs` is never committed. In the foreground, alone, one after another: workingengine, car, vehicle,
studio, studiomake, engine3d, showme, speed2, look, ink, thescan, nav. The brain tests in the background once at the end. A timing budget
missed under load is rerun alone before it is called red. Known sandbox reds not touched: direct, aim, radio, scroll, safari, eye's own
screenshot, tabs2, talk's cooling lines, studio's screenshot line. The machine is shared: load 11 to 20 is normal.

## The owner's phone check

1. Type your plate, SHOW ME, "open the bonnet": the bay, then LIFT THE COVER: the engine turning, the four strokes named as they happen.
2. Tap a piston: it lights, its sheet says what it is and its numbers say estimate or record. "What is this?" with it lit.
3. REVS up: faster; PAUSE; STEP a quarter turn four times: the strokes line goes round.
4. TAKE APART to half: the head lifts, the pistons stay on their rods. SECTION: the cylinders cut open. MEASURE two points.
5. "The battery light is on": the alternator and battery light as before.
6. MAKE, 3-D ENGINE: ENGINE in the tray; stand one on the ground; EXPORT.
7. Ask "how does an engine work": the Stage's picture, OPEN takes you to it turning.
8. Does it look like an engine, or like boxes? Say which part looks least right.

## The report

/tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/workingengine-report.md: what was built, the part count by
layout, the engine table (which makes and models got which layout, each "typical"), frame time p95 on the shared machine (not the phone),
each spec's last line (before and after for the new ones), found-not-fixed, NEEDS HIS WORD (physics at KERNEL 2; the test's name in the list),
the phone check as above, the commit list. One commit per step on builder/workingengine; the orchestrator squashes to one on landing.
