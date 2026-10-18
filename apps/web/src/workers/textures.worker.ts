/**
 * Builds the globe textures off the main thread (see engine/textures.ts). The GYM's training also runs in
 * an instance of this worker (gym/worker.ts): a message carrying `gym` goes there instead.
 */
import { buildTextures } from '../engine/textures';
import { WORLD_URL, type WorldPack } from '../engine/world';
import { gymMessage, type GymIn } from '../gym/worker';

self.onmessage = async (e: MessageEvent) => {
  if (e.data && typeof e.data === 'object' && 'gym' in e.data) {
    gymMessage(e.data as GymIn, (m) => (self as unknown as Worker).postMessage(m));
    return;
  }
  try {
    const r = await fetch(WORLD_URL);
    const pack = (await r.json()) as WorldPack;
    const t = buildTextures(pack, (w, h) => new OffscreenCanvas(w, h));
    const bio = (t.bio as OffscreenCanvas).transferToImageBitmap();
    const lights = (t.lights as OffscreenCanvas).transferToImageBitmap();
    (self as unknown as Worker).postMessage({ ok: true, W: t.W, H: t.H, geo: t.geo, bio, lights }, [t.geo.buffer, bio, lights]);
  } catch (e) {
    (self as unknown as Worker).postMessage({ ok: false, error: String(e) });
  }
};
