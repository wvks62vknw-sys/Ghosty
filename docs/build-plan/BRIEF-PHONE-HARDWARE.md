# BRIEF: THE PHONE'S HARDWARE — 120 Hz motion, a larger size of the eyes, WebGPU for the GYM, the offline brain measured

AUDIT-8-NOV item 5 (week 3, PLAN section 5: "18 Pro Max tuning: 120 Hz motion everywhere, larger on-device vision and depth models
(Lens, NAME, MEASURE), faster GYM training with WebGPU on the phone, the offline brain's speed and memory settled on the real
device"); OWNER-ISSUES 164 ("all of this needs to be built": the hardware items blind, because no phone is here, each with a fallback
when the phone lacks the feature, and his phone check decides). Read STANDARD.md, then this, then BRIEF-SHELL-2.md for the shape, then
apps/web/src/engine/scheduler.ts (the one frame loop), features/core/mind.ts (the orb's frame gating), offline/{eyes,eyesfiles,pack,
models,brain}.ts and features/settings/packs.ts (OFFLINE EYES), gym/worker.ts and gym/brain.ts (the GYM's learners),
features/system/{index,speed}.ts (SYSTEM) and tests/{offlineeyes,offlinebrain,bigbrain,gym}.spec.mjs. The mid tier. Start from
the session branch.

## What is fixed

1. **120 HZ, MEASURED.** Every animation and frame loop runs at the display's own rate when the device offers it. The one loop
   (engine/scheduler.ts) hands every frame's browser time to a meter (engine/refresh.ts): the median of the last 90 gaps that were not
   stalls, snapped to a rate screens really have (30, 48, 60, 72, 90, 100, 120, 144, 165, 240), 0 until 12 gaps have been seen, and
   everything that plans with a rate reads `rate()` (60 until it knows). Nothing keeps a fixed 60 Hz step for motion: the orb's
   "60 fps for a second after a change" is the display's rate (`moving()`, never below 60; 30 fps idle stays: it is the battery's, not
   the display's), the loop's missing-gap fallback is one frame at the measured rate, THE LOOK's orb the same. CSS motion is already the
   display's own. The MOTION calm and Reduce Motion paths are untouched: they decide whether things move, never how fast. SYSTEM → STATUS
   has a THIS PHONE card whose first line is `REFRESH  120 Hz, measured over 90 frames` (`Measuring…` before the meter knows).
   Fallback: a 60 Hz phone, a phone saving power, a browser that throttles frames: the same code reads 60 or 30 and plans with it.

2. **A SECOND SIZE OF THE EYES.** Where a larger, free, licence-clear model of the same job exists for the Lens's eyes, NAME or MEASURE,
   it is a pack of its own beside the standard one in SETTINGS → OFFLINE EYES (offline/sizes.ts: `LARGER`, a row of `{ of, pack, need }`),
   shown as "Larger, N MB, for a newer phone", fetched only on his tap on Wi-Fi with the size said (the pack rule, offline/pack.ts, as for
   every pack), split in parts under the host's 25 MiB per file as the depth model is. It is used without his say only when the phone
   reports what it needs (offline/capability.ts: `navigator.deviceMemory` 6 GB or more, `hardwareConcurrency` 6 or more, a WebGPU adapter
   whose `maxBufferSize` is 512 MB or more) and the larger pack is on the phone; otherwise the standard one. By hand: AUTO, STANDARD,
   LARGER per pack, kept on the phone. Safari reports no memory, so on the owner's phone the choice is his, by hand; the panel says so.
   **No larger model is vendored or made in this pass**: a model cannot be judged without a phone to run it on, the depth model's larger
   sizes carry a non-commercial licence, and the namer's larger sizes carry the same research-only licence as the one in use. `LARGER` is
   empty, the panel says "One size only for now" and reads the phone's capabilities aloud, and the choice, the second row, the download
   rule and the fallback are built and tested with a stand-in pack.

3. **WEBGPU FOR THE GYM, WHEN THE PHONE HAS IT.** The sums of training a network are matrix multiplications; gym/gpu.ts has two backends
   of one shape, `webgpu` (a WGSL compute shader) and `cpu` (the plain loops), chosen when the GYM opens by what the phone can do
   (`chooseBackend`): an adapter and a device, else the processor, and if the chip fails half-way the run moves to the processor and says
   so. gym/gputrain.ts trains a tanh network by whole-batch gradient steps through whichever backend it is given. The GYM's gym card has
   a line (features/gym/path.ts, `data-path` "webgpu" or "cpu") saying which path it took and why when it is the processor, and TIME IT
   trains the same practice network on both and says the two times. The learners' own per-point loops (gym/brain.ts) are unchanged: a
   hundred points are too few for a chip, and moving them is a change to every learner's saved behaviour that no phone has judged.

4. **THE OFFLINE BRAIN, MEASURED.** Each load of a brain is timed (offline/measure.ts `timed`, in offline/brain.ts load): milliseconds
   always, the JavaScript heap's growth where `performance.memory` exists, kept per brain. SYSTEM's THIS PHONE card shows the brain in use
   (`loaded in 6.2 s, the page gained 310 MB`; `memory not reported by this browser` on Safari), and one guidance line per size (0.6B, 2B,
   4B): what it needs when running, whether the phone's own report allows it, what its load took, and "a long wait for the first word"
   past 45 s. MEASURE THE BRAIN reloads the one in use under the stopwatch, only when it is already on the phone. **The safe fallback:**
   before a bigger brain loads, a phone that reports its memory and is under the fit rule's "no" (models.ts `fitOf`: more than 40 % of the
   memory) is refused in plain words and the smaller brain takes over (brain.ts `mayLoad` then `fallBack`), instead of trying and having
   iOS close Ghosty. A phone that does not report memory is not ruled out by a guess: the crash record still protects it.

