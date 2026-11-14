// NEXT ROUND sites.u12: his own photos on his sites. A photo from his phone is kept with every detail block stripped (the place,
// the time, the phone), listed, captioned, made the main picture or removed (its bytes kept while a published page shows it), and
// "with my photos" puts them on a website instead of free stock pictures: the first as the main picture, the gallery from the
// rest, none of them stopped for want of a credit. Named in the test list of package.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  stdin: {
    contents: `export * from './src/sitephotos.ts';
export * as SB from './src/sitebuild.ts';
export * as PJ from './src/projects.ts';
export { checkHtml } from './src/tools/check.ts';
export { siteTools, siteStore } from './src/tools/sites.ts';`,
    resolveDir: at('..'),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  external: ['cloudflare:sockets'],
  outfile: at('./.build/sitephotos/sitephotos.mjs'),
  logLevel: 'warning',
});
const P = await import('./.build/sitephotos/sitephotos.mjs');
const { SB, PJ } = P;

class MemStorage {
  m = new Map();
  async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix))); }
  alarm = null;
  async setAlarm(t) { this.alarm = t; }
  async getAlarm() { return this.alarm; }
}
const kvOf = () => ({
  m: new Map(),
  async get(k, type) { if (!this.m.has(k)) return null; const v = this.m.get(k); return type === 'arrayBuffer' ? v : type === 'json' ? JSON.parse(v) : v; },
  async put(k, v) { this.m.set(k, typeof v === 'string' ? v : v); },
  async delete(k) { this.m.delete(k); },
});
const ORIGIN = 'https://ghosty.example';
const seg = (marker, payload) => { const b = Buffer.from(payload); return Buffer.concat([Buffer.from([0xff, marker, (b.length + 2) >> 8, (b.length + 2) & 255]), b]); };
/** A JPEG as a phone camera writes one: JFIF, then Exif with a GPS position, XMP, a comment, then the picture. */
const camera = () => new Uint8Array(Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  seg(0xe0, 'JFIF\0\x01\x01\0\0\x01\0\x01\0\0'),
  seg(0xe1, 'Exif\0\0GPSLatitude 52.4862 N GPSLongitude 1.8904 W Model iPhone 15'),
  seg(0xe1, 'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>52.4862</x:xmpmeta>'),
  seg(0xfe, 'taken at home'),
  seg(0xdb, Buffer.alloc(65, 1)),
  seg(0xc0, Buffer.from([8, 0, 2, 0, 2, 1, 1, 0x11, 0])),
  seg(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0])),
  Buffer.from([0x12, 0x34, 0x56, 0xff, 0xd9]),
]));
const b64 = (u8) => Buffer.from(u8).toString('base64');
const req = (method, body, q = '') => new Request(`${ORIGIN}/api/sites/photos${q}`, { method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });

test('a camera photo loses every detail block (its place, its phone, its comment) and keeps the picture', () => {
  const raw = camera();
  assert.ok(P.hasDetails(raw));
  const clean = P.stripJpeg(raw);
  const text = Buffer.from(clean).toString('latin1');
  assert.doesNotMatch(text, /GPS|52\.4862|iPhone|xmpmeta|taken at home/);
  assert.match(text, /JFIF/, 'the JFIF header stays');
  assert.deepEqual([...clean.slice(-5)], [0x12, 0x34, 0x56, 0xff, 0xd9], 'the picture data is untouched');
  assert.equal(P.hasDetails(clean), false);
  assert.equal(P.stripJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), null, 'not a JPEG');
  assert.equal(P.stripJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff])), null, 'a broken block');
});

