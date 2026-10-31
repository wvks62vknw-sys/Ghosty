/**
 * Builds the globe textures off the main thread (see engine/textures.ts). The GYM's training also runs in
 * an instance of this worker (gym/worker.ts): a message carrying `gym` goes there instead; the Workbench's wind
 * tunnel (features/workbench/tunnelwork.ts) takes the messages carrying `tunnel`.
 */
import { buildTextures } from '../engine/textures';
import { WORLD_URL, type WorldPack } from '../engine/world';
import { gymMessage, type GymIn } from '../gym/worker';
import { siteMessage, type SiteIn } from '../offline/sitework';
import { tunnelMessage, type TunnelIn } from '../features/workbench/tunnelwork';

self.onmessage = async (e: MessageEvent) => {
  if (e.data && typeof e.data === 'object' && 'gym' in e.data) {
    gymMessage(e.data as GymIn, (m) => (self as unknown as Worker).postMessage(m));
    return;
  }
  // The offline website builder (offline/sitework.ts): a message carrying `site`.
  if (e.data && typeof e.data === 'object' && 'site' in e.data) {
    siteMessage(e.data as SiteIn, (m) => (self as unknown as Worker).postMessage(m));
    return;
  }
  // The WIND TUNNEL (features/workbench/tunnelwork.ts): a message carrying `tunnel`; its frames go back as transferable buffers.
  if (e.data && typeof e.data === 'object' && 'tunnel' in e.data) {
    tunnelMessage(e.data as TunnelIn, (m, transfer) => (self as unknown as Worker).postMessage(m, transfer));
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
