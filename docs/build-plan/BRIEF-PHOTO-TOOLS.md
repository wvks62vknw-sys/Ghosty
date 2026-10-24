# Photo tools: remove the background, upscale, erase an object (PLAN Wave D)

Free, honest, nothing paid: the 3D STUDIO already runs free Hugging Face Spaces for text-to-3D and photo-to-3D
(`apps/edge/src/studio/gen3d.ts` or near it: how a Space is called through Gradio, the free-account check before a token
is ever used, the queue and the time limits). Read BRIEF-W0.md, MAP.md, that code, `features/lens/index.ts` (where a
photo is picked or taken), the `/i/` picture store (`apps/edge/src/pictures.ts` or MAP.md's row), `tests/lens.spec.mjs`
and `tests/studio.spec.mjs`.

## Build
A PHOTO TOOLS sheet reachable from Lens (a chip after a photo is taken or picked) and from the chat (a photo with
"remove the background", "make it sharper", "erase the …"): three jobs, each a free Space pinned by its name and a
checked licence (say them: e.g. a background remover built on RMBG or BiRefNet, an upscaler on Real-ESRGAN, an eraser
on LaMa inpainting; the eraser takes a finger-drawn mask over the photo on the phone). The job runs on the brain
(`tools/photo.ts`: one tool `photo_tool { job, picture, mask? }`), the result lands in the picture store with a
10-year link as other pictures do, the sheet shows before and after with a slider, SAVE TO PHOTOS (download) and
SHARE. Progress and queue waits are said in plain words; a Space that is asleep or over its free limit is said too,
with "try again in a minute", never a paid fallback. Each job is also offered offline-honestly: "needs the brain".

## Tests (each must fail on the old code)
Edge: the three Space calls against fixtures (the request shape, the result parsed, the error words for asleep, queue
and limit), the mask encoded correctly, the picture stored. Spec `tests/photo.spec.mjs` at 440 × 956 with the brain's
Space calls mocked: the sheet, the slider, the mask drawing, SAVE. Keep lens and studio specs passing. `npm run check`,
the edge tsc, the full edge `npm test` once. Say any protected-file line needed (a FEED_HOSTS host, tool words).

## Finish
Commit per step (do not push, do not merge). Report: the Spaces chosen with licences and limits; files; screenshots;
every check's exact result; anything not done and why.
