/**
 * The files of the Lens's eyes packs (offline/eyes.ts), pure: this site's own /vendor files and the byte count of each, pinned. No imports,
 * so tests/offlineeyes.spec.mjs bundles it and holds every count to the file on disk.
 */

export type Row = [path: string, bytes: number];
/** The vision runtime (the one the finder, the hand recogniser and the face finder all run on). */
export const RUNTIME: Row[] = [
  ['/vendor/mediapipe/vision_bundle.mjs', 155805],
  ['/vendor/mediapipe/wasm/vision_wasm_internal.js', 334128],
  ['/vendor/mediapipe/wasm/vision_wasm_internal.wasm', 13519922],
];
export const FINDER: Row[] = [
  ['/vendor/models/efficientdet_lite0.tflite', 4602795],
  ['/vendor/models/efficientnet_lite0.tflite', 5434517],
  ['/vendor/models/gesture_recognizer.task', 8373440],
];
export const READING: Row[] = [
  ['/vendor/tesseract/tesseract.esm.min.js', 63220],
  ['/vendor/tesseract/worker.min.js', 111307],
  ['/vendor/tesseract/tesseract-core-lstm.wasm.js', 3896484],
  ['/vendor/tesseract/tesseract-core-relaxedsimd-lstm.wasm.js', 3905767],
  ['/vendor/tesseract/tesseract-core-simd-lstm.wasm.js', 3899472],
  ['/vendor/tesseract/lang/eng.traineddata.gz', 1976309],
];
export const CODES: Row[] = [
  ['/vendor/zxing/zxing-reader.mjs', 36643],
  ['/vendor/zxing/zxing_reader.wasm', 953527],
];
/** The runtime the namer, the faces and the distance model run on (its own worker, one thread). */
export const WORKER_RUNTIME: Row[] = [
  ['/vendor/clip/ort.wasm.min.mjs', 50126],
  ['/vendor/clip/ort-wasm-simd-threaded.mjs', 24419],
  ['/vendor/clip/ort-wasm-simd-threaded.wasm', 14239897],
];
export const NAMER: Row[] = [
  ['/vendor/clip/worker.mjs', 3359],
  ['/vendor/clip/mobileclip_s0_vision_fp16.onnx', 22876479],
  ['/vendor/clip/core.labels.json', 49668],
  ['/vendor/clip/core.f16.bin', 4734976],
];
export const FACES: Row[] = [
  ['/vendor/faces/blaze_face_short_range.tflite', 229746],
  ['/vendor/faces/face_recognition_sface_2021dec_int8.onnx', 9896933],
  ['/vendor/faces/worker.mjs', 3251],
];
export const DEPTH: Row[] = [
  ['/vendor/depth/worker.mjs', 2294],
  ['/vendor/depth/dav2-metric-indoor-small.v1.int8.onnx.part1', 24900000],
  ['/vendor/depth/dav2-metric-indoor-small.v1.int8.onnx.part2', 10676338],
];

export const sum = (...r: Row[][]): number => r.flat().reduce((n, [, b]) => n + b, 0);
