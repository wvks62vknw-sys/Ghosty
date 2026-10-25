// Directions, nearby places and radio, with the outside services faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mod = await import('./.build/brain.mjs');
const worker = mod.default;
const { GhostyAgent } = mod;

const calls = [];
globalThis.fetch = async (input) => {
  const url = typeof input === 'string' ? input : input.url;
  calls.push(url);
  const j = (o) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });
  if (url.includes('nominatim.openstreetmap.org/search')) {
    return j([{ lat: '51.5014', lon: '-0.1419', display_name: 'Buckingham Palace, Westminster, London', name: 'Buckingham Palace' }]);
  }
  if (url.includes('routing.openstreetmap.de')) {
    return j({
      code: 'Ok',
      routes: [{
        distance: 5230, duration: 1260,
        geometry: { coordinates: [[-0.1278, 51.5074], [-0.135, 51.504], [-0.1419, 51.5014]] },
        legs: [{ steps: [
          { distance: 300, name: 'Strand', maneuver: { type: 'depart' } },
          { distance: 2000, name: 'The Mall', maneuver: { type: 'turn', modifier: 'left' } },
          { distance: 0, name: '', maneuver: { type: 'arrive' } },
        ] }],
      }],
    });
  }
  if (url.includes('radio-browser.info') && url.includes('tag=speak')) {
    // the BBC lists its stations with http:// addresses; the same streams are served on https
    return j([
      { name: 'BBC News HD (720P)', url_resolved: 'https://vs-hls-push-ww-live.akamaized.net/x=4/news.m3u8', country: 'UK', tags: 'news', codec: 'UNKNOWN', bitrate: 0, votes: 9 },
      { name: 'BBC Radio 4 (128k)', url_resolved: 'http://as-hls-ww-live.akamaized.net/pool_55057080/live/ww/bbc_radio_fourfm/bbc_radio_fourfm.isml/bbc_radio_fourfm-audio%3d128000.norewind.m3u8', country: 'UK', tags: 'speak', codec: 'UNKNOWN', bitrate: 0, votes: 9 },
    ]);
  }
  if (url.includes('radio-browser.info')) {
    return j([
      { name: 'Insecure FM', url_resolved: 'http://insecure.example/stream', country: 'UK', tags: 'jazz', codec: 'MP3', bitrate: 128, votes: 1 },
      { name: 'Jazz London', url_resolved: 'https://jazz.example/stream', country: 'United Kingdom', tags: 'jazz,smooth', codec: 'MP3', bitrate: 128, votes: 9 },
    ]);
  }
  return new Response('not faked', { status: 599 });
};

class MemStorage {
  m = new Map();
  async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
  async delete(k) { return this.m.delete(k); }
  async setAlarm() {}
  async getAlarm() { return null; }
}
const OWNER_KEY = 'travel-owner-key-0123456789abcdef';
const pending = [];
const state = { storage: new MemStorage(), waitUntil: (p) => pending.push(p) };
const env = { OWNER_KEY, MOCK_LLM: '1' };
let agent;
env.AGENT = { idFromName: (n) => n, get: () => ({ fetch: (r) => (agent ??= new GhostyAgent(state, env)).fetch(r) }) };
const ctx = { waitUntil: (p) => pending.push(p) };
async function chat(message, context = { tz: 'Europe/London', location: { name: 'London', lat: 51.5074, lon: -0.1278 } }) {
  const r = await worker.fetch(new Request('https://ghosty.me.workers.dev/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': OWNER_KEY }, body: JSON.stringify({ message, context }) }), env, ctx);
  assert.equal(r.status, 200);
  const text = await r.text();
  await Promise.allSettled(pending.splice(0));
  return text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

test('directions: from the owner\'s location, summary, and the route sent to the globe', async () => {
  const ev = await chat('directions to buckingham palace by walking');
  const res = ev.find((e) => e.t === 'tool_result');
  assert.ok(res.ok, res.summary);
  assert.match(res.summary, /Walking from London to Buckingham Palace: 5\.2 km .* about 21 min/);
  const route = ev.find((e) => e.t === 'client' && e.name === 'show_route');
  assert.ok(route, 'route drawn on the globe');
  assert.deepEqual(route.args.path[0], [51.5074, -0.1278]);
  assert.equal(route.args.path.length, 3);
  assert.ok(calls.some((u) => u.includes('routed-foot')), 'walking profile used');
});

test('radio: a station listed with http:// whose own https stream exists plays (BBC Radio 4); no TV channels', async () => {
  const ev = await chat('play speak radio');
  const play = ev.find((e) => e.t === 'client' && e.name === 'play_radio');
  assert.ok(play, ev.find((e) => e.t === 'tool_result')?.summary);
  assert.equal(play.args.url, 'https://as-hls-ww-live.akamaized.net/pool_55057080/live/ww/bbc_radio_fourfm/bbc_radio_fourfm.isml/bbc_radio_fourfm-audio%3d128000.norewind.m3u8');
  assert.match(ev.find((e) => e.t === 'tool_result').summary, /Playing BBC Radio 4/);
});

test('radio: only secure streams are played', async () => {
  const ev = await chat('play jazz radio');
  const play = ev.find((e) => e.t === 'client' && e.name === 'play_radio');
  assert.ok(play);
  assert.equal(play.args.url, 'https://jazz.example/stream');
  assert.match(ev.find((e) => e.t === 'tool_result').summary, /Playing Jazz London/);
});
