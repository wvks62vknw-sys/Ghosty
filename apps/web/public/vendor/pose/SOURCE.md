# The pose model (the body pack's REPS)

What the body pack's REPS screen (`src/features/body/reps.ts`) uses to find his shoulders, elbows, wrists, hips, knees
and ankles in each camera frame, so the phone can count squats, push-ups and star jumps. It runs on the phone, in the
vendored MediaPipe runtime (`../mediapipe/`); nothing from the camera leaves the phone.

| File | What | Size |
| --- | --- | --- |
| `pose_landmarker_lite.task` | MediaPipe Pose Landmarker, lite (BlazePose GHUM 3D, float16): 33 body points a frame, one person | 5,777,746 bytes |
| `LICENSE` | The Apache License 2.0, under which Google publishes the MediaPipe models | |

- Source: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`
  (the model's own hosting, as linked from the MediaPipe Pose Landmarker guide), fetched 1 Nov 2026.
- SHA-256: `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`.
- Licence: Apache-2.0 (the MediaPipe models' licence; the model card is "BlazePose GHUM 3D" in the MediaPipe documentation).
- Unchanged: the file is byte-for-byte the published one (a zip holding the detector and the landmark model, read by
  the runtime as it is).
- Used with `runningMode: 'VIDEO'`, `numPoses: 1`, the GPU delegate falling back to the CPU, as the Lens's face finder.
