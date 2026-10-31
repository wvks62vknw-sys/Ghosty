// The guardian's tests' shared kit (not a test file itself): the modules built from source, the recorded answers of every
// public source (guardian.fixture.json: never the live feeds), a fake web that serves them, and a guardian on a fake
// clock with everything that would go out written down. Used by guardian.test.mjs (the watch), linkcheck.test.mjs (a scam
// or a link) and walk.test.mjs (the walk home, the named person, the panic phrase).
import { existsSync, readFileSync } from 'node:fs';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
const entries = ['../src/guardian.ts', '../src/walk.ts', '../src/integrations/warnings.ts', '../src/integrations/linkcheck.ts', '../src/mind.ts', '../../../packages/shared/src/guardian.ts'].map(at).filter((p) => existsSync(p));
await build({ entryPoints: entries, bundle: true, format: 'esm', platform: 'neutral', external: ['cloudflare:sockets'], outdir: at('./.build/guardian'), outbase: at('../../..'), outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
const built = (p) => (existsSync(at(`./.build/guardian/${p}`)) ? import(`./.build/guardian/${p}`) : Promise.resolve(null));
export const G = await built('apps/edge/src/guardian.mjs');
export const Wk = await built('apps/edge/src/walk.mjs');
export const W = await built('apps/edge/src/integrations/warnings.mjs');
export const L = await built('apps/edge/src/integrations/linkcheck.mjs');
export const M = await built('apps/edge/src/mind.mjs');
export const S = await built('packages/shared/src/guardian.mjs');
export const FX = JSON.parse(readFileSync(new URL('./guardian.fixture.json', import.meta.url), 'utf8'));

// 31 Oct 2026, 16:30 UK (GMT: the clocks went back on the 25th)
export const NOW = Date.UTC(2026, 9, 31, 16, 30);
export const MIN = 60_000;
export const HOME = { id: 'home', label: 'Home', query: 'B13 8PX', address: 'B13 8PX, Moseley, Birmingham', lat: 52.443186, lon: -1.892525, at: 1 };

export class Mem {
  m = new Map();
  alarm = null;
  async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])); }
  async setAlarm(t) { this.alarm = typeof t === 'number' ? t : t.getTime(); }
  async getAlarm() { return this.alarm; }
}

/** What the fake web answers; `feeds` is switched per test. Every call is written down. */
export const web = { feeds: { ea: 'ea_alert', met: 'met_wm', police: 'police_b13' }, down: new Set(), calls: [], rdap: {}, cf: {} };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  web.calls.push(url.href);
  const host = url.hostname;
  if (web.down.has(host)) throw new TypeError(`fetch failed: ${host} is down in this test`);
  if (host === 'environment.data.gov.uk') return json(FX[web.feeds.ea]);
  if (host === 'www.metoffice.gov.uk') return new Response(FX[web.feeds.met], { headers: { 'content-type': 'application/rss+xml' } });
  if (host === 'api.postcodes.io') return json(FX.postcode_b13);
  if (host === 'data.police.uk') return json(FX[web.feeds.police]);
  if (host === 'rdap.org') {
    const name = decodeURIComponent(url.pathname.split('/').pop());
    const r = web.rdap[name];
    return r ? json(FX[r]) : new Response('', { status: 404 });
  }
  if (host === 'security.cloudflare-dns.com') return json(FX[web.cf[url.searchParams.get('name')] ?? 'cf_ok']);
  if (host === 'raw.githubusercontent.com') return new Response(FX.openphish);
  if (host === 'phishing.army') return new Response(FX.phishing_army);
  if (host === 'routing.openstreetmap.de') return json(FX.osrm_foot);
  throw new TypeError(`fetch failed: tests have no network (${url.href.slice(0, 120)})`);
};

/** A guardian with a fake clock, his saved home and everything that would go out written down. */
export function guardian({ places = [HOME], tz = 'Europe/London', name = 'Aqis' } = {}) {
  const storage = new Mem();
  storage.m.set('places', places);
  storage.m.set('owner:ctx', { tz, name });
  const out = { notes: [], telegram: [], email: [], push: [] };
  let now = NOW;
  const d = {
    env: {},
    storage,
    vault: { get: async (k) => (k === 'telegram' ? 'token' : k === 'email' ? 'email-config' : null) },
    notify: async (item) => void out.notes.push(item),
    now: () => now,
    send: {
      telegram: async (chatId, text, button) => void out.telegram.push({ chatId, text, button }),
      email: async (to, subject, body) => void out.email.push({ to, subject, body }),
      push: async (msg) => (out.push.push(msg), 1),
    },
    route: async () => 24,
  };
  return { d, storage, out, at: (t) => (now = t), get now() { return now; } };
}

export async function named(g, person = { name: 'Sam', telegram: '@sam_k', sharePos: false }) {
  await Wk.setPerson(g.storage, person, g.now);
  const c = await G.loadConfig(g.storage);
  // Sam opened the bot with the invite
  if (c.person.invite && !/^Thanks, Sam\. Aqis has named you/.test(await Wk.personJoined(g.d, c.person.invite.code, 424242, 'sam_k', g.now))) throw new Error('Sam could not join by the invite');
}