test('kept, listed, captioned, made the main one and removed; the bytes stay while a published page shows the photo', async () => {
  const kv = kvOf();
  const c = { env: { SITES: kv, PUBLIC_ORIGIN: ORIGIN }, storage: new MemStorage(), origin: ORIGIN };
  // empty
  assert.deepEqual(await (await P.photosRoute(req('GET'), c)).json(), { photos: [], max: 24 });
  // one from his phone
  const r = await P.photosRoute(req('POST', { data: b64(camera()), caption: 'The counter <b>', width: 1600, height: 1200 }), c);
  assert.equal(r.status, 200);
  const j = await r.json();
  const id = j.photo.id;
  assert.match(id, /^[A-Za-z0-9_-]{16}$/);
  assert.equal(j.photo.src, `${ORIGIN}/i/${id}`);
  assert.equal(j.photo.caption, 'The counter b', 'no markup in a caption');
  const kept = Buffer.from(kv.m.get(`img:${id}`)).toString('latin1');
  assert.doesNotMatch(kept, /GPS|52\.4862|iPhone|xmpmeta|taken at home/, 'kept with no location');
  // not a photo; too many
  assert.equal((await P.photosRoute(req('POST', { data: b64(new Uint8Array([1, 2, 3])) }), c)).status, 415);
  const second = (await (await P.photosRoute(req('POST', { data: b64(camera()), caption: 'Chairs', width: 1200, height: 1600 }), c)).json()).photo.id;
  // caption and main
  let list = (await (await P.photosRoute(req('PATCH', { id, caption: 'Our counter' }), c)).json()).photos;
  assert.equal(list[0].caption, 'Our counter');
  list = (await (await P.photosRoute(req('PATCH', { id: second, main: true }), c)).json()).photos;
  assert.deepEqual(list.map((p) => p.id), [second, id], 'the main picture first');
  // the builder's set: main, story, gallery, alt from the caption (or the business)
  const set = P.photoSet(c, await P.listPhotos(c), 'Little Fern');
  assert.equal(set.hero.src, `${ORIGIN}/i/${second}`);
  assert.equal(set.hero.alt, 'Chairs');
  assert.equal(set.story[0].alt, 'Our counter');
  assert.equal(set.hero.credit, undefined, 'his own: no credit line');
  // a published page shows the first: removing it keeps its bytes and says which page
  await P.siteStore(c.env, c.storage).put({ name: 'fern', title: 'Little Fern', html: `<img src="${ORIGIN}/i/${id}">`, source: '', at: 1 });
  const d1 = await (await P.photosRoute(req('DELETE', undefined, `?id=${id}`), c)).json();
  assert.deepEqual(d1.keptFor, ['Little Fern']);
  assert.ok(kv.m.has(`img:${id}`), 'the page keeps its picture');
  assert.deepEqual(d1.photos.map((p) => p.id), [second]);
  // one no page shows: its bytes go too
  const d2 = await (await P.photosRoute(req('DELETE', undefined, `?id=${second}`), c)).json();
  assert.equal(d2.removed, true);
  assert.ok(!kv.m.has(`img:${second}`));
  // the most it keeps
  const full = { env: { SITES: kvOf(), PUBLIC_ORIGIN: ORIGIN }, storage: new MemStorage(), origin: ORIGIN };
  await full.storage.put(P.PHOTOS, Array.from({ length: 24 }, (_, i) => ({ id: `x${String(i).padStart(15, '0')}`, caption: '', width: 1, height: 1, bytes: 1, at: i })));
  const over = await P.photosRoute(req('POST', { data: b64(camera()) }), full);
  assert.equal(over.status, 409);
  assert.match((await over.json()).error, /24 photos kept/);
  // no picture store: said
  assert.equal((await P.photosRoute(req('POST', { data: b64(camera()) }), { env: {}, storage: new MemStorage(), origin: ORIGIN })).status, 503);
});