## What must not change

The prompt guard; the CI guard job; `.github/*` (but the one word on the `all=` line), `apps/*/package.json`, the kernel files; no
packages, nothing from the network, no new keys; downloads only on his tap on Wi-Fi with the size said; faces only him and the people he
introduces, on the phone; never a vendor's model name; MOTION calm and Reduce Motion; the learners' saved behaviour; the ratchet (hex 506,
rgba 1016, radiusPx 470, total 1992: this pass adds drawing only inside THE SYSTEM, in tokens); no file under apps/web/public over
25 MiB.

## Tests (tests/phonehw.spec.mjs; capabilities faked by page.addInitScript)

1. 120 Hz and 60 Hz: the page's frame callback is made to arrive every 8.3 ms, then every 16.7 ms; SYSTEM's REFRESH line reads 120 then
   60; the meter, bundled from the source, snaps made-up frame times (stalls ignored, 0 until 12 gaps, 90 and 144 snapped, 118 Hz
   rounded); Reduce Motion and MOTION calm still leave the line there and the orb still.
2. Memory large and small, WebGPU present and absent: the capability rule says larger for 8 GB + 8 cores + a 1 GB buffer, standard for
   Safari's missing memory, for 4 GB, for no WebGPU; OFFLINE EYES with a stand-in larger pack shows the second row with its size said,
   fetches nothing by looking, fetches only on the tap, AUTO picks by the phone, STANDARD and LARGER by hand, a larger one not fetched
   falls back to the standard; with none on the site the panel says "One size only for now" and the phone's capabilities.
3. GYM: with a fake WebGPU the line says `webgpu` and the fake's dispatches were counted; with none it says the processor and why; with
   a device that throws mid-run the run finishes on the processor with the moved-to-the-processor words; both paths train the same
   network to the same loss within a rounding.
4. The offline brain: a measure is kept per load (timings always, heap where the browser gives it), SYSTEM shows it and the three sizes'
   guidance; with the memory reported small the 4B is refused and the smaller brain takes over with the plain words; with the memory
   reported large, or not reported, it is not refused.
5. Everything at 440×956 in all three worlds: nothing sideways, every key 44 pt, no page errors.

## Validation

`cd apps/web && npx tsc --noEmit -p . && node build.mjs`; the brain tests (`cd apps/edge && npm test`); phonehw, lens, offlineeyes,
onphone, measure, name, gym, offlinebrain, bigbrain, scrollfeel, speed2, settings, thescan, ui and look one at a time on the preview.

## The owner's phone check

(1) SYSTEM → STATUS → THIS PHONE: REFRESH should read 120 Hz. (2) SETTINGS → OFFLINE EYES: the line under the packs reads what the
phone reports; with no larger model on the site it says so; when one is added, the second row and AUTO / STANDARD / LARGER appear.
(3) GYM: the line under TRAIN ALL says which path it took; TIME IT says both times. (4) SYSTEM → THIS PHONE: MEASURE THE BRAIN (with a
brain on the phone) says how long it took to load and what the page gained; the three sizes' lines say which fits. Tell the owner what
each said: the first run on the real phone decides every number here.

## Report

phonehw-report.md in the scratchpad: every commit and its hash, each item's capable path, its fallback and the test that proves both,
the models offered (none, and why), NEEDS HIS WORD, each spec's last line. Never push. Named by tier, never by model.
