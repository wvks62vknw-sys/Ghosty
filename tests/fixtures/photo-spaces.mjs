// Test only: the PHOTO TOOLS Spaces for the preview server (tests/photo.spec.mjs), answered from their REAL
// answers (apps/edge/test/photo.fixture.json, captured 24 October 2026) so the brain's own code runs end to end:
// BiRefNet answers with its real ZeroGPU limit (the brain moves on to BRIA RMBG-1.4), RMBG-1.4 cuts the
// background out, Real-ESRGAN makes it 2x, LaMa erases — and refuses, as a 400, a mask that is not a PNG of the
// photo's own size. A spec can put a Space to sleep or over its limit: GET /__test/photo-mode?esrgan=asleep.
import { readFileSync } from 'node:fs';

const fx = JSON.parse(readFileSync(new URL('../../apps/edge/test/photo.fixture.json', import.meta.url), 'utf8'));
const buf = (b64) => Buffer.from(b64, 'base64');
const ROOTS = {
  birefnet: ['https://zhengpeng7-birefnet-demo.hf.space', '/gradio_api'],
  rmbg: ['https://briaai-bria-rmbg-1-4.hf.space', '/gradio_api'],
  esrgan: ['https://nick088-real-esrgan-pytorch.hf.space', ''],
};
const LAMA = 'https://sanster-iopaint-lama.hf.space';
const mode = { birefnet: 'limit', rmbg: 'ok', esrgan: 'ok', lama: 'ok' };
/** What the eraser was last sent: the photo's and the mask's types and sizes. */
export const lastErase = { value: null };

export function setPhotoMode(params) {
  for (const k of Object.keys(mode)) if (params.get(k)) mode[k] = params.get(k);
  if (params.get('reset')) Object.assign(mode, { birefnet: 'limit', rmbg: 'ok', esrgan: 'ok', lama: 'ok' });
  return { ...mode, lastErase: lastErase.value };
}

/** A picture's size from its header (PNG or JPEG), or null. */
function size(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return { type: 'png', w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length && b[i] === 0xff) {
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { type: 'jpeg', w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

const asleep = () => new Response(fx.asleep.html, { status: 206, headers: { 'content-type': fx.asleep.contentType } });
const sseOf = (key) => (mode[key] === 'limit' ? fx.birefnet.sse : mode[key] === 'queue' ? 'data: {"msg":"estimation","event_id":"e1","rank":2,"queue_size":5,"rank_eta":31.2}\n\ndata: {"msg":"queue_full","event_id":"e1"}\n\n' : fx[key].sse);

/** The answer for a request to a photo Space, or null when the address is not one. */
export async function photoSpaces(u, init = {}) {
  if (u.href.startsWith(`${LAMA}/`)) {
    if (mode.lama === 'asleep') return asleep();
    if (mode.lama === 'limit') return new Response('Too Many Requests', { status: 429 });
    const body = JSON.parse(String(init.body ?? '{}'));
    const img = /^data:image\/(jpeg|png|webp);base64,/.test(body.image ?? '') ? size(buf(body.image.split(',')[1])) : null;
    const mask = /^data:image\/png;base64,/.test(body.mask ?? '') ? size(buf(body.mask.split(',')[1])) : null;
    lastErase.value = { image: img, mask };
    if (!img || !mask || mask.type !== 'png' || mask.w !== img.w || mask.h !== img.h) return Response.json({ error: 'image and mask size mismatch' }, { status: 400 });
    return new Response(buf(fx.lama.png), { headers: { 'content-type': 'image/png' } });
  }
  const key = Object.keys(ROOTS).find((k) => u.href.startsWith(`${ROOTS[k][0]}/`));
  if (!key) return null;
  const [root, prefix] = ROOTS[key];
  const path = u.href.slice(root.length);
  if (mode[key] === 'asleep') return asleep();
  if (path === '/config') return Response.json(fx[key].config);
  if (path === `${prefix}/upload`) return Response.json(fx[key].upload);
  if (path === `${prefix}/queue/join`) return Response.json({ event_id: 'e1' });
  if (path.startsWith(`${prefix}/queue/data`)) return new Response(sseOf(key), { headers: { 'content-type': 'text/event-stream' } });
  if (path.includes('/file=')) return new Response(key === 'esrgan' ? buf(fx.esrgan.webp) : buf(fx.rmbg.png), { headers: { 'content-type': key === 'esrgan' ? 'image/webp' : 'image/png' } });
  return new Response('not found', { status: 404 });
}
