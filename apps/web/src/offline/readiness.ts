/**
 * HOW READY YOU ARE OFFLINE, read from this phone (NEXT ROUND, polish3.u10): which of the pieces in readywords.ts are here, their
 * sizes, and which this phone can run. Read from what the phone already keeps (the offline brain's and meaning's records, each
 * pack's kept record), so it is instant and asks nothing of the network.
 */
import { offlineBrain } from './brain';
import { embedState } from './embed';
import { EYES_PACKS } from './eyes';
import { mapPack } from './maps';
import { EMBED_MODEL, MODELS, sizeText } from './models';
import { keptAll, sizeWords } from './pack';
import { SPEAKER_PACK } from './speakerpack';
import { PIECES, scoreOf, type Readiness, type ReadyPiece } from './readywords';

const NO_GPU = 'This phone’s browser has no WebGPU, so it can’t run a brain here';

/** Every piece as it stands on this phone now. */
export function piecesNow(): ReadyPiece[] {
  // (a kept record is written only when a download finished whole: offline/pack.ts)
  const kept = keptAll();
  const gpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
  const st = offlineBrain.get();
  const packBytes = new Map<string, number>([...EYES_PACKS.map((p) => [p.id, p.bytes] as const), ['voice-model', SPEAKER_PACK.bytes]]);
  return PIECES.map((p) => {
    if (p.id === 'brain') {
      const m = MODELS.find((x) => x.id === st.model) ?? MODELS[0]!;
      return { ...p, bytes: m.mb * 1_000_000, size: sizeText(m.mb), held: !!st.downloaded, can: gpu, ...(gpu ? {} : { why: NO_GPU }) };
    }
    if (p.id === 'meaning') return { ...p, bytes: EMBED_MODEL.mb * 1_000_000, size: sizeText(EMBED_MODEL.mb), held: !!embedState.get().downloaded, can: gpu, ...(gpu ? {} : { why: NO_GPU }) };
    if (p.id === 'map') {
      const map = mapPack();
      return { ...p, bytes: map.bytes, size: `about ${sizeWords(map.bytes)}`, held: !!kept[map.id], can: true };
    }
    const b = packBytes.get(p.id) ?? 0;
    return { ...p, bytes: b, size: sizeWords(b), held: !!kept[p.id], can: true };
  });
}

/** The number, what is here, what is not, and the next download. */
export const readinessNow = (): Readiness => scoreOf(piecesNow());
