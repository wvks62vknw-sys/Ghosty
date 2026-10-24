# The "everything miles better" pass, one feature at a time (OWNER-ISSUES 8; PLAN Week 2 "Upgrades of the biggest features")

One builder per feature, the same method. The feature is named in the builder's prompt (one of: God's Eye, Lens,
Threats, Reverse, Workshop, Telegram, voice, Brief, Markets, Radio, Memory, Agenda, Library, Settings and System).
Read BRIEF-W0.md, MAP.md's rows for the feature (interface and brain), its specs, UPGRADES.md (what was already done to
it), and the owner's taste (HANDOFF.md: calm, premium, plain words, honest, everything free, 44 pt targets).

## Method
1. **Measure first** (30 minutes, written down): open the feature on the preview at 440 × 956 as the owner would, with
   the brain mocked where it must be and live where it can be; list every rough spot: slow (use the stopwatch's
   numbers where they exist), unclear words, a state with no message (empty, loading, error, offline), a tap that does
   nothing, a number that could be wrong, a thing a competitor's app does better. Rank by how much the owner would
   feel it.
2. **Fix the top ten**, each the smallest change that does the job, each with a test or a spec check that fails on
   the old code, no new packages, no protected file (say the line if one is needed), no change to another feature's
   files (another builder may be in them: if the fix needs one, write it in the report instead).
3. **Prove it**: before/after screenshots, the numbers before and after where there are numbers, every spec of the
   feature passing, `npm run check`, the edge tsc, the full edge `npm test` once if the brain changed.
4. **Leave the list**: what was found and not fixed, ranked, with why, so the next pass knows.

## Finish
Commit per fix (do not push, do not merge). Report: the measured list; the ten fixes with before/after; the leftovers;
every check's exact result.
