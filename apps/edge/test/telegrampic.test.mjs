// BRIEF-POLISH-2 item 7: A PICTURE ON TELEGRAM. When a reply would draw a Stage on the phone, the Telegram reply sends the same picture as an
// image after the sentence (drawn here, in plain pixels, written as a PNG: no renderer, no key, nothing fetched but the free map tiles the
// phone already fetches); when it cannot be drawn, the sentence goes alone, once. Run from router.test.mjs (package.json is protected, so
// no new file in the test list), as kernel-yes.test.mjs is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync, inflateSync } from 'node:zlib';

const TG = await import('./.build/telegram.mjs');
const TOKEN = '123456789:AAHfakeTokenForTests_abcDEFghiJKLmno';
const CHAT = 777000111;
const ORIGIN = 'https://ghosty.test';

/** A PNG of one flat colour, 8-bit RGB: what a map tile is here. */
function tilePng(rgb = [200, 220, 200]) {
  const raw = Buffer.alloc((256 * 3 + 1) * 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) raw.set(rgb, y * (256 * 3 + 1) + 1 + x * 3);
  const chunk = (type, body) => {
    const t = Buffer.from(type);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, body])) >>> 0);
    return Buffer.concat([len, t, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(256, 0);
  ihdr.writeUInt32BE(256, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function crc32(b) {
  let c = 0xffffffff;
  for (const x of b) {
    c ^= x;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Telegram's Bot API and the tile source, faked: every call is recorded in order; a photo's bytes are kept; anything else fails like a lost connection. */
const calls = [];
const tiles = { fail: false };
const fake = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const api = url.match(/^https:\/\/api\.telegram\.org\/bot([^/]+)\/(\w+)$/);
  if (api) {
    if (init.body instanceof FormData) {
      const photo = init.body.get('photo');
      calls.push({ method: api[2], chat: init.body.get('chat_id'), file: photo?.name, type: photo?.type, bytes: photo ? Buffer.from(await photo.arrayBuffer()) : null });
    } else calls.push({ method: api[2], body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ ok: true, result: true }), { headers: { 'content-type': 'application/json' } });
  }
  if (url.startsWith('https://tile.openstreetmap.org/')) {
    calls.push({ method: 'tile', url });
    return tiles.fail ? new Response('gone', { status: 404 }) : new Response(tilePng());
  }
  throw new TypeError(`fetch failed: tests have no network (${url.slice(0, 120)})`);
};
/** The fake stands in for fetch only while a test runs (this file is imported by router.test.mjs, whose own tests set theirs). */
const using = (name, fn) =>
  test(name, async () => {
    const real = globalThis.fetch;
    globalThis.fetch = fake;
    try {
      await fn();
    } finally {
      globalThis.fetch = real;
    }
  });

/** One turn's events through the collector, as telegram.ts feeds it; resolves with what Telegram was sent, in order. */
async function turn(ask, reply, extra = []) {
  calls.length = 0;
  const out = TG.collector(TOKEN, CHAT, ORIGIN, '', undefined, ask);
  for (const ev of extra) out.emit(ev);
  out.emit({ t: 'text', text: reply });
  out.emit({ t: 'done', model: 'Mock · scripted' });
  await out.flush();
  return calls.filter((c) => c.method !== 'tile');
}
const photos = (sent) => sent.filter((c) => c.method === 'sendPhoto');

/** What a PNG holds: its size, and how many pixels are each of the Machine's colours (read by inflating it, no decoder of its own). */
function look(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'a PNG');
  const w = bytes.readUInt32BE(16);
  const h = bytes.readUInt32BE(20);
  assert.equal(bytes[24], 8, '8 bits');
  assert.equal(bytes[25], 2, 'RGB');
  const idat = [];
  for (let at = 8; at < bytes.length; ) {
    const len = bytes.readUInt32BE(at);
    if (bytes.toString('latin1', at + 4, at + 8) === 'IDAT') idat.push(bytes.subarray(at + 8, at + 8 + len));
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  assert.equal(raw.length, (w * 3 + 1) * h, 'every row is there');
  const count = (r, g, b) => {
    let n = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * (w * 3 + 1) + 1 + x * 3;
      if (raw[i] === r && raw[i + 1] === g && raw[i + 2] === b) n++;
    }
    return n;
  };
  return { w, h, accent: count(100, 210, 255), bone: count(236, 232, 223), graphite: count(16, 19, 23), amber: count(255, 179, 64) };
}

using('a reply with a chart\'s rows sends the sentence, then one photo of the chart: drawn, a real PNG, in the Machine\'s own colours', async () => {
  const sent = await turn('How have my bills gone this year?', 'Your bills by month:\n- Jan: £88\n- Feb: £94\n- Mar: £110\n- Apr: £102\n- May: £131\n- Jun: £124');
  assert.deepEqual(sent.map((c) => c.method), ['sendMessage', 'sendPhoto'], 'the sentence first, then the picture, once');
  assert.match(sent[0].body.text, /Your bills by month/);
  const p = sent[1];
  assert.equal(p.chat, String(CHAT));
  assert.equal(p.file, 'chart.png');
  assert.equal(p.type, 'image/png');
  const img = look(p.bytes);
  assert.ok(img.w === 720 && img.h >= 300 && img.h <= 800, `a phone-sized picture: ${img.w} × ${img.h}`);
  assert.ok(img.accent > 800 && img.bone > 400 && img.graphite > img.w * img.h * 0.5, `drawn in the graphite, bone and accent of the Scan: ${JSON.stringify(img)}`);
  assert.ok(p.bytes.length < 120_000, `a small file (${p.bytes.length} bytes)`);
});

using('bars: figures of a list the same way; a table of two columns draws two series in the sequence', async () => {
  const bars = await turn('How are my shops doing?', 'Prices today:\n- Tesco: £120\n- Asda: £95\n- Lidl: £140\n- Aldi: £80');
  assert.deepEqual(bars.map((c) => c.method), ['sendMessage', 'sendPhoto']);
  assert.ok(look(bars[1].bytes).accent > 1500, 'four bars in the accent');
  const two = await turn('Compare my spending and income', '| Month | Spend | Income |\n|---|---|---|\n| Jan | 120 | 300 |\n| Feb | 95 | 280 |\n| Mar | 140 | 310 |');
  const img = look(photos(two)[0].bytes);
  assert.ok(img.accent > 100 && img.bone > 400 && img.w === 720, `two series: ${JSON.stringify(img)}`);
});

using('a reply that cannot be drawn sends the sentence alone, once: no photo, nothing said about it', async () => {
  for (const [ask, reply] of [
    ['hello', 'Hello Boss.'],
    ['how much did I spend', 'You spent £120 on food and £95 on fuel.'],
    ['will my dad get better?', 'I cannot say. He is 62: a 70% chance of a good week.'],
    ['make me a plan', 'Sure, what for?'],
  ]) {
    const sent = await turn(ask, reply);
    assert.deepEqual(sent.map((c) => c.method), ['sendMessage'], `${ask}: the text alone`);
    assert.equal(sent[0].body.text, reply);
  }
});

using('a room, a part and a letter are drawn too: the isometric drawing, the page', async () => {
  const room = await turn('Show me a room 4 by 3 with a sofa and a bed', 'A room of 4 by 3 metres with a sofa and a bed.');
  assert.deepEqual(room.map((c) => c.method), ['sendMessage', 'sendPhoto']);
  assert.equal(photos(room)[0].file, 'room.png');
  assert.ok(look(photos(room)[0].bytes).bone > 500);
  const desk = await turn('show me a desk 140 by 70', 'Here is a desk, 140 by 70.');
  assert.equal(photos(desk)[0].file, 'part.png');
  const letter = await turn('write a letter to my landlord about the damp', 'Dear Mr Smith,\n\nI am writing about the damp in the bedroom, which has got worse since October and needs fixing now.\n\nYours sincerely,\nBoss');
  assert.equal(photos(letter)[0].file, 'document.png');
  const page = look(photos(letter)[0].bytes);
  assert.ok(page.bone > page.w * page.h * 0.7, 'a page: mostly paper');
});

using('a map of a place a screen command named: the free tiles the phone already uses, the pin on it; a tile that will not come means the sentence alone', async () => {
  const event = { t: 'client', name: 'show_map', args: { place: 'The gym', lat: 52.4452, lon: -1.8886, zoom: 16 } };
  const sent = await turn('where is the gym', 'The gym is on Alcester Road.', [event]);
  const names = sent.map((c) => c.method);
  assert.deepEqual(names.filter((m) => m === 'sendPhoto'), ['sendPhoto'], `one photo: ${names.join()}`);
  assert.equal(names.at(-1), 'sendPhoto', 'the picture last');
  assert.equal(photos(sent)[0].file, 'map.png');
  const img = look(photos(sent)[0].bytes);
  assert.ok(img.w === 512 && img.accent > 200, `the pin is drawn: ${JSON.stringify(img)}`);
  tiles.fail = true;
  const none = await turn('where is the gym', 'The gym is on Alcester Road.', [event]);
  assert.equal(photos(none).length, 0, 'no tile, no picture');
  assert.equal(none.filter((c) => c.method === 'sendMessage' && /Alcester/.test(c.body?.text ?? '')).length, 1, 'the sentence once');
  tiles.fail = false;
});

using('only the free tiles are fetched, and never his live position: the address carries the grid, not him', async () => {
  const event = { t: 'client', name: 'show_map', args: { place: 'Home', lat: 52.48, lon: -1.9, zoom: 15 } };
  calls.length = 0;
  const out = TG.collector(TOKEN, CHAT, ORIGIN, '', undefined, 'show me home');
  out.emit(event);
  out.emit({ t: 'text', text: 'Home is in Birmingham.' });
  out.emit({ t: 'done', model: 'Mock · scripted' });
  await out.flush();
  const urls = calls.filter((c) => c.method === 'tile').map((c) => c.url);
  assert.equal(urls.length, 9, 'a three-by-three of tiles');
  assert.ok(urls.every((u) => /^https:\/\/tile\.openstreetmap\.org\/15\/\d+\/\d+\.png$/.test(u)), urls.join(' '));
});
