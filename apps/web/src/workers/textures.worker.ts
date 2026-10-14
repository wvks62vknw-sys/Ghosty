/** Builds the globe textures off the main thread (see engine/textures.ts). */
import { buildTextures } from '../engine/textures';
import { WORLD_URL, type WorldPack } from '../engine/world';

self.onmessage = async () => {
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