test('"with my photos": the approval says so, and the website shows his photos instead of stock, the first as the main picture', async () => {
  const kv = kvOf();
  const st = new MemStorage();
  const env = { PUBLIC_ORIGIN: ORIGIN, SITES: kv };
  const ctx = { env, storage: st, origin: ORIGIN, vault: { get: async () => null }, emit() {}, progress() {} };
  const tool = P.siteTools.find((t) => t.name === 'build_website');
  assert.equal(SB.wantsOwnPhotos({ request: 'build a website for my cafe with my photos' }), true);
  assert.equal(SB.wantsOwnPhotos({ request: 'build a website for my cafe', my_photos: true }), true);
  assert.equal(SB.wantsOwnPhotos({ request: 'build a website for my cafe' }), false);
  // none kept yet: said, and the free photos are used
  assert.match((await tool.approval({ request: 'a website for a cafe in Bilston called Little Fern, with my photos' }, ctx)).reason, /You have no photos kept for your sites yet \(Workshop → PHOTOS FOR YOUR SITES\), so I will use free credited photos\./);
  const ids = [];
  for (const [cap, w, h] of [['The front window', 1600, 1000], ['Flat white on the counter', 1200, 1600], ['Cakes', 1600, 1200], ['The garden', 1600, 1067]]) ids.push((await P.addPhoto(ctx, camera(), { caption: cap, width: w, height: h })).id);
  const ap = await tool.approval({ request: 'a website for a cafe in Bilston called Little Fern, with my photos' }, ctx);
  assert.match(ap.reason, /With your own 4 photos \(Workshop → PHOTOS FOR YOUR SITES\), not stock pictures\./);
  // the build, with the models answering
  const notes = [];
  let busy = false;
  const d = {
    env, storage: st, library: { available: false }, tools: [], tctx: ctx, system: async () => 'SYSTEM', notify: async (i) => notes.push(i), busy: { get: () => busy, set: (v) => (busy = v) },
    complete: async (messages) => {
      const sys = messages[0].content;
      if (/^SITE PLANNER/.test(sys)) return { message: { role: 'assistant', content: '{"palette":"cafe","fonts":"friendly","shape":"soft","scheme":"light","tone":"warm","drop":[]}' } };
      if (/^SITE WRITER/.test(sys)) return { message: { role: 'assistant', content: '{}' } };
      if (/^SITE CRITIC/.test(sys)) return { message: { role: 'assistant', content: '{"verdict":"Warm.","score":8,"fixes":[]}' } };
      throw new Error('unexpected call');
    },
  };
  // (no free photo search may run: the network is closed in the brain tests, and his photos come first)
  await tool.run(ap.args, ctx);
  const [p0] = await PJ.listProjects(ctx);
  for (let i = 0; i < 12; i++) {
    const p = await PJ.loadProject(d, p0.id);
    if (p.status !== 'active') break;
    const pj = ((await st.get('jobs')) ?? []).find((j) => j.kind === 'project' && j.text === p0.id) ?? { id: 'j', kind: 'project', text: p0.id };
    await PJ.runProjectStep(d, pj);
  }
  const p = await PJ.loadProject(d, p0.id);
  assert.equal(p.status, 'done', p.note);
  assert.match(p.steps[0].result, /4 of your own photos \(resized on your phone, location removed\)/);
  const confirm = await tool.approval({ request: 'those are right, publish it', link_name: 'little-fern' }, ctx);
  assert.match(await tool.run(confirm.args, ctx), /live now at https:\/\/ghosty\.example\/s\/little-fern/);
  const site = await P.siteStore(env, st).get('little-fern');
  assert.ok(site, 'published');
  assert.ok(site.html.includes(`${ORIGIN}/i/${ids[0]}`), 'the first photo is on the page');
  assert.ok(ids.filter((id) => site.html.includes(`/i/${id}`)).length >= 2, 'more than one of his photos is used');
  assert.doesNotMatch(site.html, /upload\.wikimedia\.org|images\.unsplash|pexels/, 'no stock pictures');
  assert.match(site.html, /alt="The front window"/, 'his caption is what a screen reader says');
  assert.deepEqual(P.checkHtml(site.html).errors, []);
});
