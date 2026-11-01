// The engines harness (tests/engines.spec.mjs): starts a shelf game's engine on a full-page canvas with the real free
// data, unpacked here the way the phone unpacks it (apps/web/src/arcade/store.ts), and lets the spec drive it through
// window.harness: the shared Intent, the engine's probe, pause/resume/quit and the events it sent.
import { idle } from '../../../apps/web/src/arcade/input';
import { SHELF } from '../../../apps/web/src/arcade/shelf';
import { unpack } from '../../../apps/web/src/arcade/store';
import { doom } from '../../../apps/web/src/arcade/engines/doom';
import { quake } from '../../../apps/web/src/arcade/engines/quake';
import { memorySaves, saveStore, type SaveStore } from '../../../apps/web/src/arcade/engines/saves';
import type { Engine, EngineHandle } from '../../../apps/web/src/arcade/engines/types';

const ENGINES: Record<string, Engine> = { doom, quake };
let canvas = document.getElementById('screen') as HTMLCanvasElement;
const intent = idle();
const seen = { done: [] as { score: number; words: string }[], hits: 0, errors: [] as string[], quits: 0 };
let handle: EngineHandle | null = null;
let saves: SaveStore = memorySaves();
const packages = new Map<string, Uint8Array>();

/** The package's file name in data/: the last part of its first mirror's address. */
const packageFile = (url: string): string => decodeURIComponent(url.split('/').pop()!).split('/').pop()!;

const harness = {
  intent,
  seen,
  async start(id: string, args: string[] = [], o: { sound?: boolean; keepSaves?: boolean } = {}) {
    const entry = SHELF.find((e) => e.id === id);
    if (!entry) throw new Error(`no shelf game ${id}`);
    const file = packageFile(entry.data.url[0]!);
    let pkg = packages.get(file);
    if (!pkg) {
      const r = await fetch(`data/${encodeURIComponent(file)}`);
      if (!r.ok) throw new Error(`data/${file}: ${r.status}`);
      pkg = new Uint8Array(await r.arrayBuffer());
      packages.set(file, pkg);
    }
    const t0 = performance.now();
    const files = Object.fromEntries(await unpack(pkg, entry.data.take));
    const unpackMs = Math.round(performance.now() - t0);
    if (!o.keepSaves) saves = id.endsWith('-idb') ? saveStore(id) : memorySaves();
    Object.assign(intent, idle());
    seen.done.length = 0;
    seen.hits = 0;
    seen.errors.length = 0;
    seen.quits = 0;
    // a fresh canvas for each game, as the player gives each its own
    const fresh = document.createElement('canvas');
    fresh.id = 'screen';
    canvas.replaceWith(fresh);
    canvas = fresh;
    const t1 = performance.now();
    handle = await ENGINES[entry.engine]!.start(canvas, files, intent, {
      onLevelDone: (score, words) => seen.done.push({ score, words }),
      onHit: () => seen.hits++,
      onError: (e) => seen.errors.push(e.message),
      onQuit: () => seen.quits++,
    }, { saves, sound: o.sound ?? false, args });
    return { unpackMs, startMs: Math.round(performance.now() - t1), bytes: Object.values(files).reduce((n, b) => n + b.length, 0) };
  },
  probe: () => handle?.probe?.() ?? null,
  pause: () => handle?.pause(),
  resume: () => handle?.resume(),
  setSound: (on: boolean) => handle?.setSound(on),
  async quit() {
    await handle?.quit();
    handle = null;
  },
  saves: () => saves.list(),
  /** A fingerprint of the whole picture now (shrunk to 128 × 64 in the frame the engine drew it; no screenshot). */
  snap(): Promise<string> {
    return new Promise((resolve) =>
      requestAnimationFrame(() => {
        const small = document.createElement('canvas');
        small.width = 128;
        small.height = 64;
        const g = small.getContext('2d', { willReadFrequently: true })!;
        g.drawImage(canvas, 0, 0, 128, 64);
        const px = g.getImageData(0, 0, 128, 64).data;
        let a = 2166136261;
        for (let i = 0; i < px.length; i++) a = Math.imul(a ^ px[i]!, 16777619);
        resolve((a >>> 0).toString(16));
      }),
    );
  },
  /** The picture as a PNG (data: address), taken the same way. */
  png(): Promise<string> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve(canvas.toDataURL('image/png'))));
  },
  /** Hold the buttons for a while (in ms), then let go. */
  async hold(actions: string[], ms: number) {
    for (const a of actions) intent.held.add(a as never);
    await new Promise((r) => setTimeout(r, ms));
    for (const a of actions) intent.held.delete(a as never);
  },
};

declare global {
  interface Window {
    harness: typeof harness;
  }
}
window.harness = harness;
document.title = 'Ghosty engines harness · ready';
