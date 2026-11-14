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
export { pageUpload, MAX_PAGE } from './src/sitepage.ts';
export * as SB from './src/sitebuild.ts';
export * as PJ from './src/projects.ts';
export { checkHtml } from './src/tools/check.ts';
export { siteTools, siteStore, siteVersionsRoute, MAX_VERSIONS } from './src/tools/sites.ts';`,
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

// NEXT ROUND sites.u2: undo for published pages. Every update keeps the version before it (three at most); "undo" puts the newest
// back at the same link after his APPROVE (or the Workshop's confirmed tap), and what was live is kept, so an undo can be undone.
test('undo for a published page: the earlier versions kept, the newest put back after APPROVE, and the undo itself undoable', async () => {
  const st = new MemStorage();
  const kv = kvOf();
  const env = { PUBLIC_ORIGIN: ORIGIN, SITES: kv };
  const events = [];
  const ctx = { env, storage: st, origin: ORIGIN, emit: (e) => events.push(e), progress() {} };
  const store = P.siteStore(env, st);
  const page = (h1) => `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Party</title></head><body><h1>${h1}</h1></body></html>`;
  const pub = P.siteTools.find((t) => t.name === 'publish_site');
  await pub.run({ name: 'party', html: page('Saturday at 8') }, ctx);
  // nothing to undo yet
  await assert.rejects(pub.approval({ name: 'party', undo: true }, ctx), /has no earlier version kept/);
  await pub.run({ name: 'party', html: page('Sunday at 9 (typo)') }, ctx);
  assert.equal((await store.versions('party')).length, 1);
  assert.equal((await store.list()).find((e) => e.name === 'party').versions, 1, 'the list says an undo is there');
  // the same page again is not a new version
  await pub.run({ name: 'party', html: page('Sunday at 9 (typo)') }, ctx);
  assert.equal((await store.versions('party')).length, 1);
  // undo: said, then done only on the approved call
  const ap = await pub.approval({ name: 'party', undo: true, html: '<script>evil()</script>' }, ctx);
  assert.match(ap.reason, /^Put back the earlier version of "Party" at https:\/\/ghosty\.example\/s\/party \(published .* UTC, replaced .* UTC\)\? What is live now is kept, so you can undo this too\.$/);
  assert.deepEqual(ap.args, { name: 'party', undo: true }, 'nothing but the undo goes through');
  assert.match(await pub.run(ap.args, ctx), /^Put back: "Party" is live again at https:\/\/ghosty\.example\/s\/party/);
  assert.match((await store.get('party')).html, /Saturday at 8/);
  // the undo is undoable: the typo version is the newest earlier one now
  assert.equal((await store.versions('party')).length, 1);
  await pub.run({ name: 'party', undo: true }, ctx);
  assert.match((await store.get('party')).html, /Sunday at 9/);
  // three kept at most
  for (const t of ['v3', 'v4', 'v5', 'v6']) await pub.run({ name: 'party', html: page(t) }, ctx);
  assert.equal((await store.versions('party')).length, P.MAX_VERSIONS);
  // the Workshop's route
  const r = await P.siteVersionsRoute(new Request(`${ORIGIN}/api/sites/party/restore`, { method: 'POST' }), '/sites/party/restore', { env, storage: st });
  assert.equal(r.status, 200);
  assert.match((await store.get('party')).html, /v5/);
  assert.equal((await (await P.siteVersionsRoute(new Request(`${ORIGIN}/api/sites/party/versions`), '/sites/party/versions', { env, storage: st })).json()).versions.length, P.MAX_VERSIONS);
  // taken down: its history goes with it
  await store.remove('party');
  assert.deepEqual(await store.versions('party'), []);
  assert.equal((await P.siteVersionsRoute(new Request(`${ORIGIN}/api/sites/party/restore`, { method: 'POST' }), '/sites/party/restore', { env, storage: st })).status, 404);
});

// NEXT ROUND sites.s4 (with s3): a document or a deck from his phone at its own link. The page waits (published by nothing); publish_site
// with from_phone goes through the same check and APPROVE as every page; the waiting page is used once.
test('a document from his phone waits, then goes up only through publish_site\'s APPROVE, read-only and checked', async () => {
  const st = new MemStorage();
  const kv = kvOf();
  const env = { PUBLIC_ORIGIN: ORIGIN, SITES: kv };
  const ctx = { env, storage: st, origin: ORIGIN, emit() {}, progress() {} };
  const up = (body) => P.pageUpload(new Request(`${ORIGIN}/api/sites/page`, { method: 'POST', body: JSON.stringify(body) }), { env, storage: st });
  const pub = P.siteTools.find((t) => t.name === 'publish_site');
  // nothing waiting
  await assert.rejects(pub.approval({ name: 'garden-guide', from_phone: true }, ctx), /nothing is waiting from his phone/);
  // not a page; too big
  assert.equal((await up({ title: 'x', html: '<p>hi</p>' })).status, 422);
  assert.equal((await up({ title: 'x', html: `<!doctype html><p>${'a'.repeat(P.MAX_PAGE + 10)}</p>` })).status, 413);
  const doc = '<!doctype html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Garden guide</title>\n</head>\n<body>\n<h1 class="title">Garden guide</h1>\n<p>Sow the beans in May.</p>\n</body>\n</html>\n';
  const r = await up({ title: 'Garden guide', html: doc, kind: 'document' });
  assert.deepEqual(await r.json(), { ok: true, title: 'Garden guide', kind: 'document', bytes: doc.length });
  assert.equal(await P.siteStore(env, st).get('garden-guide'), undefined, 'waiting is not published');
  const ap = await pub.approval({ name: 'garden-guide', from_phone: true }, ctx);
  assert.match(ap.reason, /^Publish "Garden guide" \(the document from your phone, read-only\) as a public page at https:\/\/ghosty\.example\/s\/garden-guide\?/);
  assert.match(await pub.run(ap.args, ctx), /live now at https:\/\/ghosty\.example\/s\/garden-guide/);
  const site = await P.siteStore(env, st).get('garden-guide');
  assert.match(site.html, /Sow the beans in May/);
  assert.equal((await (await P.pageUpload(new Request(`${ORIGIN}/api/sites/page`), { env, storage: st })).json()).title, null, 'used once');
  // his home page (sites.u8): the same path, said as his home page of the pages he chose
  await up({ title: 'My pages', html: doc.replace(/Garden guide/g, 'My pages'), kind: 'home' });
  assert.match((await pub.approval({ name: 'my-pages', from_phone: true }, ctx)).reason, /^Publish "My pages" \(your home page from your phone: only the pages you chose\) as a public page/);
  // a deck page has no script, so the strictest policy is enough; a page with a script error is refused by the same check
  await up({ title: 'Broken', html: '<!doctype html><html><head><title>Broken</title></head><body><script>if (</script></body></html>', kind: 'deck' });
  await assert.rejects(pub.approval({ name: 'broken', from_phone: true }, ctx), /not published/);
});

// NEXT ROUND sites.u6: change a mini-app after it is made. Only what he named changes, at the same link and of the same kind (so what is
// saved on his phone stays), said before his APPROVE, built on the kit and kept undoable.
test('a mini-app changed after it is made: a habit added, a goal changed, the same link and kind, said first, undoable', async () => {
  const st = new MemStorage();
  const env = { PUBLIC_ORIGIN: ORIGIN };
  const ctx = { env, storage: st, origin: ORIGIN, emit() {}, progress() {} };
  const app = P.siteTools.find((t) => t.name === 'build_app');
  const store = P.siteStore(env, st);
  await app.run((await app.approval({ request: 'make me a habits app for water, walk and read', shape: 'habits', title: 'Habits', items: ['Water', 'Walk', 'Read'] }, ctx)).args, ctx);
  const before = await store.get('habits');
  assert.deepEqual(before.app.config.habits.names, ['Water', 'Walk', 'Read']);
  // add one, take one out
  const ap = await app.approval({ request: 'add stretch and take walk off my habits app', change: true, link_name: 'habits', add_items: ['Stretch'], remove_items: ['walk'] }, ctx);
  assert.match(ap.reason, /^Change the mini-app "Habits" at https:\/\/ghosty\.example\/s\/habits\/: habits: “Water”, “Walk”, “Read” → “Water”, “Read”, “Stretch”\? Same link; what is saved on your phone stays\./);
  assert.equal((await store.get('habits')).app.config.habits.names.length, 3, 'nothing changes before APPROVE');
  assert.match(await app.run(ap.args, ctx), /^Changed "Habits" at https:\/\/ghosty\.example\/s\/habits\/: habits:/);
  const after = await store.get('habits');
  assert.deepEqual(after.app.config.habits.names, ['Water', 'Read', 'Stretch']);
  assert.equal(after.app.config.shape, 'habits');
  assert.equal(after.app.config.id, 'habits', 'the same name: its saves on the phone stay');
  assert.match(after.app.config.does, /stretch/, 'its own words follow the change');
  assert.equal(after.app.icon, before.app.icon, 'the same icon');
  // undoable
  assert.equal((await store.versions('habits')).length, 1);
  // a goal on a tracker
  await app.run((await app.approval({ request: 'make me an app that tracks my water intake', shape: 'tracker', title: 'Water' }, ctx)).args, ctx);
  const ap2 = await app.approval({ request: 'change my water goal to 10', change: true, link_name: 'water', goal: 10 }, ctx);
  assert.match(ap2.reason, /goal: \d+ → 10/);
  await app.run(ap2.args, ctx);
  assert.equal((await store.get('water')).app.config.tracker.goal, 10);
  // refused in words: another kind, nothing to change, no such app, a goal on a habits app
  await assert.rejects(app.approval({ request: 'x', change: true, link_name: 'habits', shape: 'timer' }, ctx), /cannot become a timer/);
  await assert.rejects(app.approval({ request: 'x', change: true, link_name: 'habits' }, ctx), /nothing to change/);
  await assert.rejects(app.approval({ request: 'x', change: true, link_name: 'nope', add_items: ['a'] }, ctx), /no mini-app is published at \/s\/nope\//);
  await assert.rejects(app.approval({ request: 'x', change: true, link_name: 'habits', goal: 5 }, ctx), /has no goal/);
});

test('[security] the strip keeps only the picture: a detail block between scans and anything after the end marker are dropped', () => {
  const seg = (m, body) => [0xff, m, ((body.length + 2) >> 8) & 0xff, (body.length + 2) & 0xff, ...body];
  const gps = [...new TextEncoder().encode('Exif\0\0GPS 52.48 -1.90')];
  const jpeg = new Uint8Array([
    0xff, 0xd8, ...seg(0xe0, [0x4a, 0x46, 0x49, 0x46, 0]), ...seg(0xe1, gps), ...seg(0xdb, [0, 1, 2]),
    ...seg(0xda, [1, 2, 3]), 0x11, 0xff, 0x00, 0x22, 0xff, 0xd0, 0x33, // first scan's data (a stuffed FF and a restart marker kept)
    ...seg(0xe1, gps), // a detail block between scans
    ...seg(0xda, [4, 5, 6]), 0x44, 0x55,
    0xff, 0xd9, // the end
    ...new TextEncoder().encode('MotionPhoto_Data GPS 52.48 -1.90'), 0xff, 0xd8, 0xff, 0xd9, // hidden extra after the end
  ]);
  const out = P.stripJpeg(jpeg);
  assert.ok(out);
  const txt = Buffer.from(out).toString('latin1');
  assert.ok(!txt.includes('GPS') && !txt.includes('MotionPhoto'), 'no place, no hidden extra');
  assert.deepEqual([...out.slice(-2)], [0xff, 0xd9], 'it ends at the end marker');
  assert.ok(txt.includes('\x11\xff\x00\x22\xff\xd0\x33'), 'the picture data is untouched, stuffed bytes and restart markers kept');
  assert.ok(txt.includes('JFIF'), 'the JFIF header is kept');
});
