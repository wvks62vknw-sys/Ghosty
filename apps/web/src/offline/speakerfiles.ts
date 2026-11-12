/**
 * The voice model's pack (offline/speakerpack.ts), pure: this site's own /vendor files and the byte count of each, pinned. The
 * runtime it runs on is the one the namer and the faces use (eyesfiles.ts WORKER_RUNTIME): a phone that has either already holds it.
 * tests/speaker.spec.mjs holds every count to the file on disk. The model is kept as two parts (the host refuses a file over 25 MiB), as the
 * depth model is, and joined on the phone by the voice worker.
 */
import { sum, WORKER_RUNTIME, type Row } from './eyesfiles';

export const VOICE_MODEL_ROWS: Row[] = [
  ['/vendor/speaker/worker.mjs', 2913],
  ['/vendor/speaker/voice-model.onnx.part1', 24900000],
  ['/vendor/speaker/voice-model.onnx.part2', 1630309],
];
/** The runtime's files (the namer's and the faces'), for the checks. */
export const WORKER_RUNTIME_ROWS: Row[] = WORKER_RUNTIME;
export const VOICE_MODEL_PIN = {
  parts: ['/vendor/speaker/voice-model.onnx.part1', '/vendor/speaker/voice-model.onnx.part2'],
  worker: '/vendor/speaker/worker.mjs',
  bytes: 26530309,
} as const;
/** What the pack's GET fetches in all (the model is most of it; the runtime is not fetched again where it is already kept). */
export const VOICE_PACK_BYTES = sum(WORKER_RUNTIME, VOICE_MODEL_ROWS);
