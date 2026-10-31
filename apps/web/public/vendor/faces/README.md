# The face models (Lens PEOPLE)

What the Lens's PEOPLE mode needs to know the owner's face and the faces of the people he introduces, served from
this site and kept by the service worker after the first use. Nothing here talks to the network, and nothing a
model makes leaves the phone (`src/vision/faces.ts`, `src/vision/facestore.ts`).

| File | What | Size |
| --- | --- | --- |
| `blaze_face_short_range.tflite` | MediaPipe's BlazeFace, short range (`mediapipe-models/face_detector/blaze_face_short_range/float16/latest`): faces in a frame, each with six points (the eyes, the nose tip, the mouth's middle, the ears). Run by `../mediapipe/` (the runtime SEE and HANDS use) as its FaceDetector task, GPU first. Apache-2.0. SHA-256 b4578f35…0152f | 230 KB |
| `face_recognition_sface_2021dec_int8.onnx` | SFace from the OpenCV Zoo (`opencv/face_recognition_sface` on Hugging Face): a MobileFaceNet trained with the SFace loss, int8. Input `data` 1×3×112×112 (RGB, 0–255, no mean or scale: OpenCV's `blobFromImage(face, 1, (112, 112), (0, 0, 0), swapRB)`), output `fc1` 1×128. Apache-2.0 (`LICENSE-sface.txt`). SHA-256 2b0e941e…d78a | 9.9 MB |
| `worker.mjs` | ours: the worker the face model runs in, on `../clip/`'s ONNX Runtime Web (one thread, WebAssembly); leaving PEOPLE ends it. Its address carries `?maxPages=`: the runtime's memory cap (1 GB, then 256 MB on one retry), because an iPhone refuses the stock 4 GB shared reservation once the vision runtime holds memory too (`../clip/README.md`) | 2 KB |

Lining up: the eyes, the nose and the mouth's middle from BlazeFace are taken onto SFace's own template (OpenCV
`FaceRecognizerSF`, the mouth as the middle of its two corners) by a least-squares similarity transform
(`src/vision/facemath.ts similarity`), drawn into 112 × 112. Matching: the cosine with each kept look; from 0.363
(SFace's published threshold for the same person on LFW) "I think it's …", from 0.45 sure, and two people about as
close is nobody.

Checked here (2026-10-31): the int8 file under the vendored ONNX Runtime Web agrees with the full-float SFace
(cosine 0.95–0.97 on test pictures), unlike the 8-bit files of `../clip/` (its README); one face takes about
0.35 s in Node's WebAssembly on one thread. How well it knows *his* face, in his light, can only be seen on his phone.
