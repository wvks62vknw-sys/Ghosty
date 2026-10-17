# Vendored vision and reading libraries

Fixed versions, served from this site (the interface's security policy allows scripts and workers
from here only). Everything runs on the phone; no picture leaves it unless the owner asks Ghosty.

| Folder | What | Version | Licence |
| --- | --- | --- | --- |
| `mediapipe/` | MediaPipe Tasks Vision (`vision_bundle.mjs`, SIMD WebAssembly runtime) | @mediapipe/tasks-vision 1.1.1 | Apache-2.0 |
| `models/efficientdet_lite0.tflite` | Object detector, 80 everyday things (COCO), int8 | mediapipe-models object_detector/efficientdet_lite0/int8/1 | Apache-2.0 |
| `models/efficientnet_lite0.tflite` | Image classifier, 1,000 kinds of thing (ImageNet), int8 | mediapipe-models image_classifier/efficientnet_lite0/int8/1 | Apache-2.0 |
| `models/gesture_recognizer.task` | Hand landmarks (21 points per hand) and seven gestures | mediapipe-models gesture_recognizer/float16/1 | Apache-2.0 |
| `tesseract/` | Tesseract.js (reading text in pictures): the page module, its worker and the LSTM cores (SIMD, relaxed-SIMD, plain) | tesseract.js 7.0.0, tesseract.js-core 7.0.0 | Apache-2.0 |
| `tesseract/lang/eng.traineddata.gz` | English reading model (fast) | tesseract-ocr/tessdata_fast | Apache-2.0 |
| `clip/ort.wasm.min.mjs`, `clip/ort-wasm-simd-threaded.mjs`, `clip/ort-wasm-simd-threaded.wasm` | ONNX Runtime Web, WebAssembly build (runs the namer; one thread, no worker) — 50 KB + 24 KB + 14.2 MB | onnxruntime-web 1.30.0 | MIT (`clip/LICENSE-onnxruntime.txt`) |
| `clip/mobileclip_s0_vision_fp16.onnx` | MobileCLIP-S0 picture encoder, half floats (NAME mode) — 22.9 MB | Xenova/mobileclip_s0 `onnx/vision_model_fp16.onnx` (Hugging Face, revision 757d59c) | Apple: see below |
| `clip/core.labels.json`, `clip/core.f16.bin` | 4,624 everyday names and their MobileCLIP-S0 text vectors (512 half floats each, length 1) — 50 KB + 4.7 MB | made for Ghosty, see `clip/README.md` | as the model |
| `clip/extended.labels.json`, `clip/extended.i8.bin` | 28,223 more names (MORE NAMES), int8 vectors with one scale per row — 384 KB + 14.6 MB | made for Ghosty, see `clip/README.md` | as the model |

**The MobileCLIP licence, plainly.** Apple publishes MobileCLIP's code under MIT, but the trained model
weights under the *Apple Machine Learning Research Model* licence (`clip/LICENSE-mobileclip-weights.txt`,
from huggingface.co/apple/MobileCLIP-S0): use, copying and redistribution are allowed **for research and
non-commercial purposes only**, with that licence passed on and changes disclosed. The ONNX conversion we
ship (Xenova/mobileclip_s0) carries Apple's sample-code notice (`clip/LICENSE-mobileclip.txt`). Ghosty is
one person's private, non-commercial assistant, which is within those terms; it must not be sold or used
in a commercial product with these files. Our changes: none to the model; the name vectors are derived
from the model's text encoder (see `clip/README.md`). Apple Machine Learning Research Model is licensed
under the Apple Machine Learning Research Model License Agreement.
| `zxing/` | ZXing-C++ barcode and QR reader, WebAssembly (`zxing_reader.wasm`, 931 KB) and its ES module bundled into one file (`zxing-reader.mjs`, 36 KB) | zxing-wasm 3.1.4 (reader build; zxing-cpp inside) | MIT (zxing-wasm, `zxing/LICENSE`), Apache-2.0 (zxing-cpp, `zxing/LICENSE-zxing-cpp.txt`) |

One change to the upstream files: `mediapipe/vision_bundle.mjs` had a usage-logging call to
`odml.pa.googleapis.com` (sent with an API key whenever a task ran); it is removed, so the runtime
never talks to Google. The interface's security policy would have blocked it anyway.

`zxing/zxing-reader.mjs` is `dist/es/reader/index.js` with its shared chunk bundled in by esbuild
(nothing else changed) except one line: its default WebAssembly address on the jsDelivr CDN is replaced
by `/vendor/zxing/`, so the reader can never fetch code from elsewhere (scan/barcode.ts also says so with
`locateFile`). The WebAssembly is byte-for-byte the package's (SHA-256 e8af31ed…5d86fb2, which the
module itself records).

Nothing here recognises faces or reads number plates on purpose: no face model is included, and
Ghosty never tries to identify a person.
