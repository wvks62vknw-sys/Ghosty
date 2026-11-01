# The face landmarker (the Lens's PEOPLE: CHECK IT'S LIVE)

What the live-face check (`src/features/lens/liveness.ts`) uses to follow his eyelids, nose and cheeks for a few seconds
before a face is saved: enrolling himself (ENROL ME, RE-ENROL) and introducing someone ("this is Sam"). It runs on the
phone, in the vendored MediaPipe runtime (`../mediapipe/`), on frames from the Lens's live camera only; nothing from the
camera, and nothing it finds, leaves the phone. Loaded only when a check runs; let go when PEOPLE closes.

| File | What | Size |
| --- | --- | --- |
| `face_landmarker.task` | MediaPipe Face Landmarker (float16): a face finder and 478 face points a frame (a zip holding `face_detector.tflite`, `face_landmarks_detector.tflite`, `geometry_pipeline_metadata_landmarks.binarypb` and `face_blendshapes.tflite`) | 3,758,596 bytes |
| `LICENSE` | The Apache License 2.0, under which Google publishes the MediaPipe models | |

- Source: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`
  (the model's own hosting, as linked from the MediaPipe Face Landmarker guide), fetched 1 Nov 2026.
- SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`.
- Licence: Apache-2.0 (the MediaPipe models' licence; model card "MediaPipe Face Mesh V2" in the MediaPipe documentation).
- Unchanged: byte-for-byte the published file, read by the runtime as it is.
- Used with `runningMode: 'VIDEO'`, `numFaces: 3`, no blendshapes, the GPU delegate falling back to the CPU. The check
  reads twenty-two of the points: six round each eye (the eye aspect ratio, for blinks), the nose tip, the bridge, the two
  cheeks by the ears (the nose-to-cheek ratio, for turning), the brow and the chin (the face's own height).
