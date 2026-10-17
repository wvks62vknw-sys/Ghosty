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
| `zxing/` | ZXing-C++ barcode and QR reader, WebAssembly (`zxing_reader.wasm`, 931 KB) and its ES module bundled into one file (`zxing-reader.mjs`, 36 KB) | zxing-wasm 3.1.4 (reader build; zxing-cpp inside) | MIT (zxing-wasm), Apache-2.0 (zxing-cpp) |

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
