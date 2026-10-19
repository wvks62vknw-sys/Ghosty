# WAVE B: 3D and measuring

Read BRIEF-W0.md (shared rules) and MAP.md first. Your worktree should be based on branch gym-2 (if
packages/shared/src/persona.ts is missing, run `git merge gym-2`). Another builder is restyling the app (styles.css,
navigation): keep your CSS in clearly separate blocks and keep to existing component patterns.

The owner, in his words: "for 3D, I want a lot more items and a lot more detail, like literally every single item you
can think of. You can just type it in and it can generate literally anything in advanced 3D detail. I want thousands of
presets of everyday items with actual detail, and furniture, etc. The measurements need to be a lot better. You should
literally be able to take a pic of anything and it can measure it; you shouldn't have to put in settings. Textured
models from photos using newer free models. Sketch a floor plan from a photo, but it has to be accurate and advanced."

Existing pieces to build on: the 3D STUDIO (apps/web/src/studio/*, features/studio, three.js vendored), model3d.ts and
tools/studio.ts on the brain, the measure tool (apps/web/src/measure/*, features/... MEASURE), the SPACE PLANNER
(apps/web/src/space/*), Spline as an iframe only with "Powered by Spline", and the strict CSP (no external scripts;
vendored libraries only; new fetch hosts must be justified and added through the protected _headers file — say exactly
which hosts and why, and I will review that change).

Rules that always apply: everything free (free tiers and keyless free APIs only; never anything that can bill the
owner), every model credited with its licence, iPhone 13 Safari performance, plain words, one main button per mini-app,
UNDO. Be honest in your report about what has not run for real (e.g. a Hugging Face Space you could not reach).
